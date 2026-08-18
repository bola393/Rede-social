import { lib, paraBytes, paraTexto, sortearBytes } from './sodium.js';
import type { ArquivoCifrado } from './tipos.js';

/**
 * Fotos, vídeos e mensagens de áudio.
 *
 * Cada arquivo ganha uma chave só dele, sorteada na hora. O arquivo sobe já
 * cifrado, e a chave viaja **dentro da mensagem cifrada** que o acompanha.
 *
 * Isso dá duas propriedades boas de graça:
 *
 * - o servidor guarda um borrão de bytes, sem chave nenhuma para abri-lo;
 * - apagar a mensagem apaga o único lugar onde a chave existia, então o
 *   arquivo vira lixo mesmo que um pedaço dele sobreviva em algum cache.
 */

/** Cifra um arquivo, sorteando uma chave nova para ele. */
export function cifrarArquivo(bytes: Uint8Array): ArquivoCifrado {
  const s = lib();
  const chave = sortearBytes(s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  const nonce = sortearBytes(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

  const cifrado = s.crypto_aead_xchacha20poly1305_ietf_encrypt(bytes, null, null, nonce, chave);

  const resultado: ArquivoCifrado = {
    bytes: cifrado,
    chave: paraTexto(chave),
    nonce: paraTexto(nonce),
  };

  s.memzero(chave);
  return resultado;
}

/**
 * Abre um arquivo cifrado.
 *
 * Devolve `null` se a chave estiver errada ou se os bytes tiverem sido
 * alterados — inclusive por um download que chegou pela metade.
 */
export function decifrarArquivo(bytes: Uint8Array, chave: string, nonce: string): Uint8Array | null {
  try {
    return lib().crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      bytes,
      null,
      paraBytes(nonce),
      paraBytes(chave),
    );
  } catch {
    return null;
  }
}
