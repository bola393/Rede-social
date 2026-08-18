/**
 * Os valores fixos do domínio, num lugar só.
 *
 * Servidor, interface e banco precisam concordar sobre estes nomes. Definindo
 * aqui, uma mudança quebra a compilação em vez de virar um bug silencioso.
 */

/** Quem pode ver um post. */
export const VISIBILIDADES = ['SO_EU', 'CASAL', 'CIRCULO', 'TODOS'] as const;
export type Visibilidade = (typeof VISIBILIDADES)[number];

/** Papel de uma pessoa dentro da rede. */
export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];

/** Conversa entre duas pessoas, ou em grupo. */
export const TIPOS_DE_CONVERSA = ['DIRETA', 'GRUPO'] as const;
export type TipoDeConversa = (typeof TIPOS_DE_CONVERSA)[number];

/** O que uma mensagem carrega. */
export const TIPOS_DE_MENSAGEM = ['TEXTO', 'AUDIO', 'IMAGEM', 'VIDEO', 'ARQUIVO', 'SISTEMA'] as const;
export type TipoDeMensagem = (typeof TIPOS_DE_MENSAGEM)[number];

/** Chamada só de voz, ou com vídeo. */
export const TIPOS_DE_CHAMADA = ['VOZ', 'VIDEO'] as const;
export type TipoDeChamada = (typeof TIPOS_DE_CHAMADA)[number];

/** Como uma chamada terminou. */
export const STATUS_DA_CHAMADA = [
  'TOCANDO',
  'EM_ANDAMENTO',
  'ENCERRADA',
  'RECUSADA',
  'PERDIDA',
  'FALHOU',
] as const;
export type StatusDaChamada = (typeof STATUS_DA_CHAMADA)[number];

/**
 * Quando a contagem de uma mensagem temporária começa.
 *
 * `APOS_ENVIO` some no prazo, tenha sido lida ou não — bom para lembretes.
 * `APOS_LEITURA` só começa a contar quando a pessoa abre — bom para segredos,
 * porque garante que ela teve a chance de ler.
 */
export const MODOS_DE_EXPIRACAO = ['APOS_ENVIO', 'APOS_LEITURA'] as const;
export type ModoDeExpiracao = (typeof MODOS_DE_EXPIRACAO)[number];

/** As opções de prazo que aparecem na interface, em segundos. */
export const PRAZOS_DE_EXPIRACAO = [
  { segundos: 5, rotulo: '5 segundos' },
  { segundos: 60, rotulo: '1 minuto' },
  { segundos: 3_600, rotulo: '1 hora' },
  { segundos: 28_800, rotulo: '8 horas' },
  { segundos: 86_400, rotulo: '24 horas' },
  { segundos: 604_800, rotulo: '7 dias' },
] as const;

/** Prazos aceitos pelo servidor. Qualquer outro valor é recusado. */
export const SEGUNDOS_VALIDOS: readonly number[] = PRAZOS_DE_EXPIRACAO.map((p) => p.segundos);
