import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/portuguese';
import { lib, paraTexto } from './sodium.js';
import type { ChaveDeConversa, ChaveSelada, ParDeTroca } from './tipos.js';

/**
 * A frase de recuperação: 24 palavras em português.
 *
 * ## Por que ela existe
 *
 * Cada aparelho tem a sua própria identidade, que fica trancada com a senha e
 * nunca sai dali. Isso é ótimo para segurança e péssimo para o dia em que o
 * celular cai na privada.
 *
 * A frase resolve isso sem entregar nada ao servidor. Dela nasce, sempre igual,
 * um **par de chaves mestre de recuperação**. A parte pública fica registrada na
 * conta; toda vez que uma conversa abre uma época nova, a chave daquela época
 * também é selada para essa chave mestre.
 *
 * Assim, um aparelho novo com a frase na mão consegue abrir todo o histórico —
 * e o servidor, que guardou os envelopes o tempo todo, nunca conseguiu abrir
 * nenhum.
 *
 * ## O que dizer a quem usa
 *
 * Quem tem a frase tem acesso a tudo, para sempre. Ela vale o mesmo que a
 * senha, e não dá para trocá-la depois. Escreva no papel, guarde longe do
 * computador, e não tire foto dela.
 */

/** Sorteia uma frase nova de 24 palavras (256 bits de entropia). */
export function gerarFraseDeRecuperacao(): string {
  return generateMnemonic(wordlist, 256);
}

/**
 * Confere se a frase é válida antes de tentar usá-la.
 *
 * O padrão BIP39 embute um dígito verificador, então uma palavra digitada
 * errada é detectada na hora — em vez de gerar silenciosamente as chaves
 * erradas e só falhar lá na frente, sem explicação.
 */
export function conferirFrase(frase: string): boolean {
  return validateMnemonic(normalizar(frase), wordlist);
}

/**
 * Deriva o par de chaves mestre a partir da frase.
 *
 * É determinístico: a mesma frase devolve sempre exatamente as mesmas chaves,
 * em qualquer aparelho, hoje ou daqui a dez anos.
 */
export function chaveMestraDaFrase(frase: string): ParDeTroca {
  const limpa = normalizar(frase);
  if (!validateMnemonic(limpa, wordlist)) {
    throw new Error('Frase de recuperação inválida. Confira se alguma palavra saiu errada.');
  }

  const s = lib();
  const semente = mnemonicToSeedSync(limpa).slice(0, s.crypto_box_SEEDBYTES);
  const par = s.crypto_box_seed_keypair(semente);
  s.memzero(semente);

  return { publica: paraTexto(par.publicKey), privada: paraTexto(par.privateKey) };
}

/**
 * Sela a chave de uma época para a chave mestre de recuperação.
 *
 * Roda junto com a selagem para os aparelhos, toda vez que uma época nasce.
 */
export function selarParaRecuperacao(
  chaveDaConversa: ChaveDeConversa,
  chaveMestraPublica: string,
): ChaveSelada {
  const s = lib();
  const selada = s.crypto_box_seal(
    s.from_base64(chaveDaConversa.chave, s.base64_variants.URLSAFE_NO_PADDING),
    s.from_base64(chaveMestraPublica, s.base64_variants.URLSAFE_NO_PADDING),
  );

  return { epoca: chaveDaConversa.epoca, selada: paraTexto(selada) };
}

/**
 * Normaliza a frase digitada: tudo minúsculo, um espaço entre palavras.
 *
 * Cobre o que as pessoas realmente fazem — colar com quebra de linha, deixar
 * espaço sobrando, o teclado do celular capitalizar a primeira palavra.
 *
 * O `NFKD` importa para o português: "avô" digitado com acento composto e com
 * acento combinado são textos diferentes em bytes, e sem normalizar geram
 * sementes diferentes.
 */
function normalizar(frase: string): string {
  return frase.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
}
