import { defineConfig } from '@playwright/test'

/**
 * Smoke de navegador do módulo de poses (PLANO.md, item 57): cobre o que o
 * unit test não alcança — WebGL real, arrasto por PointerEvent, troca de
 * casca com recarga. NÃO substitui a suíte do vitest (`npx vitest run`); roda
 * à parte, por `npm run test:e2e`, sobre o dev server (subido sozinho).
 *
 * Um worker só: os testes compartilham o mesmo dev server, e cada teste já
 * ganha um contexto de navegador limpo (localStorage vazio) do Playwright.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    // Tela de celular em pé — o alvo do módulo (item 44).
    viewport: { width: 425, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 90_000,
  },
})
