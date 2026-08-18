import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { rotasDeSaude } from './rotas/saude.js';

/**
 * Monta o servidor com as proteções de sempre ligadas.
 *
 * Separado do `index.ts` para que os testes consigam levantar o servidor sem
 * abrir porta nenhuma.
 */
export async function criarApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.emProducao ? 'info' : 'debug',
      transport: config.emProducao ? undefined : { target: 'pino-pretty' },
      // Nunca registrar cabeçalho de autenticação nem cookie: log vaza fácil,
      // e um token no log é um token comprometido.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // O Caddy fica na frente. Sem isto, todo mundo apareceria vindo do IP dele,
    // e o limite de tentativas por IP viraria um limite global.
    trustProxy: true,
    bodyLimit: config.tamanhoMaximoUploadEmBytes,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // WebAssembly do libsodium precisa disto.
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // blob: é como as mídias decifradas chegam à tela — elas nunca passam
        // por uma URL do servidor já abertas.
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // O app Android carrega a interface de dentro do próprio APK e conversa com
    // o servidor por outra origem; bloquear isso quebraria o app.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cookie, { secret: config.COOKIE_SECRET });

  await app.register(cors, {
    origin: config.emProducao
      ? [`https://${config.DOMINIO}`, 'https://localhost', 'capacitor://localhost']
      : true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // A saúde é consultada a todo momento pelo diagnóstico e pela tela inicial.
    allowList: (requisicao) => requisicao.url === '/api/saude',
  });

  rotasDeSaude(app, config);

  app.setNotFoundHandler((_requisicao, resposta) => {
    resposta.code(404).send({ erro: 'Não encontrado.' });
  });

  app.setErrorHandler((erro, requisicao, resposta) => {
    requisicao.log.error({ erro }, 'Falha ao atender a requisição');

    // Em produção, a mensagem crua do erro pode revelar caminho de arquivo,
    // versão de biblioteca e até trecho de consulta. Fica no log, não na resposta.
    const status = erro.statusCode ?? 500;
    const mensagem =
      status >= 500 && config.emProducao ? 'Algo deu errado aqui dentro.' : erro.message;

    resposta.code(status).send({ erro: mensagem });
  });

  return app;
}
