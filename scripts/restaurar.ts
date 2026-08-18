import { createInterface } from 'node:readline/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { amarelo, cinza, lerEnv, negrito, raiz, rodar, verde, vermelho } from './comum.js';

/**
 * `pnpm restaurar` — traz um backup de volta.
 *
 * Este é o script que só roda em dia ruim: o HD morreu, o PC foi formatado, ou
 * você está montando a rede na VPS pela primeira vez. Então ele foi escrito
 * para ser usado por alguém apressado e nervoso.
 *
 * Ele **pergunta antes de destruir**. Restaurar apaga o banco atual, e essa é
 * exatamente a operação que não pode acontecer por engano.
 *
 * Uso:
 *     pnpm restaurar                       (escolhe o backup mais recente)
 *     pnpm restaurar banco-2026-08-18.dump (escolhe um específico)
 */

const env = lerEnv();

async function principal(): Promise<void> {
  const pasta = join(raiz, (env.BACKUP_DIR ?? './backups').replace(/^\.\//, ''));

  if (!existsSync(pasta)) {
    console.error(vermelho(`Não encontrei a pasta de backups em ${pasta}.`));
    console.error('');
    console.error('Se você está restaurando noutra máquina, copie a pasta `backups`');
    console.error('para cá primeiro.');
    process.exit(1);
  }

  const disponiveis = readdirSync(pasta)
    .filter((nome) => nome.startsWith('banco-') && nome.endsWith('.dump'))
    .map((nome) => ({ nome, quando: statSync(join(pasta, nome)).mtime }))
    .sort((a, b) => b.quando.getTime() - a.quando.getTime());

  if (disponiveis.length === 0) {
    console.error(vermelho('Não há nenhum backup do banco nessa pasta.'));
    process.exit(1);
  }

  const pedido = process.argv[2];
  const escolhido = pedido
    ? disponiveis.find((b) => b.nome === pedido || b.nome.includes(pedido))
    : disponiveis[0];

  if (!escolhido) {
    console.error(vermelho(`Não encontrei um backup que combine com "${pedido}".`));
    console.error('');
    console.error('Os que existem:');
    for (const b of disponiveis.slice(0, 10)) {
      console.error(`  ${b.nome}   ${cinza(b.quando.toLocaleString('pt-BR'))}`);
    }
    process.exit(1);
  }

  const nomeDoBanco = env.POSTGRES_DB ?? 'rede_social';
  const usuario = env.POSTGRES_USER ?? 'rede';

  console.log('');
  console.log(negrito('  Restaurar a rede a partir de um backup'));
  console.log(cinza('  ─────────────────────────────────────────────────────────'));
  console.log('');
  console.log(`  Backup:  ${escolhido.nome}`);
  console.log(`  Feito em: ${escolhido.quando.toLocaleString('pt-BR')}`);
  console.log(`  Destino: banco "${nomeDoBanco}"`);
  console.log('');
  console.log(amarelo('  Isto APAGA o conteúdo atual do banco e põe o do backup no lugar.'));
  console.log(amarelo('  Tudo que aconteceu depois desse horário será perdido.'));
  console.log('');

  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await leitor.question('  Para confirmar, digite RESTAURAR: ');
  leitor.close();

  if (resposta.trim() !== 'RESTAURAR') {
    console.log('');
    console.log('Cancelado. Nada foi alterado.');
    return;
  }

  console.log('');
  console.log('Levando o arquivo para dentro do banco...');

  const compose = [
    'compose',
    '-f',
    join(raiz, 'infra', 'docker-compose.yml'),
    '--env-file',
    join(raiz, '.env'),
  ];

  const copiar = await rodar(
    'docker',
    [...compose, 'cp', join(pasta, escolhido.nome), 'postgres:/tmp/restaurar.dump'],
    { timeoutMs: 600_000 },
  );

  if (!copiar.ok) {
    console.error(vermelho('Não consegui copiar o arquivo para o container.'));
    console.error(cinza(copiar.saida.split('\n').slice(0, 5).join('\n')));
    console.error('');
    console.error('A rede precisa estar no ar. Ligue com INICIAR.bat e tente de novo.');
    process.exit(1);
  }

  console.log('Restaurando...');

  // --clean --if-exists apaga o que existe antes de recriar. Sem isso, a
  // restauração falharia em cada tabela que já existe.
  const restaurar = await rodar(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'postgres',
      'pg_restore',
      '-U',
      usuario,
      '-d',
      nomeDoBanco,
      '--clean',
      '--if-exists',
      '--no-owner',
      '/tmp/restaurar.dump',
    ],
    { timeoutMs: 1_800_000 },
  );

  // O pg_restore reclama de coisas inofensivas (apagar o que ainda não existe,
  // por exemplo) e sai com código de erro por causa disso. O que importa é se
  // ele reclamou de algo além disso.
  const linhasDeErro = restaurar.saida
    .split('\n')
    .filter((linha) => linha.includes('error:'))
    .filter((linha) => !linha.includes('does not exist'));

  if (linhasDeErro.length > 0) {
    console.error('');
    console.error(vermelho('A restauração terminou com problemas:'));
    console.error(cinza(linhasDeErro.slice(0, 8).join('\n')));
    process.exit(1);
  }

  console.log('');
  console.log(verde('Banco restaurado.'));

  const midias = join(
    pasta,
    escolhido.nome.replace('banco-', 'midias-').replace('.dump', '.tar.gz'),
  );
  if (existsSync(midias)) {
    console.log('');
    console.log('Restaurando as fotos, vídeos e áudios...');

    const volta = await rodar(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        'rede-social_dados-midia:/dados',
        '-v',
        `${pasta}:/origem:ro`,
        'alpine:3',
        'tar',
        'xzf',
        `/origem/${escolhido.nome.replace('banco-', 'midias-').replace('.dump', '.tar.gz')}`,
        '-C',
        '/dados',
      ],
      { timeoutMs: 1_800_000 },
    );

    console.log(
      volta.ok ? verde('Mídias restauradas.') : amarelo('Não consegui restaurar as mídias.'),
    );
  }

  console.log('');
  console.log('Reinicie a rede para tudo assentar:');
  console.log('');
  console.log('    pnpm parar && pnpm iniciar');
  console.log('');
  console.log(cinza('Se as fotos do feed aparecerem quebradas, é sinal de que o .env'));
  console.log(cinza('desta máquina tem um MEDIA_ENCRYPTION_KEY diferente do original.'));
  console.log(cinza('Recupere o .env que estava junto do backup.'));
  console.log('');
}

void principal();
