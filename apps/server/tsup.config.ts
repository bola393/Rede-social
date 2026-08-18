import { defineConfig } from 'tsup';

/**
 * Como o servidor é empacotado para produção.
 *
 * Os pacotes `@rede/*` são consumidos como TypeScript puro — o que é ótimo em
 * desenvolvimento (salvou, recarregou) e impossível em produção, porque o Node
 * não executa `.ts`. Então eles são embutidos aqui dentro.
 *
 * O resto continua em `node_modules`. Duas dessas dependências *precisam* ficar
 * de fora: `argon2` é código nativo compilado, e o cliente do Prisma carrega o
 * motor de consulta por caminho de arquivo — embutir qualquer um dos dois
 * quebra na hora de rodar.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Só os pacotes do próprio projeto entram no pacote final.
  noExternal: [/^@rede\//],
  // O cliente do Prisma é importado por caminho relativo, então o empacotador
  // tentaria embuti-lo. Não pode: ele carrega o motor de consulta (um binário
  // .node) procurando por caminho de arquivo, e embutido ele não o acha.
  external: [/gerado\/prisma/],
  skipNodeModulesBundle: true,
});
