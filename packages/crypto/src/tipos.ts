/**
 * Tipos usados por toda a criptografia da rede.
 *
 * Convenção do projeto: tudo que trafega ou é guardado vai como texto em
 * base64url. Bytes crus (`Uint8Array`) só existem dentro deste pacote, na hora
 * de fazer a conta — assim nenhum outro lugar do código precisa se preocupar
 * com codificação.
 */

/** Bytes codificados em base64url (sem `=` no fim, seguro para URL e JSON). */
export type Base64 = string;

/** Par de chaves de assinatura (Ed25519). Prova quem escreveu algo. */
export interface ParDeAssinatura {
  publica: Base64;
  privada: Base64;
}

/** Par de chaves de troca (X25519). Permite entregar segredos a alguém. */
export interface ParDeTroca {
  publica: Base64;
  privada: Base64;
}

/**
 * A identidade criptográfica de um aparelho.
 *
 * Cada celular ou navegador tem a sua. As chaves privadas nunca saem do
 * aparelho — o servidor só conhece as públicas.
 */
export interface Identidade {
  assinatura: ParDeAssinatura;
  troca: ParDeTroca;
}

/** As duas chaves públicas de um aparelho, que é o que o servidor guarda. */
export interface IdentidadePublica {
  assinatura: Base64;
  troca: Base64;
}

/**
 * Uma identidade trancada com senha, pronta para ser guardada em disco.
 *
 * Sem a senha certa, isto aqui é ruído — não dá para extrair nada.
 */
export interface IdentidadeTrancada {
  versao: 1;
  cifrado: Base64;
  nonce: Base64;
  sal: Base64;
  /** Custo de CPU usado no Argon2id. Guardado para conseguir reabrir depois. */
  operacoes: number;
  /** Custo de memória usado no Argon2id, em bytes. */
  memoria: number;
}

/** Chave simétrica de uma conversa, numa determinada época. */
export interface ChaveDeConversa {
  /** A chave em si, 32 bytes. Nunca vai para o servidor sem estar selada. */
  chave: Base64;
  /**
   * Época: aumenta toda vez que alguém entra ou sai da conversa, ou que um
   * aparelho é revogado. Mensagens antigas continuam na época em que nasceram.
   */
  epoca: number;
}

/** Chave de conversa selada para um aparelho específico. */
export interface ChaveSelada {
  epoca: number;
  /** Só a chave privada do aparelho de destino consegue abrir isto. */
  selada: Base64;
}

/**
 * O contexto de uma mensagem. Vai *autenticado mas não cifrado*, e é o que
 * impede que alguém pegue uma mensagem e a injete noutra conversa: se qualquer
 * um destes campos mudar, a mensagem não abre.
 */
export interface ContextoDaMensagem {
  conversaId: string;
  remetenteId: string;
  epoca: number;
  /** Milissegundos desde 1970. */
  momento: number;
}

/** Uma mensagem cifrada, do jeito que fica guardada no banco. */
export interface MensagemCifrada {
  versao: 1;
  cifrado: Base64;
  nonce: Base64;
}

/** Um arquivo cifrado (foto, vídeo, áudio) e a chave que o abre. */
export interface ArquivoCifrado {
  bytes: Uint8Array;
  chave: Base64;
  nonce: Base64;
}
