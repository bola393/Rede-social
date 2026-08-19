import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Carrega o `.env` da raiz do projeto quando o servidor roda fora de container.
 *
 * Dentro do Docker isto não é usado: lá as variáveis chegam pelo
 * `docker-compose`, que é o jeito certo em produção — arquivo de segredo dentro
 * de imagem é como segredo vaza.
 *
 * Fora dele, porém, `pnpm dev` precisava de alguma forma de achar a
 * configuração, e obrigar a exportar seis variáveis à mão antes de cada
 * execução seria um convite a errar.
 *
 * Só preenche o que ainda não existe: uma variável já definida no ambiente
 * sempre vence o arquivo.
 */
export function carregarEnvLocal(): void {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const caminho = join(raiz, '.env');

  if (!existsSync(caminho)) return;

  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;

    const igual = limpa.indexOf('=');
    if (igual < 1) continue;

    const chave = limpa.slice(0, igual).trim();
    if (process.env[chave] !== undefined) continue;

    let valor = limpa.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
  }
}
