import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '../../server/gerado/prisma/index.js';
import { randomBytes } from 'node:crypto';

/**
 * O caminho inteiro de entrar na rede, num celular Android simulado.
 *
 * Contra o servidor de verdade e o banco de verdade. É o que dá a estes testes
 * o valor que uma API fingida não teria: aqui o convite é mesmo consumido, a
 * conta é mesmo criada, e dá para abrir o banco e conferir que a chave privada
 * não chegou lá.
 */

const banco = new PrismaClient();

/** Cria um convite direto no banco, como o `pnpm convite` faz. */
async function convitePronto(usos = 1): Promise<string> {
  const codigo = `E2E${randomBytes(3).toString('hex').toUpperCase()}-TEST-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  await banco.convite.create({
    data: { codigo, usosRestantes: usos, expiraEm: new Date(Date.now() + 86_400_000) },
  });
  return codigo;
}

/** Um identificador único por teste, para as contas não colidirem. */
function sufixo(): string {
  return randomBytes(4).toString('hex');
}

const SENHA = 'girassol na varanda de manha';

async function cadastrar(pagina: Page, convite: string, quem: string) {
  await pagina.goto('/');
  await pagina.getByRole('button', { name: /criar minha conta/i }).click();

  await pagina.getByLabel('Código do convite').fill(convite);
  await pagina.getByLabel('Seu nome').fill('Ana Teste');
  await pagina.getByLabel('Apelido').fill(quem);
  await pagina.getByLabel('E-mail').fill(`${quem}@exemplo.com`);
  await pagina.getByLabel('Senha', { exact: true }).fill(SENHA);

  await pagina.getByRole('button', { name: 'Criar conta' }).click();
}

test.afterAll(async () => {
  await banco.$disconnect();
});

test('o cadastro exige convite válido', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /criar minha conta/i }).click();

  await page.getByLabel('Código do convite').fill('CODIGO-QUE-NAO-EXISTE');
  await page.getByLabel('Seu nome').fill('Intruso');
  await page.getByLabel('Apelido').fill(`intruso${sufixo()}`);
  await page.getByLabel('E-mail').fill(`intruso${sufixo()}@exemplo.com`);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByText(/convite não vale/i)).toBeVisible();
});

test('o medidor barra a senha que só parece forte', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /criar minha conta/i }).click();

  const senha = page.getByLabel('Senha', { exact: true });

  // A clássica que "cumpre os requisitos": 12 caracteres, maiúscula, número e
  // símbolo. Ela tira nota 3 de 4 no zxcvbn — e cai em três horas. Era
  // exatamente ela que passava quando o porteiro era a nota.
  await senha.fill('Senha@123456');
  await expect(page.getByText(/fácil de quebrar/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/levaria 3 horas/i)).toBeVisible();

  // Uma frase em português, sem nenhum símbolo, que leva séculos.
  await senha.fill(SENHA);
  await expect(page.getByText(/levaria séculos/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/fácil de quebrar/i)).toHaveCount(0);
});

test('cadastro mostra a frase e cobra a confirmação antes de entrar', async ({ page }) => {
  const quem = `ana${sufixo()}`;
  await cadastrar(page, await convitePronto(), quem);

  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });

  // 24 palavras numeradas.
  const palavras = page.locator('ol li');
  await expect(palavras).toHaveCount(24);

  // O aviso precisa estar visível, não escondido num rodapé.
  await expect(page.getByText(/escreva no papel/i)).toBeVisible();

  await page.getByRole('button', { name: 'Já anotei' }).click();

  // A confirmação sorteia três posições e não deixa passar sem elas.
  await expect(page.getByRole('heading', { name: /confirme que anotou/i })).toBeVisible();
  await page.getByRole('button', { name: /confirmar e entrar/i }).click();
  await expect(page.getByText(/alguma palavra não bate/i)).toBeVisible();
});

test('a chave privada não chega ao servidor', async ({ page }) => {
  const quem = `ana${sufixo()}`;

  // Tudo que o navegador manda para a rede durante o cadastro.
  const enviado: string[] = [];
  page.on('request', (req) => {
    const corpo = req.postData();
    if (corpo) enviado.push(corpo);
  });

  await cadastrar(page, await convitePronto(), quem);
  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });

  // As palavras que a tela está mostrando.
  const frase = (await page.locator('ol li').allTextContents())
    .map((t) => t.replace(/^\d+\s*/, '').trim())
    .join(' ');

  const tudoQueSaiu = enviado.join('\n');

  // Nem a frase, nem nenhuma das palavras dela em sequência, nem a senha.
  expect(tudoQueSaiu).not.toContain(frase);
  expect(tudoQueSaiu).not.toContain(frase.split(' ').slice(0, 3).join(' '));

  // E o banco, do lado de lá, só tem chave pública.
  const usuario = await banco.usuario.findUnique({
    where: { email: `${quem}@exemplo.com` },
    include: { aparelhos: true },
  });

  expect(usuario).not.toBeNull();
  expect(usuario!.senhaHash).not.toContain(SENHA);
  expect(usuario!.senhaHash.startsWith('$argon2id$')).toBe(true);
  expect(JSON.stringify(usuario)).not.toContain(frase);
});

test('entra, tranca e destrava com a senha', async ({ page }) => {
  const quem = `ana${sufixo()}`;
  const convite = await convitePronto();

  await cadastrar(page, convite, quem);
  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });

  // Recarregar apaga a chave da memória — a sessão fica, as chaves trancam.
  // É exatamente o que acontece ao voltar para o app depois de um tempo.
  await page.reload();

  await expect(page.getByRole('heading', { name: /destravar|oi,/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel('Senha', { exact: true }).fill('a senha errada de propósito');
  await page.getByRole('button', { name: 'Destravar' }).click();
  await expect(page.getByText(/senha incorreta/i)).toBeVisible();

  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Destravar' }).click();

  await expect(page.getByRole('heading', { name: /oi, ana/i })).toBeVisible({ timeout: 30_000 });
});

test('quem administra gera convite pelo painel', async ({ page }) => {
  const quem = `chefe${sufixo()}`;

  // Zera as contas para que esta seja a primeira — e portanto administradora.
  await banco.registro.deleteMany();
  await banco.sessao.deleteMany();
  await banco.aparelho.deleteMany();
  await banco.membroDoCirculo.deleteMany();
  await banco.usuario.deleteMany();

  await cadastrar(page, await convitePronto(), quem);
  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Destravar' }).click();

  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('tab', { name: 'Convites' }).click();
  await page.getByRole('button', { name: 'Gerar convite' }).click();

  // Um código ditável por telefone: sem O, I, 0, 1 nem L.
  const codigo = page.locator('.font-mono').first();
  await expect(codigo).toBeVisible({ timeout: 15_000 });
  await expect(codigo).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('o aparelho aparece na lista e dá para revogá-lo', async ({ page }) => {
  const quem = `ana${sufixo()}`;
  await cadastrar(page, await convitePronto(), quem);
  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Destravar' }).click();

  await page.getByRole('button', { name: 'Ajustes' }).click();

  await expect(page.getByText('este aqui')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Revogar' }).first()).toBeVisible();
});

test('retrato da Fase 1', async ({ page }) => {
  const quem = `ana${sufixo()}`;
  await cadastrar(page, await convitePronto(), quem);

  await expect(page.getByRole('heading', { name: /frase de recuperação/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: 'retratos/fase-1-frase.png', fullPage: true });

  await page.reload();
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Destravar' }).click();
  await expect(page.getByRole('heading', { name: /oi, ana/i })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'retratos/fase-1-inicio.png', fullPage: true });

  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByText('este aqui')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'retratos/fase-1-ajustes.png', fullPage: true });
});
