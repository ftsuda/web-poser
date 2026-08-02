import { configDefaults, defineConfig } from 'vitest/config'
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
        name: 'WebPoser',
        short_name: 'WebPoser',
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
        // Atalho do PWA (item 56): abre direto o módulo de poses pela URL —
        // `?shell=poses` vence o override gravado (ver `shellChoice.ts`).
        shortcuts: [
          {
            name: 'Módulo de poses',
            short_name: 'Poses',
            description: 'A casca de toque para posar no celular/tablet.',
            url: './?shell=poses',
            icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
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
    // Os specs de `e2e/` são do Playwright (item 57) e rodam por
    // `npm run test:e2e` — o vitest não pode tentar coletá-los.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Acima dos 5 s padrão (DECISOES.md #46): com a suíte já em ~1250 testes
    // rodando em paralelo, os casos legitimamente pesados — os 200 sorteios de
    // `randomPose` e os arquivos de painel que montam a UI inteira a cada
    // interação — passam dos 5 s por disputa de CPU, não por regressão. Cada
    // um deles roda em ~4 s isolado.
    testTimeout: 20000,
  },
})
