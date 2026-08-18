import { lib, paraBytes, paraTexto, sortearBytes } from './sodium.js';
import type { ChaveDeConversa, ChaveSelada, Identidade } from './tipos.js';

/**
 * Como as conversas ficam protegidas.
 *
 * Cada conversa tem **uma chave simétrica**, e todo mundo que participa tem uma
 * cópia dela. Para entregar essa cópia a cada aparelho sem que o servidor veja,
 * ela é *selada* com a chave pública daquele aparelho: só a chave privada
 * correspondente reabre. O servidor guarda os envelopes selados sem ter como
 * abrir nenhum.
 *
 * Quando alguém entra ou sai da conversa, ou quando um aparelho é revogado,
 * abre-se uma **época nova**, com chave nova. Mensagens antigas continuam na
 * época em que nasceram — quem saiu não passa a ler o que vem depois.
 */

/** Cria a chave da primeira época de uma conversa. */
export function gerarChaveDeConversa(epoca = 1): ChaveDeConversa {
  return {
    chave: paraTexto(sortearBytes(lib().crypto_aead_xchacha20poly1305_ietf_KEYBYTES)),
    epoca,
  };
}

/**
 * Abre uma época nova, com chave nova.
 *
 * Use ao adicionar ou remover alguém da conversa, e ao revogar um aparelho.
 */
export function rotacionarChave(atual: ChaveDeConversa): ChaveDeConversa {
  return gerarChaveDeConversa(atual.epoca + 1);
}

/**
 * Sela a chave da conversa para um aparelho.
 *
 * Usa `crypto_box_seal`, que é anônimo: o envelope não revela quem o produziu,
 * apenas para quem ele vai. Nem o servidor, nem os outros membros conseguem
 * abrir o envelope de terceiros.
 */
export function selarParaAparelho(
  chaveDaConversa: ChaveDeConversa,
  chavePublicaDeTroca: string,
): ChaveSelada {
  const selada = lib().crypto_box_seal(
    paraBytes(chaveDaConversa.chave),
    paraBytes(chavePublicaDeTroca),
  );

  return { epoca: chaveDaConversa.epoca, selada: paraTexto(selada) };
}

/**
 * Abre um envelope selado para este aparelho.
 *
 * Aceita tanto a identidade de um aparelho quanto a chave mestre de
 * recuperação — nos dois casos o que importa é o par de troca.
 *
 * Devolve `null` se o envelope não era para ele, ou se foi adulterado.
 */
export function abrirChaveDeConversa(
  selada: ChaveSelada,
  dono: Pick<Identidade, 'troca'>,
): ChaveDeConversa | null {
  try {
    const chave = lib().crypto_box_seal_open(
      paraBytes(selada.selada),
      paraBytes(dono.troca.publica),
      paraBytes(dono.troca.privada),
    );
    return { chave: paraTexto(chave), epoca: selada.epoca };
  } catch {
    return null;
  }
}

/**
 * Sela a chave da conversa para todos os aparelhos de uma vez.
 *
 * É o que roda ao criar uma conversa ou ao girar a época: um envelope por
 * aparelho, todos guardados no servidor.
 */
export function selarParaTodos(
  chaveDaConversa: ChaveDeConversa,
  aparelhos: ReadonlyArray<{ aparelhoId: string; chavePublicaDeTroca: string }>,
): Array<{ aparelhoId: string } & ChaveSelada> {
  return aparelhos.map((aparelho) => ({
    aparelhoId: aparelho.aparelhoId,
    ...selarParaAparelho(chaveDaConversa, aparelho.chavePublicaDeTroca),
  }));
}
