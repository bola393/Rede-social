import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/** Coisas que todos os scripts de operação precisam. */

const executar = promisify(execFile);

/** A pasta raiz do projeto, seja de onde for que o script tenha sido chamado. */
export const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Lê o `.env` sem depender de biblioteca. */
export function lerEnv(): Record<string, string> {
  const caminho = join(raiz, '.env');
  if (!existsSync(caminho)) return {};

  const valores: Record<string, string> = {};
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;

    const igual = limpa.indexOf('=');
    if (igual < 1) continue;

    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    // Aspas são só delimitador; o que vale é o que está dentro.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    valores[chave] = valor;
  }
  return valores;
}

export interface Resultado {
  ok: boolean;
  saida: string;
}

/**
 * Roda um comando e devolve o que ele disse, sem estourar em caso de erro.
 *
 * Os scripts de diagnóstico precisam justamente conseguir chamar programas que
 * podem não estar instalados, e transformar isso numa mensagem útil em vez de
 * numa pilha de erro.
 *
 * Recebe os argumentos como lista, e não como uma linha de comando: assim não
 * existe shell interpretando nada, e um caminho com espaço (ou um valor vindo
 * do `.env`) não vira execução de comando.
 */
export async function rodar(
  programa: string,
  argumentos: string[] = [],
  opcoes: { cwd?: string; timeoutMs?: number } = {},
): Promise<Resultado> {
  try {
    const { stdout, stderr } = await executar(programa, argumentos, {
      cwd: opcoes.cwd ?? raiz,
      timeout: opcoes.timeoutMs ?? 20_000,
      windowsHide: true,
    });
    return { ok: true, saida: `${stdout}${stderr}`.trim() };
  } catch (erro) {
    const e = erro as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, saida: `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`.trim() };
  }
}

/** No Windows os executáveis do Docker e do Tailscale terminam em `.exe`. */
export const noWindows = process.platform === 'win32';

/** Cores no terminal — desligadas quando a saída não é um terminal. */
const colorido = process.stdout.isTTY && !process.env.NO_COLOR;
const cor = (codigo: string) => (texto: string) =>
  colorido ? `\u001b[${codigo}m${texto}\u001b[0m` : texto;

export const verde = cor('32');
export const amarelo = cor('33');
export const vermelho = cor('31');
export const cinza = cor('90');
export const negrito = cor('1');
