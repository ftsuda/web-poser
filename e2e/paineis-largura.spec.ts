import { expect, test } from '@playwright/test'

/**
 * Largura dos painéis da bancada — o que jsdom NÃO alcança, porque não calcula
 * layout nenhum (DECISOES.md #125 e #126). Roda à parte da suíte, por
 * `npm run test:e2e`, como o smoke do módulo de poses.
 *
 * Duas coisas se conferem aqui:
 *
 * 1. **Nenhum painel rola na horizontal.** `.panel` tem `overflow-y: auto`, o
 *    que faz o `overflow-x` deixar de ser `visible` — qualquer filho que não
 *    caiba vira barra de rolagem. Foi assim que o `min-inline-size: min-content`
 *    do `<fieldset>` passou despercebido.
 * 2. **O grupo de rotação aproveita a coluna:** o slider ocupa o que sobra
 *    depois do valor e do cadeado, e a linha de ajuste fino vai de ponta a
 *    ponta do grupo.
 */

/** Tela de desktop: a bancada mostra os painéis todos. */
const DESKTOP = { width: 1600, height: 950 }

/** Abre a bancada com um boneco acrescentado e selecionado. */
async function bancadaComBoneco(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await page.getByRole('button', { name: 'Adicionar boneco' }).click()
  // Quem seleciona é o `li` da lista; o clique do meio dele cairia no campo do
  // nome, que interrompe a propagação de propósito — daí o evento direto.
  await page.locator('.figures-panel__row').first().dispatchEvent('click')
  await expect(page.locator('.panel--properties fieldset')).not.toHaveCount(0)
}

test('nenhum painel da bancada rola na horizontal', async ({ page }) => {
  await bancadaComBoneco(page)

  // Toda seção recolhida aberta: é o pior caso de conteúdo por coluna.
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => {
      document
        .querySelectorAll('.panel [aria-expanded="false"]')
        .forEach((el) => (el as HTMLElement).click())
    })
  }

  const sobras = await page.evaluate(() =>
    (Array.from(document.querySelectorAll('.panel')) as HTMLElement[])
      .filter((p) => !p.classList.contains('panel--collapsed'))
      .map((p) => ({ painel: p.className, sobra: p.scrollWidth - p.clientWidth })),
  )
  expect(sobras.length).toBeGreaterThan(0)
  expect(sobras.filter((s) => s.sobra > 0)).toEqual([])
})

test('o grupo de rotação aproveita a largura da coluna', async ({ page }) => {
  await bancadaComBoneco(page)

  const medidas = await page.evaluate(() => {
    const grupo = Array.from(document.querySelectorAll('.panel--properties fieldset')).find((f) =>
      (f.querySelector('legend')?.textContent ?? '').startsWith('Rotação'),
    ) as HTMLElement
    const estilo = getComputedStyle(grupo)
    const caixa = grupo.getBoundingClientRect()
    const esq = caixa.left + parseFloat(estilo.borderLeftWidth) + parseFloat(estilo.paddingLeft)
    const dir = caixa.right - parseFloat(estilo.borderRightWidth) - parseFloat(estilo.paddingRight)
    const linha = grupo.querySelector('.properties-panel__axis-row') as HTMLElement
    const fino = grupo.querySelector('.properties-panel__fine') as HTMLElement
    const slider = linha.querySelector('input[type=range]') as HTMLElement
    const cadeado = linha.querySelector('.properties-panel__axis-lock') as HTMLElement
    const valor = linha.querySelector('.properties-panel__value') as HTMLElement

    // A caixa do valor tem de caber o maior número possível, "-180°". O medidor
    // é um CLONE do próprio elemento, e não um `<span>` novo com a fonte
    // copiada na mão: só assim a medida sai na fonte que a cascata de fato
    // aplicou. Fora do fluxo, para não empurrar a linha enquanto mede.
    const medidor = valor.cloneNode(false) as HTMLElement
    medidor.textContent = '-180°'
    medidor.style.width = 'auto'
    medidor.style.position = 'absolute'
    medidor.style.visibility = 'hidden'
    valor.parentElement?.appendChild(medidor)
    const larguraDoMaiorValor = medidor.getBoundingClientRect().width
    medidor.remove()

    return {
      util: dir - esq,
      slider: slider.getBoundingClientRect().width,
      valor: valor.getBoundingClientRect().width,
      larguraDoMaiorValor,
      finoEsq: fino.getBoundingClientRect().left - esq,
      finoDir: dir - fino.getBoundingClientRect().right,
      cadeadoDir: dir - cadeado.getBoundingClientRect().right,
    }
  })

  // A linha de ajuste fino vai de ponta a ponta do grupo — sem margem sobrando
  // à esquerda (era 2 rem) nem à direita.
  expect(medidas.finoEsq).toBeLessThanOrEqual(1)
  expect(medidas.finoDir).toBeLessThanOrEqual(1)

  // O cadeado encosta na borda direita: é o fim da linha do slider.
  expect(medidas.cadeadoDir).toBeLessThanOrEqual(1)

  // O valor reserva o necessário para "-180°" e nada além: a folga seria
  // exatamente o que o slider deixou de medir. O `5ch` do CSS faz a conta bater
  // em qualquer fonte mono — a tolerância é só de arredondamento subpixel.
  expect(Math.abs(medidas.valor - medidas.larguraDoMaiorValor)).toBeLessThanOrEqual(0.5)

  // O slider fica com mais da METADE da coluna. Antes do ajuste media 107,6 px
  // de 213,8 (50,3%) — o bastante para o número ficar solto no meio do vazio.
  expect(medidas.slider / medidas.util).toBeGreaterThan(0.57)
})
