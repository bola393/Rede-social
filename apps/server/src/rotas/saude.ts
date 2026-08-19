import type { FastifyInstance } from 'fastify';
import type { Saude } from '@rede/shared';
import { bancoResponde } from '../banco.js';
import type { Config } from '../config.js';

const arranque = Date.now();

/**
 * `/api/saude` — a rota que diz se a rede está de pé.
 *
 * Não exige login de propósito: ela é chamada justamente quando as coisas estão
 * quebradas, e exigir uma sessão válida para descobrir que o banco caiu seria
 * uma piada de mau gosto.
 *
 * Por ser pública, ela responde **se** algo funciona, nunca **por quê** falhou.
 * "banco: fora" já basta para o diagnóstico; o texto do erro do Postgres ficaria
 * bem melhor no log do servidor do que na internet.
 */
export function rotasDeSaude(app: FastifyInstance, config: Config): void {
  app.get('/api/saude', async (requisicao, resposta): Promise<Saude> => {
    const banco = await bancoResponde();

    // Atrás do Caddy, quem sabe se veio por HTTPS é o cabeçalho que ele repassa.
    const protocolo = requisicao.headers['x-forwarded-proto'] ?? requisicao.protocol;
    const contextoSeguro = protocolo === 'https' || requisicao.hostname.startsWith('localhost');

    resposta.header('cache-control', 'no-store');
    if (!banco) resposta.code(503);

    return {
      ok: banco,
      nome: config.NOME_DA_REDE,
      versao: process.env.npm_package_version ?? '0.1.0',
      noArHa: Math.floor((Date.now() - arranque) / 1000),
      banco: banco ? 'ok' : 'fora',
      contextoSeguro,
    };
  });
}
