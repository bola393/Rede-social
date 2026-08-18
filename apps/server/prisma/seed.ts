import { PrismaClient } from '../gerado/prisma/index.js';

/**
 * Popula o banco com o mínimo para a rede fazer sentido no primeiro dia.
 *
 * Por enquanto são os círculos — os grupos que decidem quem vê cada post. Você
 * pode renomear, criar outros ou apagar depois; estes são só um ponto de
 * partida razoável.
 *
 * Rodar de novo não duplica nada.
 */

const banco = new PrismaClient();

const CIRCULOS = [
  { nome: 'Casal', cor: '#ff6b8a' },
  { nome: 'Família', cor: '#ffa94d' },
  { nome: 'Amigos', cor: '#7c8cff' },
];

async function principal(): Promise<void> {
  for (const circulo of CIRCULOS) {
    await banco.circulo.upsert({
      where: { nome: circulo.nome },
      update: {},
      create: circulo,
    });
  }

  console.log(`Círculos prontos: ${CIRCULOS.map((c) => c.nome).join(', ')}.`);
  console.log('');
  console.log('O primeiro cadastro ainda não existe — ele chega na Fase 1,');
  console.log('junto com os convites e o login.');
}

principal()
  .catch((erro: unknown) => {
    console.error('Não consegui preparar o banco:', erro);
    process.exit(1);
  })
  .finally(() => void banco.$disconnect());
