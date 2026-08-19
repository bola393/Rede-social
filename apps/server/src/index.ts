import { criarApp } from './app.js';
import { banco } from './banco.js';
import { carregarConfig } from './config.js';
import { carregarEnvLocal } from './env-local.js';

// Fora de container, a configuração vem do .env da raiz. Dentro, ela já chegou
// pelo docker-compose e esta chamada não encontra arquivo nenhum.
carregarEnvLocal();

const config = carregarConfig();
const app = await criarApp(config);

/**
 * Encerra com educação.
 *
 * Sem isto, um `docker compose restart` mata o processo no meio de uma
 * requisição, e quem estava enviando uma foto vê um erro sem explicação.
 * Aqui o servidor para de aceitar coisa nova, termina o que começou e só então
 * fecha o banco.
 */
async function encerrar(sinal: string): Promise<void> {
  app.log.info(`Recebi ${sinal}, encerrando...`);
  try {
    await app.close();
    await banco.$disconnect();
    process.exit(0);
  } catch (erro) {
    app.log.error({ erro }, 'Não consegui encerrar direito');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));

try {
  // 0.0.0.0 e não 127.0.0.1: dentro de um container, escutar só no localhost
  // significa que ninguém de fora alcança — nem o Caddy.
  await app.listen({ port: config.PORTA_SERVIDOR, host: '0.0.0.0' });
  app.log.info(`${config.NOME_DA_REDE} no ar em https://${config.DOMINIO}`);
} catch (erro) {
  app.log.error({ erro }, 'Não consegui subir o servidor');
  process.exit(1);
}
