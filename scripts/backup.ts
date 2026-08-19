import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { amarelo, cinza, lerEnv, raiz, rodar, verde, vermelho } from './comum.js';

/**
 * `pnpm backup` — guarda uma cópia de tudo.
 *
 * ## Por que isto importa mais aqui do que na maioria dos projetos
 *
 * Com criptografia ponta-a-ponta, **este arquivo é a única cópia que existe**.
 * O servidor não guarda chave nenhuma capaz de reconstruir uma mensagem; se o
 * banco se perder, as conversas se perdem junto, e não há suporte, nuvem ou
 * técnico que traga de volta.
 *
 * ## Por que `pg_dump`, e não copiar a pasta do banco
 *
 * Copiar os arquivos de um Postgres em funcionamento produz uma cópia
 * inconsistente: o banco está escrevendo enquanto a cópia acontece, e o
 * resultado pode não abrir — ou, pior, abrir e estar corrompido em silêncio.
 * O `pg_dump` conversa com o banco e produz um retrato coerente.
 *
 * ## O que vai junto
 *
 * O banco e as mídias. E, opcionalmente, uma cópia é enviada para a segunda
 * máquina pelo Tailscale — o PC e o notebook morrerem no mesmo dia é bem menos
 * provável que um só deles morrer.
 */

const env = lerEnv();
const AGORA = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function principal(): Promise<void> {
  const pasta = join(raiz, (env.BACKUP_DIR ?? './backups').replace(/^\.\//, ''));
  mkdirSync(pasta, { recursive: true });

  const nomeDoBanco = env.POSTGRES_DB ?? 'rede_social';
  const usuario = env.POSTGRES_USER ?? 'rede';
  const arquivoBanco = join(pasta, `banco-${AGORA}.dump`);

  // ─── O banco ──────────────────────────────────────────────────────────
  console.log('Salvando o banco de dados...');

  // O -Fc é o formato comprimido do Postgres: menor e restaurável seletivamente.
  const dump = await rodar(
    'docker',
    [
      'compose',
      '-f',
      join(raiz, 'infra', 'docker-compose.yml'),
      '--env-file',
      join(raiz, '.env'),
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '-U',
      usuario,
      '-d',
      nomeDoBanco,
      '-Fc',
      '-f',
      '/tmp/backup.dump',
    ],
    { timeoutMs: 600_000 },
  );

  if (!dump.ok) {
    console.error(vermelho('Não consegui salvar o banco.'));
    console.error(cinza(dump.saida.split('\n').slice(0, 5).join('\n')));
    console.error('');
    console.error('A rede precisa estar no ar para o backup funcionar.');
    console.error('Ligue com INICIAR.bat (ou `pnpm iniciar`) e tente de novo.');
    process.exit(1);
  }

  const copiar = await rodar(
    'docker',
    [
      'compose',
      '-f',
      join(raiz, 'infra', 'docker-compose.yml'),
      '--env-file',
      join(raiz, '.env'),
      'cp',
      'postgres:/tmp/backup.dump',
      arquivoBanco,
    ],
    { timeoutMs: 600_000 },
  );

  if (!copiar.ok || !existsSync(arquivoBanco)) {
    console.error(vermelho('O banco foi salvo dentro do container, mas não consegui trazê-lo.'));
    console.error(cinza(copiar.saida.split('\n').slice(0, 5).join('\n')));
    process.exit(1);
  }

  const tamanhoBanco = statSync(arquivoBanco).size;
  console.log(verde(`  banco-${AGORA}.dump — ${formatarTamanho(tamanhoBanco)}`));

  // ─── As mídias ────────────────────────────────────────────────────────
  console.log('Salvando as fotos, vídeos e áudios...');

  const arquivoMidia = join(pasta, `midias-${AGORA}.tar.gz`);
  const midias = await rodar(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      'rede-social_dados-midia:/dados:ro',
      '-v',
      `${pasta}:/destino`,
      'alpine:3',
      'tar',
      'czf',
      `/destino/midias-${AGORA}.tar.gz`,
      '-C',
      '/dados',
      '.',
    ],
    { timeoutMs: 900_000 },
  );

  if (midias.ok && existsSync(arquivoMidia)) {
    console.log(
      verde(`  midias-${AGORA}.tar.gz — ${formatarTamanho(statSync(arquivoMidia).size)}`),
    );
  } else {
    // Na Fase 0 ainda não existe mídia nenhuma, então isto é esperado.
    console.log(cinza('  (nenhuma mídia para salvar ainda)'));
  }

  // ─── O .env ───────────────────────────────────────────────────────────
  // Ele guarda a chave que abre as mídias do feed. Sem ele, um backup
  // restaurado devolve as conversas mas não as fotos.
  console.log(amarelo('\nLembrete: guarde uma cópia do arquivo .env junto com estes backups.'));
  console.log(cinza('Ele tem a chave que abre as mídias do feed.'));

  // ─── Faxina ───────────────────────────────────────────────────────────
  const dias = Number(env.BACKUP_RETENCAO_DIAS ?? 14);
  const limite = Date.now() - dias * 86_400_000;
  let apagados = 0;

  for (const nome of readdirSync(pasta)) {
    if (!/^(banco|midias)-/.test(nome)) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).mtime.getTime() < limite) {
      rmSync(caminho);
      apagados++;
    }
  }
  if (apagados > 0) {
    console.log(cinza(`\n${apagados} backup(s) com mais de ${dias} dias foram apagados.`));
  }

  // ─── Cópia para a segunda máquina ─────────────────────────────────────
  await enviarParaSegundaMaquina(pasta);

  console.log('');
  console.log(verde('Backup concluído.'));
  console.log('');
  console.log(cinza('Backup que nunca foi restaurado não é backup. Vale testar o'));
  console.log(cinza('`pnpm restaurar` uma vez, com calma, antes de precisar com pressa.'));
  console.log('');
}

/**
 * Manda os arquivos para o notebook, pelo Tailscale.
 *
 * O notebook não precisa estar ligado: se ele não responder, o backup local já
 * está feito, e a próxima execução leva o que ficou para trás. Falhar aqui não
 * é motivo para o script inteiro falhar.
 */
async function enviarParaSegundaMaquina(pasta: string): Promise<void> {
  const destino = env.BACKUP_DESTINO;
  if (!destino) return;

  const usuario = env.BACKUP_USUARIO_DESTINO;
  const caminho = env.BACKUP_CAMINHO_DESTINO ?? '~/backups-rede-social';
  const alvo = `${usuario ? `${usuario}@` : ''}${destino}:${caminho}`;

  console.log('');
  console.log(`Enviando para ${destino}...`);

  const envio = await rodar('rsync', ['-az', '--partial', `${pasta}/`, alvo], {
    timeoutMs: 1_800_000,
  });

  if (envio.ok) {
    console.log(verde(`  cópia guardada em ${destino}`));
    return;
  }

  console.log(amarelo(`  não consegui enviar para ${destino} desta vez.`));
  console.log(cinza('  O backup local está feito — a próxima execução leva o que faltou.'));
  console.log(cinza(`  ${envio.saida.split('\n')[0] ?? ''}`));
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

void principal();
