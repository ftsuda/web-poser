import { expect, test, type Page } from '@playwright/test'

/**
 * Smoke do módulo de poses (item 57) — o que o unit test não alcança:
 * a casca decidida por URL e trocada pelos botões (com recarga de página),
 * o arrasto de junta por PointerEvent sobre o canvas WebGL real, o pan de
 * um dedo que é câmera (e não pose), e o console limpo em tudo isso.
 *
 * As asserções de POSE leem o autosave do módulo (`webposer:poses:v1`)
 * — o mesmo caminho que o app usa para persistir, sem expor nada interno só
 * para teste. O debounce é de 800 ms, por isso os `expect.poll`.
 */

const POSES_URL = '/?shell=poses'
const POSES_AUTOSAVE_KEY = 'webposer:poses:v1'

/** Erros de página e de console — todo teste termina conferindo que não houve nenhum. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

interface AutosavedFigure {
  position: [number, number, number]
  pose: Record<string, { x: number; y: number; z: number }>
}

async function readAutosavedFigures(page: Page): Promise<AutosavedFigure[] | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const payload = JSON.parse(raw) as { workingScene?: { figures?: unknown } }
    return (payload.workingScene?.figures ?? null) as AutosavedFigure[] | null
  }, POSES_AUTOSAVE_KEY)
}

/** Acrescenta um boneco pela aba Boneco e o escolhe para edição. */
async function addAndSelectFigure(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar boneco' }).click()
  await page.getByRole('button', { name: /Boneco 1/ }).click()
  // O Canvas do R3F é uma raiz React PRÓPRIA: o painel (DOM) confirma o clique
  // antes de o boneco existir na cena 3D. Dois rAF garantem um quadro pintado
  // com o boneco — sem isso, o pointerdown do arrasto raycasta o vazio.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/**
 * Posição em TELA da junta raiz na vista de frente: o centro do canvas mira o
 * alvo (0, 1, 0) e a câmera ortográfica enquadra `ORTHO_FRAME_HEIGHT_M`
 * (2,4 m) na altura — a raiz (0, 0,9, 0) fica 0,1 m abaixo do centro, ou seja
 * `altura/24` pixels. Derivado das mesmas constantes do viewport, não chutado.
 */
async function frontViewRootPosition(page: Page): Promise<{ x: number; y: number }> {
  const canvas = page.locator('canvas')
  // O `<canvas>` nasce no tamanho PADRÃO DO ELEMENTO (300×150) e só depois o
  // R3F o redimensiona ao contêiner. Os dois rAF do `addAndSelectFigure`
  // garantem um quadro pintado, mas não que o redimensionamento já tenha
  // acontecido — e medindo os 300×150 o ponto calculado cai no vazio, o
  // arrasto não pega junta nenhuma e o teste falha sem nada a ver com o que
  // ele testa. Esperar a largura crescer é o que torna a medida confiável.
  await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(300)

  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 + box.height / 24 }
}

async function dragPointer(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

test('a casca vem da URL e troca pelos botões, cada uma com a sua sessão', async ({ page }) => {
  const errors = trackErrors(page)

  // `?shell=poses` abre o módulo mesmo com ponteiro fino (item 56).
  await page.goto(POSES_URL)
  await expect(page.getByRole('button', { name: 'Frente' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Capturar keyframe' })).toBeVisible()

  // A volta para a aplicação completa recarrega SEM o parâmetro na URL —
  // senão a casca da URL venceria o override para sempre. Timeout folgado: na
  // primeira visita o dev server ainda compila os módulos da outra casca.
  await page.getByRole('button', { name: 'Abrir a aplicação completa' }).click()
  // `exact` porque o painel de Cenas ganhou "Trazer sessão do módulo de poses"
  // (item 54), que também casa com a busca por substring do modo estrito.
  await expect(page.getByRole('button', { name: 'Módulo de poses', exact: true })).toBeVisible({
    timeout: 30_000,
  })
  expect(new URL(page.url()).searchParams.get('shell')).toBeNull()

  // E a ida pela Toolbar devolve ao módulo.
  await page.getByRole('button', { name: 'Módulo de poses', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Capturar keyframe' })).toBeVisible({
    timeout: 30_000,
  })

  expect(errors).toEqual([])
})

test('arrastar a raiz na vista de frente move a colocação, e a captura vira keyframe', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(POSES_URL)
  await addAndSelectFigure(page)

  // O arrasto parte da esfera de toque da raiz e resolve no plano da vista
  // (Z travado) — a colocação muda em X/Y e o autosave do módulo registra.
  const root = await frontViewRootPosition(page)
  await dragPointer(page, root, { x: root.x + 80, y: root.y - 60 })

  // O poll só aceita uma posição JÁ MOVIDA — `null` enquanto o autosave não
  // gravou (senão o vazio passaria em falso: null ≠ [0,0,0]).
  await expect
    .poll(
      async () => {
        const position = (await readAutosavedFigures(page))?.[0]?.position
        return position && position.some((coord) => coord !== 0) ? position : null
      },
      { timeout: 5_000 },
    )
    .not.toBeNull()
  const figures = await readAutosavedFigures(page)
  expect(figures![0].position[0]).toBeGreaterThan(0.05)
  expect(figures![0].position[2]).toBeCloseTo(0, 6)

  // Botão flutuante: keyframe com câmera padrão, listado na aba.
  await page.getByRole('button', { name: 'Capturar keyframe' }).click()
  await page.getByRole('button', { name: 'Keyframes' }).click()
  await expect(page.getByText('Keyframe 1')).toBeVisible()

  expect(errors).toEqual([])
})

test('um dedo no vazio é câmera: o pan da vista de frente não toca na pose', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(POSES_URL)
  await addAndSelectFigure(page)

  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  // Longe do boneco: canto superior esquerdo do canvas.
  await dragPointer(
    page,
    { x: box.x + 40, y: box.y + 60 },
    { x: box.x + 180, y: box.y + 200 },
  )

  // O autosave nasce com o addFigure; o pan não pode ter mudado nada.
  await expect
    .poll(async () => (await readAutosavedFigures(page))?.length ?? 0, { timeout: 5_000 })
    .toBe(1)
  const figures = await readAutosavedFigures(page)
  expect(figures![0].position).toEqual([0, 0, 0])

  expect(errors).toEqual([])
})

test('vista Livre: cadeado alterna a edição, e a órbita travada não muda a pose', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto(POSES_URL)
  await addAndSelectFigure(page)

  await page.getByRole('button', { name: 'Livre' }).click()
  const unlock = page.getByRole('button', { name: 'Liberar a edição na vista livre' })
  await expect(unlock).toBeVisible()

  // Travada: um dedo orbita — pose e colocação ficam intactas.
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  await dragPointer(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + 150, y: box.y + box.height / 2 - 100 },
  )
  await expect
    .poll(async () => (await readAutosavedFigures(page))?.length ?? 0, { timeout: 5_000 })
    .toBe(1)
  expect((await readAutosavedFigures(page))![0].position).toEqual([0, 0, 0])

  // Destravar e travar de novo — o cadeado alterna (#93).
  await unlock.click()
  await expect(page.getByRole('button', { name: 'Travar a edição na vista livre' })).toBeVisible()
  await page.getByRole('button', { name: 'Travar a edição na vista livre' }).click()
  await expect(page.getByRole('button', { name: 'Liberar a edição na vista livre' })).toBeVisible()

  expect(errors).toEqual([])
})
