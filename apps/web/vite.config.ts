import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nossa Rede',
        short_name: 'Nossa Rede',
        description: 'Nossa rede social privada',
        lang: 'pt-BR',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icone-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // O WebAssembly do libsodium precisa estar em cache, senão a rede não
        // abre offline — e é justamente offline que ela precisaria decifrar o
        // que já está guardado no aparelho.
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,woff2}'],
        // Nunca servir resposta de API a partir do cache: mostrar mensagem
        // velha como se fosse nova seria pior do que não mostrar nada.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],

  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORTA_SERVIDOR ?? 3000}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://localhost:${process.env.PORTA_SERVIDOR ?? 3000}`,
        ws: true,
      },
    },
  },

  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * O libsodium sozinho passa de um megabyte — ele carrega o WebAssembly
         * embutido no próprio arquivo. Deixá-lo junto do resto significaria
         * baixar tudo de novo a cada correção de interface.
         *
         * Separado, ele é baixado uma vez e fica no cache. Quem estiver no 4G
         * agradece.
         *
         * A divisão é pelo caminho do arquivo, e não pelo nome do pacote: o
         * pnpm não deixa o app web enxergar `libsodium-wrappers-sumo` pelo
         * nome, já que ele é dependência do `@rede/crypto`, não daqui.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('libsodium') || id.includes('@scure')) return 'cripto';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
          return undefined;
        },
      },
    },
  },
});
