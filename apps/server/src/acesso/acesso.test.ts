import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  gerarChaveDeConversa,
  gerarFraseDeRecuperacao,
  gerarIdentidade,
  chaveMestraDaFrase,
  inicializar,
  partePublica,
} from '@rede/crypto';
import { criarApp } from '../app.js';
import { carregarConfig } from '../config.js';
import { banco } from '../banco.js';

/**
 * Testes de acesso contra um banco de verdade.
 *
 * Nada de fingir o banco aqui: metade do que pode dar errado neste código são
 * as restrições do próprio Postgres — unicidade de e-mail, transações que
 * precisam desfazer tudo, decremento de convite sob concorrência. Um banco de
 * mentira concordaria com qualquer coisa.
 */

const ambiente = {
  NODE_ENV: 'test',
  NOME_DA_REDE: 'Rede de Teste',
  DOMINIO: 'teste.local',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: 'j'.repeat(43),
  COOKIE_SECRET: 'c'.repeat(43),
  MEDIA_ENCRYPTION_KEY: 'm'.repeat(43),
  // Os testes vêm todos do mesmo IP, então o limite real de 10 barraria a
  // própria suíte. Há um teste dedicado, mais abaixo, que sobe um servidor com
  // o limite apertado e prova que ele funciona.
  LIMITE_DE_TENTATIVAS: '9999',
};

let app: FastifyInstance;

/** Monta o que um aparelho de verdade mandaria no cadastro. */
function dadosDeCadastro(convite: string, sufixo = '') {
  const identidade = gerarIdentidade();
  const frase = gerarFraseDeRecuperacao();

  return {
    convite,
    email: `ana${sufixo}@exemplo.com`,
    apelido: `ana${sufixo}`,
    nome: 'Ana',
    senha: 'uma frase de senha bem comprida',
    nomeDoAparelho: 'Celular da Ana',
    identidade: partePublica(identidade),
    chaveDeRecuperacao: chaveMestraDaFrase(frase).publica,
  };
}

async function criarConvite(usos = 1, dias = 7): Promise<string> {
  const codigo = `TEST-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  await banco.convite.create({
    data: { codigo, usosRestantes: usos, expiraEm: new Date(Date.now() + dias * 86_400_000) },
  });
  return codigo;
}

async function limparTudo(): Promise<void> {
  await banco.registro.deleteMany();
  await banco.sessao.deleteMany();
  await banco.aparelho.deleteMany();
  await banco.membroDoCirculo.deleteMany();
  await banco.usuario.deleteMany();
  await banco.convite.deleteMany();
}

beforeAll(async () => {
  await inicializar();
  app = await criarApp(carregarConfig(ambiente as unknown as NodeJS.ProcessEnv));
  await app.ready();
});

beforeEach(limparTudo);

afterAll(async () => {
  await limparTudo();
  await app.close();
  await banco.$disconnect();
});

describe('cadastro', () => {
  it('aceita um convite válido e cria a conta', async () => {
    const convite = await criarConvite();

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite),
    });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().eu).toMatchObject({ apelido: 'ana', papel: 'ADMIN' });
    expect(resposta.json().acesso).toBeTruthy();
    // O cookie de renovação precisa ser inacessível ao JavaScript da página.
    expect(resposta.headers['set-cookie']?.toString()).toContain('HttpOnly');
  });

  it('recusa quem não tem convite', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro('CODIGO-QUE-NAO-EXISTE'),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().campo).toBe('convite');
    expect(await banco.usuario.count()).toBe(0);
  });

  it('recusa convite vencido, esgotado e revogado com o mesmo texto', async () => {
    const vencido = 'AAAA-BBBB-CCCC';
    await banco.convite.create({
      data: { codigo: vencido, usosRestantes: 5, expiraEm: new Date(Date.now() - 1000) },
    });

    const esgotado = 'DDDD-EEEE-FFFF';
    await banco.convite.create({
      data: { codigo: esgotado, usosRestantes: 0, expiraEm: new Date(Date.now() + 86_400_000) },
    });

    const revogado = 'GGGG-HHHH-JJJJ';
    await banco.convite.create({
      data: {
        codigo: revogado,
        usosRestantes: 5,
        expiraEm: new Date(Date.now() + 86_400_000),
        revogadoEm: new Date(),
      },
    });

    const respostas = await Promise.all(
      [vencido, esgotado, revogado, 'NAO-EXISTE-NAO'].map((codigo, i) =>
        app.inject({
          method: 'POST',
          url: '/api/acesso/cadastrar',
          payload: dadosDeCadastro(codigo, String(i)),
        }),
      ),
    );

    // Todos com a mesma mensagem: distinguir permitiria descobrir códigos
    // válidos por tentativa e erro.
    const mensagens = new Set(respostas.map((r) => r.json().erro));
    expect(mensagens.size).toBe(1);
    expect(await banco.usuario.count()).toBe(0);
  });

  it('gasta um uso do convite, e só um', async () => {
    const convite = await criarConvite(2);

    await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite, '1'),
    });

    const depois = await banco.convite.findUnique({ where: { codigo: convite } });
    expect(depois?.usosRestantes).toBe(1);
  });

  it('a primeira pessoa administra, a segunda não', async () => {
    const convite = await criarConvite(2);

    const primeira = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite, '1'),
    });
    const segunda = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite, '2'),
    });

    expect(primeira.json().eu.papel).toBe('ADMIN');
    expect(segunda.json().eu.papel).toBe('MEMBRO');
  });

  it('recusa e-mail e apelido repetidos', async () => {
    const convite = await criarConvite(5);
    await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite),
    });

    const mesmoEmail = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: { ...dadosDeCadastro(convite), apelido: 'outro' },
    });
    const mesmoApelido = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: { ...dadosDeCadastro(convite), email: 'outro@exemplo.com' },
    });

    expect(mesmoEmail.statusCode).toBe(409);
    expect(mesmoEmail.json().campo).toBe('email');
    expect(mesmoApelido.statusCode).toBe(409);
    expect(mesmoApelido.json().campo).toBe('apelido');
  });

  it('recusa senha curta', async () => {
    const convite = await criarConvite();

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: { ...dadosDeCadastro(convite), senha: 'curta123' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(await banco.usuario.count()).toBe(0);
  });

  it('nunca guarda a senha, só o hash Argon2id', async () => {
    const convite = await criarConvite();
    const dados = dadosDeCadastro(convite);

    await app.inject({ method: 'POST', url: '/api/acesso/cadastrar', payload: dados });

    const usuario = await banco.usuario.findUnique({ where: { email: dados.email } });
    expect(usuario!.senhaHash).not.toContain(dados.senha);
    expect(usuario!.senhaHash.startsWith('$argon2id$')).toBe(true);
  });

  it('guarda só as chaves públicas do aparelho', async () => {
    const convite = await criarConvite();
    const identidade = gerarIdentidade();
    const dados = { ...dadosDeCadastro(convite), identidade: partePublica(identidade) };

    await app.inject({ method: 'POST', url: '/api/acesso/cadastrar', payload: dados });

    const tudoQueOBancoGuardou = JSON.stringify(await banco.aparelho.findMany());
    expect(tudoQueOBancoGuardou).toContain(identidade.troca.publica);
    expect(tudoQueOBancoGuardou).not.toContain(identidade.troca.privada);
    expect(tudoQueOBancoGuardou).not.toContain(identidade.assinatura.privada);
  });

  it('põe a pessoa nos círculos que existirem', async () => {
    await banco.circulo.upsert({
      where: { nome: 'Casal' },
      update: {},
      create: { nome: 'Casal' },
    });
    const convite = await criarConvite();

    await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite),
    });

    expect(await banco.membroDoCirculo.count()).toBeGreaterThan(0);
  });
});

describe('login', () => {
  async function contaPronta(sufixo = '') {
    const convite = await criarConvite();
    const dados = dadosDeCadastro(convite, sufixo);
    await app.inject({ method: 'POST', url: '/api/acesso/cadastrar', payload: dados });
    return dados;
  }

  it('entra com a senha certa', async () => {
    const { email, senha } = await contaPronta();

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email, senha },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().eu.email).toBe(email);
  });

  it('recusa senha errada e e-mail inexistente com a mesma resposta', async () => {
    const { email } = await contaPronta();

    const senhaErrada = await app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email, senha: 'senha completamente errada' },
    });
    const semConta = await app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email: 'ninguem@exemplo.com', senha: 'senha completamente errada' },
    });

    expect(senhaErrada.statusCode).toBe(401);
    expect(semConta.statusCode).toBe(401);
    // Igual no texto: senão dá para descobrir quem tem conta na rede.
    expect(senhaErrada.json().erro).toBe(semConta.json().erro);
  });

  it('não deixa entrar quem foi desativado', async () => {
    const { email, senha } = await contaPronta();
    await banco.usuario.update({ where: { email }, data: { desativadoEm: new Date() } });

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email, senha },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('cria um aparelho novo a cada entrada', async () => {
    const { email, senha } = await contaPronta();

    await app.inject({ method: 'POST', url: '/api/acesso/entrar', payload: { email, senha } });
    await app.inject({ method: 'POST', url: '/api/acesso/entrar', payload: { email, senha } });

    // Um do cadastro mais dois dos logins.
    expect(await banco.aparelho.count()).toBe(3);
  });
});

describe('sessão', () => {
  async function entrar() {
    const convite = await criarConvite();
    const dados = dadosDeCadastro(convite);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dados,
    });
    return {
      acesso: resposta.json().acesso as string,
      renovacao: resposta.cookies.find((c) => c.name === 'renovacao')!.value,
    };
  }

  it('/eu responde com o token e recusa sem ele', async () => {
    const { acesso } = await entrar();

    const com = await app.inject({
      method: 'GET',
      url: '/api/acesso/eu',
      headers: { authorization: `Bearer ${acesso}` },
    });
    const sem = await app.inject({ method: 'GET', url: '/api/acesso/eu' });

    expect(com.statusCode).toBe(200);
    expect(com.json().apelido).toBe('ana');
    expect(sem.statusCode).toBe(401);
  });

  it('recusa um token adulterado', async () => {
    const { acesso } = await entrar();
    const mexido = `${acesso.slice(0, -4)}AAAA`;

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/acesso/eu',
      headers: { authorization: `Bearer ${mexido}` },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('renova e queima o token antigo', async () => {
    const { renovacao } = await entrar();

    const primeira = await app.inject({
      method: 'POST',
      url: '/api/acesso/renovar',
      cookies: { renovacao },
    });
    expect(primeira.statusCode).toBe(200);

    // Reusar o token antigo é exatamente o que um ladrão faria. Tem que falhar.
    const denovo = await app.inject({
      method: 'POST',
      url: '/api/acesso/renovar',
      cookies: { renovacao },
    });
    expect(denovo.statusCode).toBe(401);
  });

  it('o token de renovação nunca é guardado em claro', async () => {
    const { renovacao } = await entrar();

    const sessoes = await banco.sessao.findMany();
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]!.tokenHash).not.toBe(renovacao);
    expect(JSON.stringify(sessoes)).not.toContain(renovacao);
  });

  it('sair derruba a sessão', async () => {
    const { renovacao } = await entrar();

    await app.inject({ method: 'POST', url: '/api/acesso/sair', cookies: { renovacao } });

    const depois = await app.inject({
      method: 'POST',
      url: '/api/acesso/renovar',
      cookies: { renovacao },
    });
    expect(depois.statusCode).toBe(401);
  });
});

describe('convites e administração', () => {
  async function entrarComoAdmin() {
    const convite = await criarConvite();
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(convite),
    });
    return resposta.json().acesso as string;
  }

  it('quem administra gera convite; quem não administra, não', async () => {
    const admin = await entrarComoAdmin();

    const criado = await app.inject({
      method: 'POST',
      url: '/api/convites',
      headers: { authorization: `Bearer ${admin}` },
      payload: { usos: 2, validadeEmDias: 14 },
    });

    expect(criado.statusCode).toBe(201);
    // O código precisa ser ditável por telefone, sem letras que se confundem.
    expect(criado.json().codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(criado.json().codigo).not.toMatch(/[OI01L]/);

    // Agora um membro comum tenta o mesmo.
    const membro = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: dadosDeCadastro(criado.json().codigo, '2'),
    });
    const recusado = await app.inject({
      method: 'POST',
      url: '/api/convites',
      headers: { authorization: `Bearer ${membro.json().acesso}` },
      payload: {},
    });

    expect(recusado.statusCode).toBe(403);
  });

  it('exige login para ver os convites', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/convites' });
    expect(resposta.statusCode).toBe(401);
  });

  it('a lista de membros não entrega os e-mails', async () => {
    const admin = await entrarComoAdmin();

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/membros',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).not.toContain('@exemplo.com');
    expect(resposta.json()[0]).toMatchObject({ apelido: 'ana', ativo: true });
  });

  it('não deixa a rede ficar sem quem administre', async () => {
    const admin = await entrarComoAdmin();
    const eu = await app.inject({
      method: 'GET',
      url: '/api/acesso/eu',
      headers: { authorization: `Bearer ${admin}` },
    });

    const resposta = await app.inject({
      method: 'POST',
      url: `/api/membros/${eu.json().id}/desativar`,
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(resposta.statusCode).toBe(400);
  });
});

describe('aparelhos', () => {
  let contador = 0;

  async function entrar() {
    const convite = await criarConvite();
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      // Sufixo diferente a cada chamada: duas contas na mesma conversa não
      // podem colidir em e-mail nem em apelido.
      payload: dadosDeCadastro(convite, String(++contador)),
    });
    return {
      acesso: resposta.json().acesso as string,
      renovacao: resposta.cookies.find((c) => c.name === 'renovacao')!.value,
      aparelhoId: resposta.json().eu.aparelhoId as string,
    };
  }

  it('lista os aparelhos e marca qual é este', async () => {
    const { acesso, aparelhoId } = await entrar();

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/aparelhos',
      headers: { authorization: `Bearer ${acesso}` },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toHaveLength(1);
    expect(resposta.json()[0]).toMatchObject({ id: aparelhoId, esteAqui: true, revogado: false });
  });

  it('revogar um aparelho derruba a sessão dele na hora', async () => {
    const { acesso, renovacao, aparelhoId } = await entrar();

    const revogado = await app.inject({
      method: 'POST',
      url: `/api/aparelhos/${aparelhoId}/revogar`,
      headers: { authorization: `Bearer ${acesso}` },
      payload: { motivo: 'perdi o celular' },
    });

    expect(revogado.statusCode).toBe(200);
    expect(revogado.json().sessoesDerrubadas).toBe(1);

    // Sem poder renovar, o acesso de 15 minutos morre sozinho.
    const tentaRenovar = await app.inject({
      method: 'POST',
      url: '/api/acesso/renovar',
      cookies: { renovacao },
    });
    expect(tentaRenovar.statusCode).toBe(401);
  });

  it('não deixa revogar aparelho de outra pessoa', async () => {
    const primeira = await entrar();
    const segunda = await entrar();

    const resposta = await app.inject({
      method: 'POST',
      url: `/api/aparelhos/${segunda.aparelhoId}/revogar`,
      headers: { authorization: `Bearer ${primeira.acesso}` },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('as chaves de um aparelho só podem ser gravadas uma vez', async () => {
    const { acesso } = await entrar();
    const outra = gerarIdentidade();

    // O cadastro já gravou as chaves. Tentar trocá-las é o que faria quem
    // roubasse a sessão para desviar as chaves das conversas.
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/aparelho/chaves',
      headers: { authorization: `Bearer ${acesso}` },
      payload: partePublica(outra),
    });

    expect(resposta.statusCode).toBe(409);
  });

  it('um aparelho que entrou por login consegue gravar as chaves depois', async () => {
    const convite = await criarConvite();
    const dados = dadosDeCadastro(convite);
    await app.inject({ method: 'POST', url: '/api/acesso/cadastrar', payload: dados });

    const login = await app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email: dados.email, senha: dados.senha, nomeDoAparelho: 'Notebook' },
    });

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/acesso/aparelho/chaves',
      headers: { authorization: `Bearer ${login.json().acesso}` },
      payload: partePublica(gerarIdentidade()),
    });

    expect(resposta.statusCode).toBe(200);
  });
});

describe('a promessa do servidor cego', () => {
  it('nada no banco permite decifrar uma conversa', async () => {
    const convite = await criarConvite();
    const identidade = gerarIdentidade();
    const frase = gerarFraseDeRecuperacao();
    const chaveDaConversa = gerarChaveDeConversa();

    await app.inject({
      method: 'POST',
      url: '/api/acesso/cadastrar',
      payload: {
        ...dadosDeCadastro(convite),
        identidade: partePublica(identidade),
        chaveDeRecuperacao: chaveMestraDaFrase(frase).publica,
      },
    });

    const tudo = JSON.stringify({
      usuarios: await banco.usuario.findMany(),
      aparelhos: await banco.aparelho.findMany(),
      sessoes: await banco.sessao.findMany(),
      registros: await banco.registro.findMany(),
    });

    expect(tudo).not.toContain(identidade.troca.privada);
    expect(tudo).not.toContain(identidade.assinatura.privada);
    expect(tudo).not.toContain(chaveMestraDaFrase(frase).privada);
    expect(tudo).not.toContain(chaveDaConversa.chave);
    expect(tudo).not.toContain(frase);
    expect(tudo).not.toContain('uma frase de senha bem comprida');
  });
});

describe('limite de tentativas', () => {
  it('barra força bruta depois de poucas tentativas', async () => {
    // Um servidor à parte, com o limite no valor de produção.
    const apertado = await criarApp(
      carregarConfig({ ...ambiente, LIMITE_DE_TENTATIVAS: '3' } as unknown as NodeJS.ProcessEnv),
    );
    await apertado.ready();

    const tentar = () =>
      apertado.inject({
        method: 'POST',
        url: '/api/acesso/entrar',
        payload: { email: 'alvo@exemplo.com', senha: 'chute' },
      });

    const codigos: number[] = [];
    for (let i = 0; i < 5; i++) codigos.push((await tentar()).statusCode);

    // As primeiras são recusadas por senha errada; as seguintes nem chegam lá.
    expect(codigos.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codigos.slice(3)).toEqual([429, 429]);

    await apertado.close();
  });
});
