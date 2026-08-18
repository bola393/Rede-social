import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { raiz } from './comum.js';

/**
 * `pnpm preparar` — cria o arquivo `.env` e sorteia os segredos.
 *
 * É o primeiro comando que alguém roda neste projeto. Ele precisa funcionar de
 * primeira, explicar o que está fazendo, e nunca sobrescrever configuração já
 * existente sem avisar.
 *
 * Os segredos são sorteados com `randomBytes`, do próprio Node, que puxa
 * aleatoriedade do sistema operacional. Nada de `Math.random()`, que é
 * previsível e não serve para nada que precise ser secreto.
 */

const CAMINHO_ENV = join(raiz, '.env');
const CAMINHO_MODELO = join(raiz, '.env.example');

/** 32 bytes em base64url — 256 bits de entropia. */
function sortearSegredo(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Uma senha de banco sem caracteres que atrapalhem.
 *
 * Ela entra numa URL (`postgresql://usuario:senha@host/banco`), e ali `@`, `:`
 * e `/` mudariam o significado da URL inteira. Restringir o alfabeto é bem mais
 * seguro que escapar e torcer.
 */
function sortearSenhaDeBanco(): string {
  const alfabeto = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(32);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

function definir(conteudo: string, chave: string, valor: string): string {
  const linha = `${chave}=${valor}`;
  const padrao = new RegExp(`^${chave}=.*$`, 'm');
  return padrao.test(conteudo) ? conteudo.replace(padrao, linha) : `${conteudo}\n${linha}`;
}

function lerValor(conteudo: string, chave: string): string {
  return new RegExp(`^${chave}=(.*)$`, 'm').exec(conteudo)?.[1]?.trim() ?? '';
}

function principal(): void {
  if (existsSync(CAMINHO_ENV)) {
    const atual = readFileSync(CAMINHO_ENV, 'utf8');
    const faltando = ['JWT_SECRET', 'COOKIE_SECRET', 'MEDIA_ENCRYPTION_KEY', 'TURN_SECRET'].filter(
      (chave) => !lerValor(atual, chave),
    );

    if (faltando.length === 0) {
      console.log('O arquivo .env já existe e está completo. Não mexi em nada.');
      console.log('');
      console.log('Para começar do zero, apague o .env e rode de novo — mas leia antes:');
      console.log('trocar o MEDIA_ENCRYPTION_KEY torna as mídias já enviadas ilegíveis.');
      return;
    }

    // Preenche só o que falta. Um segredo já em uso jamais é trocado por baixo:
    // trocar o JWT_SECRET desloga todo mundo, e o MEDIA_ENCRYPTION_KEY é pior
    // ainda — as fotos e vídeos do feed viram lixo, sem volta.
    let conteudo = atual;
    for (const chave of faltando) conteudo = definir(conteudo, chave, sortearSegredo());
    writeFileSync(CAMINHO_ENV, conteudo, 'utf8');

    console.log(`Completei o que faltava no .env: ${faltando.join(', ')}.`);
    console.log('O que já estava preenchido continua igual.');
    return;
  }

  if (!existsSync(CAMINHO_MODELO)) {
    console.error('Não encontrei o .env.example. Você está na pasta certa do projeto?');
    process.exit(1);
  }

  copyFileSync(CAMINHO_MODELO, CAMINHO_ENV);
  let conteudo = readFileSync(CAMINHO_ENV, 'utf8');

  const senhaDoBanco = sortearSenhaDeBanco();
  const usuario = 'rede';
  const banco = 'rede_social';

  conteudo = definir(conteudo, 'POSTGRES_USER', usuario);
  conteudo = definir(conteudo, 'POSTGRES_PASSWORD', senhaDoBanco);
  conteudo = definir(conteudo, 'POSTGRES_DB', banco);
  // Em desenvolvimento o servidor roda fora do container e alcança o banco pelo
  // localhost. Dentro do compose, o docker-compose monta a URL com o nome do
  // serviço, então este valor só vale para o `pnpm dev`.
  conteudo = definir(
    conteudo,
    'DATABASE_URL',
    `postgresql://${usuario}:${senhaDoBanco}@localhost:5432/${banco}`,
  );

  conteudo = definir(conteudo, 'JWT_SECRET', sortearSegredo());
  conteudo = definir(conteudo, 'COOKIE_SECRET', sortearSegredo());
  conteudo = definir(conteudo, 'MEDIA_ENCRYPTION_KEY', sortearSegredo());
  conteudo = definir(conteudo, 'TURN_SECRET', sortearSegredo());

  writeFileSync(CAMINHO_ENV, conteudo, 'utf8');

  console.log(
    [
      '',
      'Pronto — o arquivo .env foi criado e os segredos foram sorteados.',
      '',
      'Falta uma coisa que só você sabe: o endereço da sua rede.',
      '',
      '  1. Instale o Tailscale e entre com a sua conta.',
      '  2. Rode `tailscale status` e veja o nome desta máquina',
      '     (algo como pc-do-joao.tail1234.ts.net).',
      '  3. Abra o arquivo .env e ponha esse nome em DOMINIO.',
      '  4. Rode `pnpm cert` para buscar o certificado HTTPS.',
      '',
      'O passo a passo completo, com telas: docs/instalacao-windows.md',
      '',
      'Guarde uma cópia do .env junto com os backups. Ele tem a chave que abre',
      'as mídias do feed — sem ela, elas não voltam.',
      '',
    ].join('\n'),
  );
}

principal();
