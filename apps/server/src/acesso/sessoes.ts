import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Papel } from '../../gerado/prisma/index.js';
import { banco } from '../banco.js';

/**
 * Sessões: o acesso curto e o de renovação.
 *
 * São dois tokens com papéis diferentes:
 *
 * - **acesso** (JWT, 15 minutos) acompanha cada requisição. É curto porque
 *   ele não pode ser cancelado — uma vez emitido, vale até vencer.
 * - **renovação** (aleatório, 30 dias, em cookie httpOnly) troca-se por um
 *   acesso novo. Fica no banco, então pode ser revogado na hora.
 *
 * ## Rotação, e por que ela importa
 *
 * Cada uso do token de renovação queima o antigo e devolve um novo. Se um
 * token vazar e o ladrão usá-lo, o dono da conta é derrubado no próximo uso —
 * e percebe. Sem rotação, os dois conviveriam em silêncio por trinta dias.
 */

/** Duração do token de acesso. Curto porque não dá para cancelá-lo. */
export const DURACAO_DO_ACESSO = '15m';

/** Duração do token de renovação. */
const DIAS_DE_RENOVACAO = 30;

/** O que vai dentro do token de acesso. Nada sensível — ele é legível. */
export interface Cracha {
  sub: string;
  papel: Papel;
  aparelho: string;
}

/**
 * O cookie que carrega o token de renovação.
 *
 * `httpOnly` para que JavaScript nenhum o leia — nem um script injetado.
 * `sameSite: lax` para que ele não viaje em requisição vinda de outro site.
 * `path` restrito às rotas que realmente precisam dele.
 */
export const COOKIE_DE_RENOVACAO = 'renovacao';

export function opcoesDoCookie(emProducao: boolean) {
  return {
    httpOnly: true,
    secure: emProducao,
    sameSite: 'lax' as const,
    path: '/api/acesso',
    maxAge: DIAS_DE_RENOVACAO * 24 * 60 * 60,
  };
}

/**
 * O token de renovação é guardado como hash, nunca em claro.
 *
 * Mesma lógica das senhas: se o banco vazar, os tokens de lá não servem para
 * entrar em nada. Aqui basta SHA-256, sem Argon2id — o token tem 256 bits de
 * aleatoriedade, então não existe "adivinhar" que valha a pena.
 */
function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export async function criarSessao(
  usuarioId: string,
  aparelhoId: string,
  descricao: string | undefined,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await banco.sessao.create({
    data: {
      usuarioId,
      aparelhoId,
      tokenHash: hashDoToken(token),
      expiraEm: new Date(Date.now() + DIAS_DE_RENOVACAO * 86_400_000),
      ...(descricao ? { descricao } : {}),
    },
  });

  return token;
}

export interface SessaoRenovada {
  token: string;
  usuarioId: string;
  aparelhoId: string | null;
  papel: Papel;
}

/**
 * Troca um token de renovação por um novo, derrubando o antigo.
 *
 * Devolve `null` sempre que algo não fecha — token desconhecido, vencido,
 * revogado, ou de uma conta desativada. Nunca dizemos qual dos casos.
 */
export async function renovarSessao(token: string): Promise<SessaoRenovada | null> {
  const sessao = await banco.sessao.findUnique({
    where: { tokenHash: hashDoToken(token) },
    include: { usuario: true },
  });

  if (!sessao || sessao.revogadoEm || sessao.expiraEm < new Date()) return null;
  if (sessao.usuario.desativadoEm) return null;

  const novoToken = randomBytes(32).toString('base64url');

  // Numa transação: o antigo morre e o novo nasce juntos. Se algo falhar no
  // meio, a pessoa continua com o token que já tinha em vez de ficar sem
  // nenhum.
  await banco.$transaction([
    banco.sessao.update({
      where: { id: sessao.id },
      data: { revogadoEm: new Date() },
    }),
    banco.sessao.create({
      data: {
        usuarioId: sessao.usuarioId,
        aparelhoId: sessao.aparelhoId,
        tokenHash: hashDoToken(novoToken),
        expiraEm: new Date(Date.now() + DIAS_DE_RENOVACAO * 86_400_000),
        ...(sessao.descricao ? { descricao: sessao.descricao } : {}),
      },
    }),
    banco.usuario.update({
      where: { id: sessao.usuarioId },
      data: { vistoPorUltimoEm: new Date() },
    }),
  ]);

  return {
    token: novoToken,
    usuarioId: sessao.usuarioId,
    aparelhoId: sessao.aparelhoId,
    papel: sessao.usuario.papel,
  };
}

/** Derruba uma sessão específica. Usado no "sair". */
export async function revogarSessao(token: string): Promise<void> {
  await banco.sessao.updateMany({
    where: { tokenHash: hashDoToken(token), revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
}

/** Derruba todas as sessões de uma pessoa, ou só as de um aparelho. */
export async function revogarTudo(usuarioId: string, aparelhoId?: string): Promise<number> {
  const { count } = await banco.sessao.updateMany({
    where: { usuarioId, revogadoEm: null, ...(aparelhoId ? { aparelhoId } : {}) },
    data: { revogadoEm: new Date() },
  });
  return count;
}

/**
 * Apaga sessões vencidas há mais de uma semana.
 *
 * A semana de folga é de propósito: uma sessão recém-vencida ainda conta uma
 * história útil na lista de "onde você entrou".
 */
export async function limparSessoesVelhas(): Promise<number> {
  const { count } = await banco.sessao.deleteMany({
    where: { expiraEm: { lt: new Date(Date.now() - 7 * 86_400_000) } },
  });
  return count;
}

/** Compara dois textos em tempo constante, para não vazar nada pelo relógio. */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
