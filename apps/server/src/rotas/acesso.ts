import { cadastroSchema, loginSchema } from '@rede/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../banco.js';
import type { Prisma } from '../../gerado/prisma/index.js';
import type { Config } from '../config.js';
import { conferirSenha, fingirConferencia, guardarSenha } from '../acesso/senhas.js';
import {
  COOKIE_DE_RENOVACAO,
  criarSessao,
  opcoesDoCookie,
  renovarSessao,
  revogarSessao,
} from '../acesso/sessoes.js';

/**
 * Entrar e sair da rede.
 *
 * Três princípios guiam o que está aqui:
 *
 * 1. **Ninguém entra sem convite.** É o que mantém a rede fechada.
 * 2. **As respostas não contam quem existe.** Convite inválido, e-mail
 *    desconhecido e senha errada dizem todos a mesma coisa.
 * 3. **O servidor nunca vê chave privada.** Recebe apenas as públicas.
 */

/** Registra o que aconteceu, sem nunca guardar conteúdo. */
async function anotar(
  usuarioId: string | null,
  acao: string,
  endereco: string,
  detalhe?: Prisma.InputJsonObject,
): Promise<void> {
  await banco.registro.create({
    data: { usuarioId, acao, endereco, ...(detalhe ? { detalhe } : {}) },
  });
}

export function rotasDeAcesso(app: FastifyInstance, config: Config): void {
  const cookie = opcoesDoCookie(config.emProducao);

  // Tentar senhas é barato para quem ataca e caro para quem defende. Um teto
  // por IP transforma força bruta em algo que leva anos.
  const limiteDeTentativas = {
    rateLimit: { max: config.LIMITE_DE_TENTATIVAS, timeWindow: '5 minutes' },
  };

  // ─── Cadastro ────────────────────────────────────────────────────────────
  app.post(
    '/api/acesso/cadastrar',
    { config: limiteDeTentativas },
    async (requisicao, resposta) => {
      const dados = cadastroSchema.safeParse(requisicao.body);
      if (!dados.success) {
        return resposta.code(400).send({
          erro: dados.error.issues[0]?.message ?? 'Dados inválidos.',
          campo: dados.error.issues[0]?.path.join('.'),
        });
      }

      const { convite, email, apelido, nome, senha, nomeDoAparelho, identidade } = dados.data;

      const conviteNoBanco = await banco.convite.findUnique({
        where: { codigo: convite.trim().toUpperCase() },
      });

      const conviteVale =
        conviteNoBanco &&
        !conviteNoBanco.revogadoEm &&
        conviteNoBanco.usosRestantes > 0 &&
        conviteNoBanco.expiraEm > new Date();

      if (!conviteVale) {
        await anotar(null, 'cadastro.convite-recusado', requisicao.ip);
        // Um texto só para código inexistente, vencido, revogado e esgotado.
        // Se distinguíssemos, dava para descobrir códigos válidos por tentativa.
        return resposta.code(400).send({
          erro: 'Esse convite não vale. Confira o código, ou peça um novo a quem te convidou.',
          campo: 'convite',
        });
      }

      const jaExiste = await banco.usuario.findFirst({
        where: { OR: [{ email }, { apelido }] },
        select: { email: true, apelido: true },
      });

      if (jaExiste) {
        // Aqui contar é aceitável e necessário: a pessoa precisa saber que o
        // apelido está tomado para escolher outro. E ela já provou ter um
        // convite válido, então não é qualquer um perguntando.
        return jaExiste.email === email
          ? resposta
              .code(409)
              .send({ erro: 'Já existe uma conta com esse e-mail.', campo: 'email' })
          : resposta.code(409).send({ erro: 'Esse apelido já está em uso.', campo: 'apelido' });
      }

      // A primeira pessoa a entrar administra a rede. É o dono do servidor,
      // que criou o convite inicial pelo terminal.
      const primeira = (await banco.usuario.count()) === 0;

      const usuario = await banco.$transaction(async (tx) => {
        const novo = await tx.usuario.create({
          data: {
            email,
            apelido,
            nome,
            senhaHash: await guardarSenha(senha),
            papel: primeira ? 'ADMIN' : 'MEMBRO',
            chaveDeRecuperacao: dados.data.chaveDeRecuperacao,
            conviteUsadoId: conviteNoBanco.id,
            aparelhos: {
              create: {
                nome: nomeDoAparelho,
                chavePublicaDeAssinatura: identidade.assinatura,
                chavePublicaDeTroca: identidade.troca,
                usadoEm: new Date(),
              },
            },
          },
          include: { aparelhos: true },
        });

        await tx.convite.update({
          where: { id: conviteNoBanco.id },
          data: { usosRestantes: { decrement: 1 } },
        });

        // Todo mundo entra nos três círculos de partida. Quem administra ajusta
        // depois — é bem menos frustrante remover alguém de um círculo do que
        // descobrir que ninguém vê os posts uns dos outros.
        const circulos = await tx.circulo.findMany({ select: { id: true } });
        if (circulos.length > 0) {
          await tx.membroDoCirculo.createMany({
            data: circulos.map((c) => ({ circuloId: c.id, usuarioId: novo.id })),
          });
        }

        return novo;
      });

      const aparelho = usuario.aparelhos[0]!;
      const renovacao = await criarSessao(
        usuario.id,
        aparelho.id,
        requisicao.headers['user-agent'],
      );

      await anotar(usuario.id, 'cadastro.concluido', requisicao.ip, { primeira });

      return resposta
        .setCookie(COOKIE_DE_RENOVACAO, renovacao, cookie)
        .code(201)
        .send({
          acesso: app.emitirAcesso({
            sub: usuario.id,
            papel: usuario.papel,
            aparelho: aparelho.id,
          }),
          eu: {
            id: usuario.id,
            email: usuario.email,
            apelido: usuario.apelido,
            nome: usuario.nome,
            papel: usuario.papel,
            aparelhoId: aparelho.id,
          },
        });
    },
  );

  // ─── Login ───────────────────────────────────────────────────────────────
  app.post('/api/acesso/entrar', { config: limiteDeTentativas }, async (requisicao, resposta) => {
    const dados = loginSchema.safeParse(requisicao.body);
    if (!dados.success) {
      return resposta.code(400).send({ erro: 'Preencha o e-mail e a senha.' });
    }

    const { email, senha, nomeDoAparelho } = dados.data;
    const usuario = await banco.usuario.findUnique({ where: { email } });

    // Sem conta? Ainda assim gastamos o tempo de uma conferência de verdade,
    // para que o relógio não entregue quem tem conta na rede.
    const senhaConfere = usuario
      ? await conferirSenha(usuario.senhaHash, senha)
      : await fingirConferencia(senha);

    if (!usuario || !senhaConfere || usuario.desativadoEm) {
      await anotar(usuario?.id ?? null, 'login.recusado', requisicao.ip);
      return resposta.code(401).send({ erro: 'E-mail ou senha incorretos.' });
    }

    // Cada entrada cria um aparelho, porque cada navegador tem chaves próprias.
    // As chaves públicas chegam depois, quando o aparelho as gerar — por isso
    // ficam vazias por um instante.
    const aparelho = await banco.aparelho.create({
      data: {
        usuarioId: usuario.id,
        nome: nomeDoAparelho ?? 'Aparelho',
        chavePublicaDeAssinatura: '',
        chavePublicaDeTroca: '',
        usadoEm: new Date(),
      },
    });

    const renovacao = await criarSessao(usuario.id, aparelho.id, requisicao.headers['user-agent']);
    await anotar(usuario.id, 'login.ok', requisicao.ip);

    return resposta.setCookie(COOKIE_DE_RENOVACAO, renovacao, cookie).send({
      acesso: app.emitirAcesso({ sub: usuario.id, papel: usuario.papel, aparelho: aparelho.id }),
      eu: {
        id: usuario.id,
        email: usuario.email,
        apelido: usuario.apelido,
        nome: usuario.nome,
        papel: usuario.papel,
        aparelhoId: aparelho.id,
      },
    });
  });

  // ─── Renovar ─────────────────────────────────────────────────────────────
  app.post('/api/acesso/renovar', async (requisicao, resposta) => {
    const token = requisicao.cookies[COOKIE_DE_RENOVACAO];
    if (!token) return resposta.code(401).send({ erro: 'Entre para continuar.' });

    const renovada = await renovarSessao(token);
    if (!renovada) {
      return resposta
        .clearCookie(COOKIE_DE_RENOVACAO, cookie)
        .code(401)
        .send({ erro: 'Sua sessão expirou. Entre de novo.' });
    }

    return resposta.setCookie(COOKIE_DE_RENOVACAO, renovada.token, cookie).send({
      acesso: app.emitirAcesso({
        sub: renovada.usuarioId,
        papel: renovada.papel,
        aparelho: renovada.aparelhoId ?? '',
      }),
    });
  });

  // ─── Sair ────────────────────────────────────────────────────────────────
  app.post('/api/acesso/sair', async (requisicao, resposta) => {
    const token = requisicao.cookies[COOKIE_DE_RENOVACAO];
    if (token) await revogarSessao(token);

    return resposta.clearCookie(COOKIE_DE_RENOVACAO, cookie).send({ ok: true });
  });

  // ─── Quem sou eu ─────────────────────────────────────────────────────────
  app.get('/api/acesso/eu', { preHandler: app.exigirLogin }, async (requisicao, resposta) => {
    const usuario = await banco.usuario.findUnique({
      where: { id: requisicao.user.sub },
      select: {
        id: true,
        email: true,
        apelido: true,
        nome: true,
        avatar: true,
        papel: true,
        criadoEm: true,
        desativadoEm: true,
      },
    });

    if (!usuario || usuario.desativadoEm) {
      return resposta.code(401).send({ erro: 'Conta indisponível.' });
    }

    const { desativadoEm: _, ...dados } = usuario;
    return { ...dados, aparelhoId: requisicao.user.aparelho };
  });

  // ─── Registrar as chaves deste aparelho ──────────────────────────────────
  // Chamado logo depois do login, quando o navegador termina de gerar o par
  // de chaves. Só as públicas chegam aqui.
  const chavesSchema = z.object({
    assinatura: z.string().regex(/^[A-Za-z0-9_-]+$/),
    troca: z.string().regex(/^[A-Za-z0-9_-]+$/),
    nome: z.string().trim().min(1).max(60).optional(),
  });

  app.post(
    '/api/acesso/aparelho/chaves',
    { preHandler: app.exigirLogin },
    async (requisicao, resposta) => {
      const dados = chavesSchema.safeParse(requisicao.body);
      if (!dados.success) return resposta.code(400).send({ erro: 'Chaves inválidas.' });

      const aparelho = await banco.aparelho.findFirst({
        where: { id: requisicao.user.aparelho, usuarioId: requisicao.user.sub },
      });
      if (!aparelho) return resposta.code(404).send({ erro: 'Aparelho não encontrado.' });
      if (aparelho.revogadoEm)
        return resposta.code(403).send({ erro: 'Este aparelho foi revogado.' });

      // As chaves só podem ser gravadas uma vez. Deixar trocá-las permitiria a
      // quem roubasse uma sessão substituir a identidade do aparelho e passar a
      // receber as chaves das conversas.
      if (aparelho.chavePublicaDeTroca) {
        return resposta.code(409).send({ erro: 'Este aparelho já tem chaves registradas.' });
      }

      await banco.aparelho.update({
        where: { id: aparelho.id },
        data: {
          chavePublicaDeAssinatura: dados.data.assinatura,
          chavePublicaDeTroca: dados.data.troca,
          ...(dados.data.nome ? { nome: dados.data.nome } : {}),
        },
      });

      await anotar(requisicao.user.sub, 'aparelho.chaves-registradas', requisicao.ip);
      return { ok: true };
    },
  );
}
