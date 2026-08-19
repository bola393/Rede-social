import { randomBytes } from 'node:crypto';
import { PrismaClient } from '../apps/server/gerado/prisma/index.js';
import { cinza, lerEnv, negrito, verde, vermelho } from './comum.js';

/**
 * `pnpm convite` — cria um convite pelo terminal.
 *
 * ## Por que existe
 *
 * Ninguém entra na rede sem convite, e convites são criados por quem já está
 * dentro. Só que no primeiro dia não há ninguém dentro. Este script resolve o
 * impasse: quem tem acesso ao terminal do servidor — ou seja, o dono da
 * máquina — cria o convite inicial.
 *
 * **A primeira pessoa a se cadastrar administra a rede.**
 *
 * Depois disso, o caminho normal é o painel de Ajustes, dentro do app. Este
 * comando continua servindo para o dia em que você se trancar para fora.
 *
 * Uso:
 *     pnpm convite              (1 uso, vale 7 dias)
 *     pnpm convite 3            (3 usos)
 *     pnpm convite 3 30         (3 usos, vale 30 dias)
 */

function gerarCodigo(): string {
  // Sem O, 0, I, 1 e L: são os que as pessoas confundem ao ditar um código.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const letras = Array.from(randomBytes(12), (b) => alfabeto[b % alfabeto.length]);
  return `${letras.slice(0, 4).join('')}-${letras.slice(4, 8).join('')}-${letras.slice(8, 12).join('')}`;
}

async function principal(): Promise<void> {
  const env = lerEnv();

  if (!env.DATABASE_URL) {
    console.error(vermelho('Não encontrei a DATABASE_URL no .env. Rode `pnpm preparar` primeiro.'));
    process.exit(1);
  }

  const usos = Number(process.argv[2] ?? 1);
  const dias = Number(process.argv[3] ?? 7);

  if (!Number.isInteger(usos) || usos < 1 || usos > 50) {
    console.error(vermelho('O número de usos precisa ser um inteiro entre 1 e 50.'));
    process.exit(1);
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
    console.error(vermelho('A validade precisa ser um número de dias entre 1 e 90.'));
    process.exit(1);
  }

  const banco = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  try {
    const quantasContas = await banco.usuario.count();

    const convite = await banco.convite.create({
      data: {
        codigo: gerarCodigo(),
        usosRestantes: usos,
        expiraEm: new Date(Date.now() + dias * 86_400_000),
        observacao: 'Criado pelo terminal',
      },
    });

    const vence = convite.expiraEm.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    console.log('');
    console.log(negrito('  Convite criado'));
    console.log(cinza('  ─────────────────────────────────────────'));
    console.log('');
    console.log(`      ${negrito(verde(convite.codigo))}`);
    console.log('');
    console.log(`  Vale para ${usos} ${usos === 1 ? 'pessoa' : 'pessoas'}, até ${vence}.`);
    console.log('');

    if (quantasContas === 0) {
      console.log(negrito('  Este é o primeiro convite da rede.'));
      console.log('');
      console.log('  Quem se cadastrar com ele será quem administra tudo:');
      console.log('  gera os próximos convites, remove membros, e por aí vai.');
      console.log('');
      console.log(`  Use você mesmo, abrindo https://${env.DOMINIO ?? 'seu-endereco'} .`);
      console.log('');
    } else {
      console.log(cinza('  Mande o código junto com o endereço da rede.'));
      console.log(cinza('  Daqui em diante, dá para criar convites pelo app, em Ajustes.'));
      console.log('');
    }
  } catch (erro) {
    console.error(vermelho('Não consegui criar o convite.'));
    console.error(cinza(erro instanceof Error ? erro.message : String(erro)));
    console.error('');
    console.error('O banco precisa estar no ar. Ligue a rede com INICIAR.bat e tente de novo.');
    process.exit(1);
  } finally {
    await banco.$disconnect();
  }
}

void principal();
