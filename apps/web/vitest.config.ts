import { defineConfig } from 'vitest/config';

/**
 * Dois tipos de teste convivem neste pacote, e eles não se misturam:
 *
 * - **vitest** roda funções isoladas, sem navegador (`src/*.test.ts`);
 * - **Playwright** abre a interface num celular Android simulado
 *   (`testes/*.spec.ts`), com câmera e microfone de verdade.
 *
 * Sem esta exclusão o vitest tentaria executar os arquivos do Playwright e
 * falharia com um erro que não diz nada sobre a causa.
 */
export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', 'testes/**'],
  },
});
