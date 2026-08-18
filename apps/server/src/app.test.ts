import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarApp } from './app.js';
import { carregarConfig } from './config.js';

// O banco não sobe nos testes: só nos interessa que a rota se comporte bem
// quando ele responde e quando ele está fora.
const bancoRespondendo = vi.hoisted(() => ({ valor: true }));
vi.mock('./banco.js', () => ({
  banco: {},
  bancoResponde: async () => bancoRespondendo.valor,
}));

const ambiente = {
  NODE_ENV: 'test',
  NOME_DA_REDE: 'Rede de Teste',
  DOMINIO: 'teste.local',
  DATABASE_URL: 'postgresql://teste@localhost:5432/teste',
  JWT_SECRET: 'a'.repeat(43),
  COOKIE_SECRET: 'b'.repeat(43),
  MEDIA_ENCRYPTION_KEY: 'c'.repeat(43),
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp(carregarConfig(ambiente as unknown as NodeJS.ProcessEnv));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('configuração', () => {
  it('recusa um segredo curto demais em vez de subir inseguro', () => {
    const sair = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('saiu');
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      carregarConfig({ ...ambiente, JWT_SECRET: 'curto' } as unknown as NodeJS.ProcessEnv),
    ).toThrow('saiu');

    sair.mockRestore();
    vi.restoreAllMocks();
  });

  it('aceita a configuração completa e calcula o limite de upload', () => {
    const config = carregarConfig({
      ...ambiente,
      TAMANHO_MAXIMO_UPLOAD_MB: '50',
    } as unknown as NodeJS.ProcessEnv);

    expect(config.tamanhoMaximoUploadEmBytes).toBe(50 * 1024 * 1024);
    expect(config.emProducao).toBe(false);
  });
});

describe('/api/saude', () => {
  it('responde que está tudo bem quando o banco responde', async () => {
    bancoRespondendo.valor = true;

    const resposta = await app.inject({ method: 'GET', url: '/api/saude' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      ok: true,
      nome: 'Rede de Teste',
      banco: 'ok',
    });
  });

  it('responde 503 quando o banco está fora', async () => {
    bancoRespondendo.valor = false;

    const resposta = await app.inject({ method: 'GET', url: '/api/saude' });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toMatchObject({ ok: false, banco: 'fora' });
  });

  it('não vaza detalhe interno na resposta pública', async () => {
    bancoRespondendo.valor = false;

    const corpo = (await app.inject({ method: 'GET', url: '/api/saude' })).body;

    expect(corpo).not.toContain('postgresql://');
    expect(corpo).not.toContain(ambiente.JWT_SECRET);
    expect(corpo).not.toContain('Error');
  });

  it('reconhece HTTPS pelo cabeçalho que o Caddy repassa', async () => {
    bancoRespondendo.valor = true;

    const semHttps = await app.inject({
      method: 'GET',
      url: '/api/saude',
      headers: { host: 'pc.exemplo.ts.net' },
    });
    const comHttps = await app.inject({
      method: 'GET',
      url: '/api/saude',
      headers: { host: 'pc.exemplo.ts.net', 'x-forwarded-proto': 'https' },
    });

    expect(semHttps.json().contextoSeguro).toBe(false);
    expect(comHttps.json().contextoSeguro).toBe(true);
  });
});

describe('proteções', () => {
  it('devolve 404 em JSON, sem página de erro que revele o servidor', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Não encontrado.' });
  });

  it('manda os cabeçalhos de segurança do helmet', async () => {
    const { headers } = await app.inject({ method: 'GET', url: '/api/saude' });

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    // O libsodium roda em WebAssembly — sem isto, a criptografia não carrega.
    expect(headers['content-security-policy']).toContain("'wasm-unsafe-eval'");
  });
});
