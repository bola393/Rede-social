/**
 * O jeito de falar com o servidor.
 *
 * Duas responsabilidades que valem estar num lugar só:
 *
 * 1. **Guardar o token de acesso na memória**, e não no `localStorage`. Token
 *    em `localStorage` sobrevive ao fechar a aba e fica ao alcance de qualquer
 *    script que rode na página. Na memória, ele morre junto com a aba — e a
 *    sessão continua viva pelo cookie de renovação, que o JavaScript não lê.
 *
 * 2. **Renovar sozinho quando o token vence.** O acesso dura 15 minutos; sem
 *    isto, o app quebraria na cara de quem ficou um tempo sem mexer.
 */

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly campo?: string,
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
  }
}

/** Fica só na memória, de propósito. Veja o comentário do topo. */
let tokenDeAcesso: string | null = null;

/** Evita várias renovações em paralelo quando o token vence com o app ocupado. */
let renovacaoEmCurso: Promise<boolean> | null = null;

export function guardarAcesso(token: string | null): void {
  tokenDeAcesso = token;
}

export function temAcesso(): boolean {
  return tokenDeAcesso !== null;
}

async function renovar(): Promise<boolean> {
  renovacaoEmCurso ??= (async () => {
    try {
      const resposta = await fetch('/api/acesso/renovar', {
        method: 'POST',
        credentials: 'include',
      });
      if (!resposta.ok) return false;

      tokenDeAcesso = ((await resposta.json()) as { acesso: string }).acesso;
      return true;
    } catch {
      return false;
    } finally {
      renovacaoEmCurso = null;
    }
  })();

  return renovacaoEmCurso;
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'DELETE';
  corpo?: unknown;
  /** Marca interna: evita renovar em laço quando a renovação é que falhou. */
  jaTentouRenovar?: boolean;
}

export async function chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, jaTentouRenovar = false } = opcoes;

  const resposta = await fetch(caminho, {
    method: metodo,
    credentials: 'include',
    headers: {
      ...(corpo ? { 'content-type': 'application/json' } : {}),
      ...(tokenDeAcesso ? { authorization: `Bearer ${tokenDeAcesso}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

  // Token vencido: renova uma vez, em silêncio, e repete a chamada.
  if (resposta.status === 401 && !jaTentouRenovar && caminho !== '/api/acesso/renovar') {
    if (await renovar()) {
      return chamar<T>(caminho, { ...opcoes, jaTentouRenovar: true });
    }
    tokenDeAcesso = null;
  }

  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => ({}))) as { erro?: string; campo?: string };
    throw new ErroDaApi(resposta.status, erro.erro ?? textoParaStatus(resposta.status), erro.campo);
  }

  return (await resposta.json()) as T;
}

/**
 * O que dizer quando o servidor não explicou.
 *
 * Acontece quando ele nem chegou a responder — rede caiu, PC desligou. O texto
 * precisa apontar para a causa provável, porque quem está lendo não sabe o que
 * é um código de status.
 */
function textoParaStatus(status: number): string {
  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Você não tem permissão para isso.';
  if (status === 404) return 'Não encontrei o que você pediu.';
  if (status === 429) return 'Muitas tentativas seguidas. Espere alguns minutos.';
  if (status >= 500) return 'O servidor teve um problema. Se persistir, rode o DIAGNOSTICO.bat.';
  return 'Algo deu errado.';
}

/** Tenta recuperar a sessão ao abrir o app, usando o cookie de renovação. */
export async function retomarSessao(): Promise<boolean> {
  return renovar();
}
