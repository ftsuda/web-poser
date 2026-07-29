import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // PWA instalável para uso 100% offline sem servidor, após o primeiro
    // acesso — ver PLANO.md > "Execução offline e distribuição" (fase 6).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Virtual Mockup',
        short_name: 'Virtual Mockup',
        description: 'Editor 3D offline para posar bonecos articulados e exportar keyframes de referência.',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#16171d',
        theme_color: '#2a1150',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precacheia todo o bundle (sem dependência de rede em runtime, ver
        // PLANO.md > "Stack técnica") para funcionar 100% offline após instalado.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    // Acima dos 5 s padrão (DECISOES.md #46): com a suíte já em ~1250 testes
    // rodando em paralelo, os casos legitimamente pesados — os 200 sorteios de
    // `randomPose` e os arquivos de painel que montam a UI inteira a cada
    // interação — passam dos 5 s por disputa de CPU, não por regressão. Cada
    // um deles roda em ~4 s isolado.
    testTimeout: 20000,
  },
})
