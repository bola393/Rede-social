import argon2 from 'argon2';

/**
 * Guardar e conferir senhas.
 *
 * O Argon2id é lento e come memória de propósito. Meio segundo de espera ao
 * entrar é irrelevante para quem sabe a senha; para quem está tentando
 * adivinhá-la, esse meio segundo por tentativa transforma dias de trabalho em
 * séculos.
 *
 * Estes números são os recomendados pela OWASP para Argon2id: 19 MiB de
 * memória, 2 passagens, 1 thread. Deliberadamente mais leves que os do cofre
 * no aparelho (128 MiB), porque aqui o servidor pode ter várias pessoas
 * entrando ao mesmo tempo, e memória é recurso compartilhado.
 */
const CUSTO = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Um hash descartável, usado para gastar tempo mesmo quando o e-mail não
 * existe.
 *
 * Sem isto, um login com e-mail inexistente responderia na hora, e um com
 * e-mail válido demoraria os 200 ms do Argon2id. Essa diferença de tempo
 * entrega quem tem conta na rede — e numa rede fechada de poucas pessoas, saber
 * quem está dentro já é informação demais.
 */
let hashDeEnfeite: string | null = null;

export async function guardarSenha(senha: string): Promise<string> {
  return argon2.hash(senha, CUSTO);
}

/** Confere a senha. Devolve false em vez de estourar, seja qual for o motivo. */
export async function conferirSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    // Hash corrompido ou em formato desconhecido. Do lado de fora é só "não".
    return false;
  }
}

/**
 * Gasta o mesmo tempo de uma conferência de verdade, sem conferir nada.
 *
 * Chamado quando o e-mail não existe, para que o tempo de resposta seja igual
 * nos dois casos.
 */
export async function fingirConferencia(senha: string): Promise<false> {
  hashDeEnfeite ??= await guardarSenha('senha-que-nao-e-de-ninguem');
  await conferirSenha(hashDeEnfeite, senha);
  return false;
}

/**
 * Diz se um hash foi feito com um custo mais fraco que o atual.
 *
 * Permite reforçar a proteção das senhas antigas na próxima vez que a pessoa
 * entrar, sem pedir nada a ela.
 */
export function precisaSerRefeito(hash: string): boolean {
  return argon2.needsRehash(hash, CUSTO);
}
