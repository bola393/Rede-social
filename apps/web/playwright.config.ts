import { defineConfig, devices } from '@playwright/test';

/**
 * Testes rodando num celular Android simulado.
 *
 * O que é real aqui: o tamanho de tela e a densidade de um Pixel 7, eventos de
 * toque em vez de mouse, o user agent do Chrome no Android, e câmera e
 * microfone respondendo de verdade (com um vídeo de teste no lugar da imagem).
 * Dá para gravar áudio, abrir a câmera e completar uma chamada WebRTC inteira,
 * tudo sem ninguém segurando um telefone.
 *
 * O que **não** é real: a WebView do Android, o diálogo de permissão do
 * sistema, a biometria, as notificações e o comportamento em segundo plano.
 * Essa parte só o aparelho de verdade responde — por isso o APK da Fase 6
 * ainda precisa ser instalado e testado à mão.
 */

const chromiumDoAmbiente = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: './testes',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 7'],
        permissions: ['camera', 'microphone'],
        launchOptions: {
          // Em alguns ambientes (containers, CI) o Chromium do Playwright já
          // está instalado noutro lugar. Sem isto, o teste tentaria baixar um
          // navegador que não cabe.
          ...(chromiumDoAmbiente ? { executablePath: chromiumDoAmbiente } : {}),
          args: [
            // Câmera e microfone falsos, para o teste rodar sozinho.
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
