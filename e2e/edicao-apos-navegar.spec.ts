import { expect, test, type Page } from '@playwright/test'

/**
 * **Navegar pela linha do tempo não pode travar a edição.** Roda à parte da
 * suíte, por `npm run test:e2e`, como a largura dos painéis (DECISOES.md #126).
 *
 * O que ele protege (DECISOES.md #133 e #134): a pré-visualização do animador é
 * desenhada **no lugar** da cena de trabalho, e é isso que faz dela uma
 * armadilha — com ela na tela, editar uma junta continua acontecendo, no store,
 * de verdade, mas nada muda no viewport. Do lado de quem usa, o app "entrou num
 * modo e não sai": a única saída conhecida era "Parar", que zera a régua.
 *
 * O sintoma é justamente o que jsdom não alcança. Lá dá para afirmar que
 * `preview` ficou nulo — e foi o que os testes de unidade passaram a cobrir —,
 * mas "a mudança de pose aparece na tela" é uma pergunta sobre PIXELS, e foi
 * assim, comparando o viewport antes e depois de uma edição, que os dois
 * controles esquecidos apareceram. Um por teste, porque o caminho de cada um é
 * diferente e o interessante é saber QUAL travou.
 */
test.setTimeout(180_000)

const DESKTOP = { width: 1440, height: 900 }

/** Bancada com um boneco selecionado, dois keyframes e a régua aberta. */
async function bancadaComAnimacao(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Adicionar boneco' }).click()
  // Quem seleciona é o `li` da lista; o clique do meio dele cairia no campo do
  // nome, que interrompe a propagação de propósito — daí o evento direto.
  await page.locator('.figures-panel__row').first().dispatchEvent('click')

  const abrirAnimacao = page.getByRole('button', { name: /^Expandir painel Anima/ })
  if (await abrirAnimacao.count()) await abrirAnimacao.first().click()
  const capturar = page.getByRole('button', { name: 'Capturar keyframe' })
  await expect(capturar).toBeEnabled()
  await capturar.click()
  await capturar.click()

  const abrirRegua = page.getByRole('button', { name: 'Expandir painel Linha do tempo' })
  if (await abrirRegua.count()) await abrirRegua.first().click()
}

/**
 * Gira a colocação do boneco pelo painel de Propriedades e exige que o viewport
 * MUDE. Pelo teclado, com o foco no slider: cada seta é um ajuste discreto, sem
 * depender de arrasto (que o Playwright alcança, mas com muito mais cerimônia).
 */
async function aEdicaoApareceNaTela(page: Page): Promise<void> {
  const antes = await page.locator('.viewport').screenshot()

  const slider = page.locator('.panel--properties input[type="range"]').first()
  await slider.evaluate((elemento: HTMLInputElement) => elemento.focus())
  for (let i = 0; i < 25; i += 1) await slider.press('ArrowRight')
  await page.waitForTimeout(400)

  const depois = await page.locator('.viewport').screenshot()
  expect(antes.equals(depois), 'a pose mudou no store, mas o viewport não').toBe(false)
}

test('depois das setas de quadro, a edição aparece', async ({ page }) => {
  await bancadaComAnimacao(page)
  const avancar = page.getByRole('button', { name: /Um quadro para frente/ })
  for (let i = 0; i < 8; i += 1) await avancar.click()

  await aEdicaoApareceNaTela(page)
})

test('depois do ⏭, a edição aparece', async ({ page }) => {
  await bancadaComAnimacao(page)
  await page.getByRole('button', { name: 'Próximo keyframe' }).click()
  await page.waitForTimeout(300)

  await aEdicaoApareceNaTela(page)
})

test('depois de arrastar a régua, a edição aparece', async ({ page }) => {
  await bancadaComAnimacao(page)

  // Arrasto de verdade — `pointerdown`, mover, `pointerup` —, porque é o
  // `pointerup` que leva o instante para a bancada.
  const regua = page.locator('#timeline-position')
  const caixa = (await regua.boundingBox())!
  await page.mouse.move(caixa.x + 10, caixa.y + caixa.height / 2)
  await page.mouse.down()
  await page.mouse.move(caixa.x + caixa.width * 0.35, caixa.y + caixa.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(300)

  await aEdicaoApareceNaTela(page)
})

test('depois de pausar no meio da reprodução, a edição aparece', async ({ page }) => {
  await bancadaComAnimacao(page)
  await page.getByRole('button', { name: 'Tocar' }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Pausar' }).click()
  await page.waitForTimeout(300)

  await aEdicaoApareceNaTela(page)
})

test('depois de inserir um keyframe, a edição aparece', async ({ page }) => {
  await bancadaComAnimacao(page)
  const avancar = page.getByRole('button', { name: /Um quadro para frente/ })
  for (let i = 0; i < 12; i += 1) await avancar.click()
  await page.getByRole('button', { name: 'Inserir keyframe aqui' }).click()
  await page.waitForTimeout(300)

  await aEdicaoApareceNaTela(page)
})
