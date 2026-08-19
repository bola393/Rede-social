import { lib, paraBytes, paraTexto, sortearBytes } from './sodium.js';
import type { Identidade, IdentidadePublica, IdentidadeTrancada } from './tipos.js';

/**
 * Custo do Argon2id ao transformar a senha numa chave.
 *
 * Estes números são o preço que um invasor paga por *cada* tentativa de
 * adivinhar a senha. Foram escolhidos para levar por volta de meio segundo num
 * celular mediano: incômodo de esperar uma vez ao destravar o app, proibitivo
 * para quem quer testar milhões de senhas.
 *
 * Ficam gravados dentro do envelope, então dá para aumentá-los no futuro sem
 * que os aparelhos já existentes parem de conseguir abrir o que é deles.
 */
const OPERACOES = 3;
const MEMORIA = 128 * 1024 * 1024; // 128 MiB

/**
 * Cria uma identidade nova para este aparelho.
 *
 * São dois pares de chaves com papéis diferentes:
 *
 * - **assinatura** (Ed25519) prova que foi você quem escreveu algo;
 * - **troca** (X25519) permite que outras pessoas te entreguem segredos.
 *
 * Separar os dois é padrão: uma chave com dois usos é uma chave com o dobro de
 * superfície para dar errado.
 */
export function gerarIdentidade(): Identidade {
  const s = lib();
  const assinatura = s.crypto_sign_keypair();
  const troca = s.crypto_box_keypair();

  return {
    assinatura: {
      publica: paraTexto(assinatura.publicKey),
      privada: paraTexto(assinatura.privateKey),
    },
    troca: {
      publica: paraTexto(troca.publicKey),
      privada: paraTexto(troca.privateKey),
    },
  };
}

/** Extrai só a parte pública — é isto, e nada além, que o servidor recebe. */
export function partePublica(identidade: Identidade): IdentidadePublica {
  return {
    assinatura: identidade.assinatura.publica,
    troca: identidade.troca.publica,
  };
}

/**
 * Tranca a identidade com uma senha, para guardar em disco.
 *
 * A senha não é guardada em lugar nenhum: ela é moída pelo Argon2id até virar
 * uma chave, e essa chave cifra a identidade. Sem a senha original, o resultado
 * é indistinguível de ruído.
 */
export function trancarIdentidade(identidade: Identidade, senha: string): IdentidadeTrancada {
  const s = lib();
  const sal = sortearBytes(s.crypto_pwhash_SALTBYTES);
  const chave = derivarChave(senha, sal);
  const nonce = sortearBytes(s.crypto_secretbox_NONCEBYTES);

  const conteudo = new TextEncoder().encode(JSON.stringify(identidade));
  const cifrado = s.crypto_secretbox_easy(conteudo, nonce, chave);

  s.memzero(chave);
  s.memzero(conteudo);

  return {
    versao: 1,
    cifrado: paraTexto(cifrado),
    nonce: paraTexto(nonce),
    sal: paraTexto(sal),
    operacoes: OPERACOES,
    memoria: MEMORIA,
  };
}

/**
 * Destranca a identidade com a senha.
 *
 * Devolve `null` quando a senha está errada — e é sempre `null`, nunca uma
 * mensagem diferente para "senha quase certa". O envelope é autenticado, então
 * também dá `null` se alguém tiver adulterado um único byte do arquivo.
 */
export function destrancarIdentidade(
  trancada: IdentidadeTrancada,
  senha: string,
): Identidade | null {
  const s = lib();
  const chave = derivarChaveComCusto(
    senha,
    paraBytes(trancada.sal),
    trancada.operacoes,
    trancada.memoria,
  );

  try {
    const aberto = s.crypto_secretbox_open_easy(
      paraBytes(trancada.cifrado),
      paraBytes(trancada.nonce),
      chave,
    );
    return JSON.parse(new TextDecoder().decode(aberto)) as Identidade;
  } catch {
    // Senha errada ou arquivo adulterado. De fora, os dois casos são iguais.
    return null;
  } finally {
    s.memzero(chave);
  }
}

/** Assina bytes com a chave de assinatura do aparelho. */
export function assinar(dados: Uint8Array, identidade: Identidade): string {
  return paraTexto(lib().crypto_sign_detached(dados, paraBytes(identidade.assinatura.privada)));
}

/** Confere se uma assinatura bate com a chave pública de quem diz ter assinado. */
export function conferirAssinatura(
  dados: Uint8Array,
  assinatura: string,
  chavePublica: string,
): boolean {
  try {
    return lib().crypto_sign_verify_detached(paraBytes(assinatura), dados, paraBytes(chavePublica));
  } catch {
    return false;
  }
}

function derivarChave(senha: string, sal: Uint8Array): Uint8Array {
  return derivarChaveComCusto(senha, sal, OPERACOES, MEMORIA);
}

function derivarChaveComCusto(
  senha: string,
  sal: Uint8Array,
  operacoes: number,
  memoria: number,
): Uint8Array {
  const s = lib();
  return s.crypto_pwhash(
    s.crypto_secretbox_KEYBYTES,
    senha,
    sal,
    operacoes,
    memoria,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}
