import { PrismaClient } from '@prisma/client';

/**
 * A conexão com o banco.
 *
 * Uma só para o processo inteiro. Em desenvolvimento o `tsx watch` recarrega o
 * módulo a cada arquivo salvo, e sem o cuidado abaixo cada recarga abriria um
 * pool novo — em poucos minutos o Postgres recusaria conexões, com um erro que
 * não tem nada a ver com a causa.
 */

const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const banco =
  global_.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global_.prisma = banco;
}

/** Confere se o banco responde. Usado pelo `/api/saude` e pelo `pnpm doutor`. */
export async function bancoResponde(): Promise<boolean> {
  try {
    await banco.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
