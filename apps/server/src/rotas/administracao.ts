import { randomBytes } from 'node:crypto';
import { criarConviteSchema } from '@rede/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../banco.js';
import { revogarTudo } from '../acesso/sessoes.js';

/**
 * Convites, membros e aparelhos.
 *
 * O painel de quem administra a rede. Tudo aqui exige `exigirAdmin`, com uma
 * exceção declarada: cada pessoa administra os **próprios** aparelhos, então
 * essas rotas pedem só login.
 */

/**
 * Gera um código de convite legível em voz alta.
 *
 * O alfabeto não tem `O`, `0`, `I`, `1` nem `L`: são os pares que as pessoas
 * confundem ao ler um código para alguém pelo telefone. Sobram 31 símbolos, e
 * 12 deles dão cerca de 59 bits — bem além do que qualquer força bruta alcança
 * num convite que vence em dias.
 */
function gerarCodigo(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  const letras = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]);
  return `${letras.slice(0, 4).join('')}-${letras.slice(4, 8).join('')}-${letras.slice(8, 12).join('')}`;
}

export function rotasDeAdministracao(app: FastifyInstance): void {
  // ─── Convites ────────────────────────────────────────────────────────────

  app.post('/api/convites', { preHandler: app.exigirAdmin }, async (requisicao, resposta) => {
    const dados = criarConviteSchema.safeParse(requisicao.body ?? {});
    if (!dados.success) {
      return resposta
        .code(400)
        .send({ erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' });
    }

    const { usos, validadeEmDias, observacao } = dados.data;

    const convite = await banco.convite.create({
      data: {
        codigo: gerarCodigo(),
        criadoPorId: requisicao.user.sub,
        usosRestantes: usos,
        expiraEm: new Date(Date.now() + validadeEmDias * 86_400_000),
        ...(observacao ? { observacao } : {}),
      },
    });

    await banco.registro.create({
      data: { usuarioId: requisicao.user.sub, acao: 'convite.criado', endereco: requisicao.ip },
    });

    return resposta.code(201).send({
      codigo: convite.codigo,
      usosRestantes: convite.usosRestantes,
      expiraEm: convite.expiraEm,
      observacao: convite.observacao,
    });
  });

  app.get('/api/convites', { preHandler: app.exigirAdmin }, async () => {
    const convites = await banco.convite.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 50,
      include: {
        usadoPor: { select: { apelido: true, nome: true } },
        criadoPor: { select: { apelido: true } },
      },
    });

    const agora = new Date();
    return convites.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      usosRestantes: c.usosRestantes,
      expiraEm: c.expiraEm,
      observacao: c.observacao,
      criadoEm: c.criadoEm,
      criadoPor: c.criadoPor?.apelido ?? null,
      usadoPor: c.usadoPor.map((u) => ({ apelido: u.apelido, nome: u.nome })),
      vale: !c.revogadoEm && c.usosRestantes > 0 && c.expiraEm > agora,
    }));
  });

  app.delete('/api/convites/:id', { preHandler: app.exigirAdmin }, async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };

    const { count } = await banco.convite.updateMany({
      where: { id, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });

    if (count === 0) return resposta.code(404).send({ erro: 'Convite não encontrado.' });

    await banco.registro.create({
      data: { usuarioId: requisicao.user.sub, acao: 'convite.revogado', endereco: requisicao.ip },
    });

    return { ok: true };
  });

  // ─── Membros ─────────────────────────────────────────────────────────────

  app.get('/api/membros', { preHandler: app.exigirLogin }, async () => {
    const membros = await banco.usuario.findMany({
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        apelido: true,
        nome: true,
        avatar: true,
        papel: true,
        criadoEm: true,
        vistoPorUltimoEm: true,
        desativadoEm: true,
      },
    });

    // O e-mail fica de fora de propósito: para conversar, o apelido basta, e
    // uma lista de e-mails é exatamente o que não se quer entregar a quem
    // comprometer uma conta qualquer.
    return membros.map(({ desativadoEm, ...m }) => ({ ...m, ativo: !desativadoEm }));
  });

  app.post(
    '/api/membros/:id/desativar',
    { preHandler: app.exigirAdmin },
    async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };

      if (id === requisicao.user.sub) {
        return resposta.code(400).send({ erro: 'Você não pode desativar a si mesmo.' });
      }

      const alvo = await banco.usuario.findUnique({ where: { id } });
      if (!alvo) return resposta.code(404).send({ erro: 'Membro não encontrado.' });

      // Nunca deixar a rede sem administrador: sem ninguém para gerar convites
      // ou reativar contas, ela vira um beco sem saída.
      if (alvo.papel === 'ADMIN') {
        const admins = await banco.usuario.count({
          where: { papel: 'ADMIN', desativadoEm: null },
        });
        if (admins <= 1) {
          return resposta
            .code(400)
            .send({ erro: 'Esta é a última pessoa que administra a rede. Promova outra antes.' });
        }
      }

      await banco.usuario.update({ where: { id }, data: { desativadoEm: new Date() } });
      await revogarTudo(id);

      await banco.registro.create({
        data: {
          usuarioId: requisicao.user.sub,
          acao: 'membro.desativado',
          endereco: requisicao.ip,
          detalhe: { alvo: alvo.apelido },
        },
      });

      return { ok: true };
    },
  );

  app.post(
    '/api/membros/:id/reativar',
    { preHandler: app.exigirAdmin },
    async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };

      const { count } = await banco.usuario.updateMany({
        where: { id, desativadoEm: { not: null } },
        data: { desativadoEm: null },
      });

      if (count === 0) return resposta.code(404).send({ erro: 'Membro não encontrado.' });

      await banco.registro.create({
        data: { usuarioId: requisicao.user.sub, acao: 'membro.reativado', endereco: requisicao.ip },
      });

      return { ok: true };
    },
  );

  // ─── Aparelhos ───────────────────────────────────────────────────────────
  // Cada pessoa cuida dos seus. Não precisa de administrador para tirar do ar
  // o celular que você perdeu — precisa é de pressa.

  app.get('/api/aparelhos', { preHandler: app.exigirLogin }, async (requisicao) => {
    const aparelhos = await banco.aparelho.findMany({
      where: { usuarioId: requisicao.user.sub },
      orderBy: { criadoEm: 'desc' },
      include: {
        sessoes: {
          where: { revogadoEm: null, expiraEm: { gt: new Date() } },
          select: { id: true, criadoEm: true, descricao: true },
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
      },
    });

    return aparelhos.map((a) => ({
      id: a.id,
      nome: a.nome,
      criadoEm: a.criadoEm,
      usadoEm: a.usadoEm,
      revogado: a.revogadoEm !== null,
      esteAqui: a.id === requisicao.user.aparelho,
      sessaoAtiva: a.sessoes.length > 0,
      descricao: a.sessoes[0]?.descricao ?? null,
    }));
  });

  const revogarSchema = z.object({ motivo: z.string().trim().max(120).optional() });

  app.post(
    '/api/aparelhos/:id/revogar',
    { preHandler: app.exigirLogin },
    async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const dados = revogarSchema.safeParse(requisicao.body ?? {});

      const aparelho = await banco.aparelho.findFirst({
        where: { id, usuarioId: requisicao.user.sub },
      });
      if (!aparelho) return resposta.code(404).send({ erro: 'Aparelho não encontrado.' });
      if (aparelho.revogadoEm) return { ok: true, jaEstava: true };

      await banco.aparelho.update({
        where: { id },
        data: {
          revogadoEm: new Date(),
          ...(dados.success && dados.data.motivo ? { motivoRevogacao: dados.data.motivo } : {}),
        },
      });

      const sessoes = await revogarTudo(requisicao.user.sub, id);

      await banco.registro.create({
        data: {
          usuarioId: requisicao.user.sub,
          acao: 'aparelho.revogado',
          endereco: requisicao.ip,
          detalhe: { aparelho: aparelho.nome, sessoes },
        },
      });

      // A revogação derruba as sessões na hora. A partir da Fase 2 ela também
      // gira a época das conversas, para que este aparelho não receba mais
      // nenhuma chave nova — é isso que corta o acesso ao que vier depois.
      return { ok: true, sessoesDerrubadas: sessoes };
    },
  );

  app.post('/api/aparelhos/sair-de-tudo', { preHandler: app.exigirLogin }, async (requisicao) => {
    const derrubadas = await revogarTudo(requisicao.user.sub);

    await banco.registro.create({
      data: {
        usuarioId: requisicao.user.sub,
        acao: 'sessoes.todas-revogadas',
        endereco: requisicao.ip,
      },
    });

    return { ok: true, derrubadas };
  });
}
