import {
  destrancarIdentidade,
  gerarIdentidade,
  inicializar,
  trancarIdentidade,
  type Identidade,
  type IdentidadeTrancada,
} from '@rede/crypto';

/**
 * O cofre das chaves, dentro do aparelho.
 *
 * ## A regra que este arquivo existe para cumprir
 *
 * A chave privada **nunca sai daqui**. Ela é criada neste aparelho, guardada
 * cifrada neste aparelho, e usada neste aparelho. Nenhuma função deste módulo
 * manda coisa alguma para a rede.
 *
 * ## Por que IndexedDB, e não localStorage
 *
 * O `localStorage` só guarda texto e é síncrono, o que travaria a tela ao
 * escrever. Mas o motivo principal é outro: o IndexedDB guarda os bytes como
 * bytes, sem conversões que deixariam cópias intermediárias da chave espalhadas
 * pela memória.
 *
 * ## O que fica guardado
 *
 * Apenas o envelope cifrado — o mesmo formato que o `@rede/crypto` produz. Sem
 * a senha (ou o PIN), o conteúdo do banco é indistinguível de ruído.
 */

const BANCO = 'nossa-rede';
const DEPOSITO = 'cofre';
const CHAVE_DO_COFRE = 'identidade';
const CHAVE_DO_PIN = 'identidade-pin';

/** A identidade destravada, viva só enquanto o app está aberto. */
let identidadeAberta: Identidade | null = null;

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolver, recusar) => {
    const pedido = indexedDB.open(BANCO, 1);

    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(DEPOSITO)) {
        pedido.result.createObjectStore(DEPOSITO);
      }
    };

    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => recusar(new Error('Não consegui abrir o cofre deste aparelho.'));
  });
}

async function guardar(chave: string, valor: unknown): Promise<void> {
  const banco = await abrirBanco();
  await new Promise<void>((resolver, recusar) => {
    const transacao = banco.transaction(DEPOSITO, 'readwrite');
    transacao.objectStore(DEPOSITO).put(valor, chave);
    transacao.oncomplete = () => resolver();
    transacao.onerror = () => recusar(new Error('Não consegui gravar no cofre.'));
  });
  banco.close();
}

async function ler<T>(chave: string): Promise<T | null> {
  const banco = await abrirBanco();
  const valor = await new Promise<T | null>((resolver) => {
    const pedido = banco.transaction(DEPOSITO, 'readonly').objectStore(DEPOSITO).get(chave);
    pedido.onsuccess = () => resolver((pedido.result as T) ?? null);
    pedido.onerror = () => resolver(null);
  });
  banco.close();
  return valor;
}

async function apagar(chave: string): Promise<void> {
  const banco = await abrirBanco();
  await new Promise<void>((resolver) => {
    const transacao = banco.transaction(DEPOSITO, 'readwrite');
    transacao.objectStore(DEPOSITO).delete(chave);
    transacao.oncomplete = () => resolver();
    transacao.onerror = () => resolver();
  });
  banco.close();
}

/**
 * Cria a identidade deste aparelho e a tranca com a senha.
 *
 * Só as chaves públicas devem ser enviadas ao servidor — é o chamador que faz
 * isso, com `partePublica()`.
 */
export async function criarIdentidade(senha: string): Promise<Identidade> {
  await inicializar();

  const identidade = gerarIdentidade();
  await guardar(CHAVE_DO_COFRE, trancarIdentidade(identidade, senha));

  identidadeAberta = identidade;
  return identidade;
}

/** Diz se este aparelho já tem uma identidade guardada. */
export async function temIdentidade(): Promise<boolean> {
  return (await ler<IdentidadeTrancada>(CHAVE_DO_COFRE)) !== null;
}

/**
 * Destrava a identidade com a senha.
 *
 * Devolve `null` quando a senha está errada. Sempre `null`, nunca uma pista
 * diferente para "quase certa".
 */
export async function destravarComSenha(senha: string): Promise<Identidade | null> {
  await inicializar();

  const cofre = await ler<IdentidadeTrancada>(CHAVE_DO_COFRE);
  if (!cofre) return null;

  const identidade = destrancarIdentidade(cofre, senha);
  if (identidade) identidadeAberta = identidade;
  return identidade;
}

/**
 * Guarda uma segunda cópia da identidade, trancada com o PIN.
 *
 * ## Por que existe uma segunda cópia
 *
 * Um PIN de seis dígitos tem um milhão de combinações. Isso é pouco demais
 * para proteger um arquivo que alguém possa levar embora e atacar com calma —
 * o Argon2id encarece cada tentativa, mas não o bastante.
 *
 * A troca é consciente: o PIN protege contra **quem pega o seu celular
 * desbloqueado por um minuto**, que é o risco real do dia a dia. Contra quem
 * leva o aparelho e tem tempo, o que protege é a senha.
 *
 * Por isso o PIN some sozinho depois de poucos erros: quem errar cinco vezes
 * volta a precisar da senha.
 */
export async function protegerComPin(identidade: Identidade, pin: string): Promise<void> {
  await inicializar();
  await guardar(CHAVE_DO_PIN, {
    cofre: trancarIdentidade(identidade, `pin:${pin}`),
    errosSeguidos: 0,
  });
}

export async function temPin(): Promise<boolean> {
  return (await ler(CHAVE_DO_PIN)) !== null;
}

interface CofreDoPin {
  cofre: IdentidadeTrancada;
  errosSeguidos: number;
}

/** Quantos erros seguidos até o PIN ser descartado. */
export const ERROS_ATE_PEDIR_SENHA = 5;

export interface ResultadoDoPin {
  identidade: Identidade | null;
  tentativasQueRestam: number;
  /** Ficou sem PIN: daqui em diante só a senha destrava. */
  pinDescartado: boolean;
}

export async function destravarComPin(pin: string): Promise<ResultadoDoPin> {
  await inicializar();

  const guardado = await ler<CofreDoPin>(CHAVE_DO_PIN);
  if (!guardado) return { identidade: null, tentativasQueRestam: 0, pinDescartado: true };

  const identidade = destrancarIdentidade(guardado.cofre, `pin:${pin}`);

  if (identidade) {
    identidadeAberta = identidade;
    await guardar(CHAVE_DO_PIN, { ...guardado, errosSeguidos: 0 });
    return { identidade, tentativasQueRestam: ERROS_ATE_PEDIR_SENHA, pinDescartado: false };
  }

  const erros = guardado.errosSeguidos + 1;

  if (erros >= ERROS_ATE_PEDIR_SENHA) {
    // Apaga a cópia protegida pelo PIN. A identidade continua no cofre da
    // senha — nada se perde, só o atalho.
    await apagar(CHAVE_DO_PIN);
    return { identidade: null, tentativasQueRestam: 0, pinDescartado: true };
  }

  await guardar(CHAVE_DO_PIN, { ...guardado, errosSeguidos: erros });
  return {
    identidade: null,
    tentativasQueRestam: ERROS_ATE_PEDIR_SENHA - erros,
    pinDescartado: false,
  };
}

export async function esquecerPin(): Promise<void> {
  await apagar(CHAVE_DO_PIN);
}

/** A identidade destravada, ou `null` se o app ainda está trancado. */
export function identidadeAtual(): Identidade | null {
  return identidadeAberta;
}

/**
 * Tranca o app: esquece a identidade da memória, sem apagar nada do disco.
 *
 * Chamado ao sair, e quando o app fica um tempo em segundo plano.
 */
export function trancar(): void {
  identidadeAberta = null;
}

/**
 * Apaga tudo o que este aparelho guarda.
 *
 * Depois disto, entrar de novo cria uma identidade nova. O histórico das
 * conversas só volta pela frase de recuperação.
 */
export async function esquecerTudo(): Promise<void> {
  identidadeAberta = null;
  await apagar(CHAVE_DO_COFRE);
  await apagar(CHAVE_DO_PIN);
}
