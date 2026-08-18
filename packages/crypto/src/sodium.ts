// A versão está travada em 0.7.15 de propósito, sem `^`.
//
// A 0.7.16 tem um defeito de empacotamento: o build ESM faz
// `import "./libsodium-sumo.mjs"` apontando para um arquivo que não existe
// naquela pasta, e nada que a importe consegue nem carregar.
//
// E precisa ser a variante "sumo": o `crypto_pwhash` (Argon2id), que é o que
// transforma a senha em chave, não existe no pacote comum.
//
// Antes de subir de versão, rode `pnpm --filter @rede/crypto test`.
import sodium from 'libsodium-wrappers-sumo';
import type { Base64 } from './tipos.js';

let pronto = false;

/**
 * Prepara a biblioteca de criptografia.
 *
 * Precisa ser chamado — e aguardado — uma vez antes de qualquer outra função
 * deste pacote. O libsodium roda em WebAssembly e leva alguns milissegundos
 * para carregar.
 */
export async function inicializar(): Promise<void> {
  if (pronto) return;
  await sodium.ready;
  pronto = true;
}

/**
 * Devolve a biblioteca já carregada.
 *
 * Falha alto e claro se alguém esquecer o `inicializar()` — é melhor um erro
 * óbvio agora do que uma chave silenciosamente vazia depois.
 */
export function lib(): typeof sodium {
  if (!pronto) {
    throw new Error(
      'A criptografia ainda não foi inicializada. Chame `await inicializar()` antes de usar este pacote.',
    );
  }
  return sodium;
}

/** Converte bytes para texto base64url, o formato que usamos para guardar e trafegar. */
export function paraTexto(bytes: Uint8Array): Base64 {
  return lib().to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/** Converte de volta o texto base64url para bytes. */
export function paraBytes(texto: Base64): Uint8Array {
  return lib().from_base64(texto, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/** Sorteia `tamanho` bytes imprevisíveis, com qualidade criptográfica. */
export function sortearBytes(tamanho: number): Uint8Array {
  return lib().randombytes_buf(tamanho);
}

/**
 * Apaga uma chave da memória, escrevendo zeros por cima.
 *
 * Não é garantia absoluta (o coletor de lixo do JavaScript pode ter feito
 * cópias), mas encurta a janela em que a chave fica exposta.
 */
export function limpar(bytes: Uint8Array): void {
  lib().memzero(bytes);
}

/**
 * Compara dois textos em tempo constante.
 *
 * Uma comparação comum (`a === b`) para no primeiro caractere diferente, e o
 * tempo que ela leva revela quantos caracteres estavam certos. Isto aqui leva
 * sempre o mesmo tempo.
 */
export function iguaisEmTempoConstante(a: Base64, b: Base64): boolean {
  const x = paraBytes(a);
  const y = paraBytes(b);
  if (x.length !== y.length) return false;
  return lib().memcmp(x, y);
}
