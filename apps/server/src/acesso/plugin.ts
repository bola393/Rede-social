import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import type { Cracha } from './sessoes.js';
import { DURACAO_DO_ACESSO } from './sessoes.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Exige um token de acesso válido. Use como `preHandler`. */
    exigirLogin: (requisicao: FastifyRequest, resposta: FastifyReply) => Promise<void>;
    /** Exige que quem chamou seja administrador da rede. */
    exigirAdmin: (requisicao: FastifyRequest, resposta: FastifyReply) => Promise<void>;
    /** Emite um token de acesso para um crachá. */
    emitirAcesso: (cracha: Cracha) => string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Cracha;
    user: Cracha;
  }
}

/**
 * Liga a autenticação por token no servidor.
 *
 * Deixa disponíveis dois guardas — `exigirLogin` e `exigirAdmin` — que qualquer
 * rota pode pendurar no `preHandler`. Fazendo assim, esquecer de proteger uma
 * rota vira uma omissão visível na declaração dela, e não um `if` perdido no
 * meio do código.
 */
export async function registrarAcesso(app: FastifyInstance, config: Config): Promise<void> {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: DURACAO_DO_ACESSO },
  });

  app.decorate('emitirAcesso', (cracha: Cracha) => app.jwt.sign(cracha));

  app.decorate('exigirLogin', async (requisicao: FastifyRequest, resposta: FastifyReply) => {
    try {
      await requisicao.jwtVerify();
    } catch {
      // Sempre a mesma resposta, seja o token ausente, malformado ou vencido.
      // A interface trata 401 como "vá renovar", então distinguir não ajudaria
      // ninguém além de quem estivesse sondando.
      await resposta.code(401).send({ erro: 'Entre para continuar.' });
    }
  });

  app.decorate('exigirAdmin', async (requisicao: FastifyRequest, resposta: FastifyReply) => {
    try {
      await requisicao.jwtVerify();
    } catch {
      await resposta.code(401).send({ erro: 'Entre para continuar.' });
      return;
    }

    if (requisicao.user.papel !== 'ADMIN') {
      // 403 e não 404: quem está logado já sabe que a rota existe, então
      // esconder não protege nada e só confunde.
      await resposta.code(403).send({ erro: 'Só quem administra a rede pode fazer isso.' });
    }
  });
}
