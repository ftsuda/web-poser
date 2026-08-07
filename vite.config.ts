import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** O que os dois projetos da suíte descartam por igual (os specs do Playwright moram em `e2e/`). */
const FORA_DA_SUITE = [...configDefaults.exclude, 'e2e/**']

/**
 * Testes de LÓGICA que mesmo assim precisam do navegador (PLANO.md item 23):
 * mexem em `localStorage`, `document` ou APIs de janela, então rodam no projeto
 * `interface` apesar de não montarem UI nenhuma. São a exceção — a regra é a
 * extensão: `.tsx` monta componente e vai para o jsdom, `.ts` é puro e vai
 * para o node.
 */
const PUROS_QUE_PRECISAM_DE_NAVEGADOR = [
  'src/persistence/__tests__/autosave.test.ts',
  'src/persistence/__tests__/autosaveKey.test.ts',
  'src/persistence/__tests__/uiPreferences.test.ts',
  'src/poses/__tests__/qrFrameReader.test.ts',
  'src/poses/__tests__/shellChoice.test.ts',
  'src/store/__tests__/sessionTransfer.test.ts',
  'src/store/__tests__/uiStore.test.ts',
  'src/store/__tests__/undoBatch.test.ts',
]

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
  /**
   * A suíte em DOIS projetos (PLANO.md item 23, DECISOES.md #120). Antes era um
   * só, com `environment: 'jsdom'` para todo mundo — e montar um jsdom custa
   * uns 6 s por ARQUIVO, antes do primeiro teste. Como 3 em cada 4 arquivos são
   * lógica pura, a maior parte desse custo era desperdício puro.
   *
   * `npx vitest run` continua rodando os dois; `npm run test:rapido` roda só o
   * `unidade`, que é o que se quer durante o desenvolvimento de lógica.
   */
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unidade',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...FORA_DA_SUITE, ...PUROS_QUE_PRECISAM_DE_NAVEGADOR],
          setupFiles: ['./src/test/setup-comum.ts'],
          globals: true,
          // Mesmo sem jsdom há casos legitimamente pesados — os 200 sorteios de
          // `randomPose` e a conferência de todos os trechos prontos passam dos
          // 5 s padrão por disputa de CPU, não por regressão (DECISOES.md #46).
          testTimeout: 20000,
        },
      },
      {
        extends: true,
        test: {
          name: 'interface',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', ...PUROS_QUE_PRECISAM_DE_NAVEGADOR],
          exclude: FORA_DA_SUITE,
          setupFiles: ['./src/test/setup.ts'],
          globals: true,
          css: true,
          // Acima dos 5 s padrão (DECISOES.md #46): os arquivos de painel
          // montam a UI inteira a cada interação e passam dos 5 s por disputa
          // de CPU, não por regressão. Vale só aqui — o projeto `unidade` não
          // tem nenhum caso perto disso.
          testTimeout: 20000,
        },
      },
    ],
  },
})
