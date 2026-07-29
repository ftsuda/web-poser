// Folha de contato das poses padrão: aplica TODAS as poses do combo e monta um
// PNG único com a grade, para revisar o catálogo inteiro de uma olhada — e para
// servir de linha de base quando o esqueleto mudar.
//
//   npm run preview            (noutro terminal)
//   npm run poses:folha -- --saida=./folha
//
// Opções: --url, --saida, --vista=padrao|girada|ambas, --coluna=<n>, --largura=<px>,
//         --limite=<n> (para iterar rápido), --playwright=<caminho com node_modules>
//
// Duas escolhas de método, medidas antes de fixar (ver DECISOES.md #57):
//
// 1. **Cada célula é um INSTANTÂNEO do app**, não uma captura de tela do
//    viewport. É o caminho que já esconde grade, gizmos e o destaque da junta
//    (`hideOverlaysOnCapture`) — sem isso o gizmo de seleção aparece em todas as
//    células, porque posar exige o boneco selecionado.
// 2. **Câmera em perspectiva com "plano geral", fixa em todas as células.** As
//    vistas ortográficas foram testadas e perdem: a de frente transforma toda
//    pose deitada num borrão, e a de 3/4 não enquadra. Fixa, a câmera é o que
//    faz a folha COMPARAR as poses; enquadrar pose a pose deixaria cada célula
//    bonita e a folha inútil.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [chave, ...valor] = a.replace(/^--/, '').split('=')
    return [chave, valor.join('=').replace(/^"|"$/g, '')]
  }),
)

const URL = args.url ?? 'http://localhost:4173/'
const SAIDA = path.resolve(args.saida ?? 'folha-de-contato')
// "padrão" é o enquadramento de plano geral como ele vem (já um 3/4 de frente);
// "girada" é ele mais 40° de órbita, que chega perto do perfil. Os nomes dizem o
// que a folha É, não o que se gostaria que fosse.
const VISTAS = args.vista === 'padrao' ? ['padrao'] : args.vista === 'girada' ? ['girada'] : ['padrao', 'girada']
const COLUNAS = Number(args.coluna ?? 8)
const LADO_CELULA = Number(args.largura ?? 260)
const RODAPE = 24
/** Quanto a câmera gira da vista padrão para a girada. */
const GIRO_GRAUS = 40

fs.mkdirSync(SAIDA, { recursive: true })
const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'folha-poses-'))

/**
 * O Playwright NÃO é dependência do projeto — a validação em navegador sempre
 * rodou de fora, e pendurar os navegadores no `npm install` de quem só quer
 * usar o app seria caro. Aceita-se um caminho de instalação em `--playwright=`.
 */
const require = createRequire(import.meta.url)
let chromium
try {
  const caminhos = [args.playwright, process.cwd()].filter(Boolean)
  const modulo = await import(pathToFileURL(require.resolve('playwright', { paths: caminhos })))
  chromium = (modulo.default ?? modulo).chromium
} catch {
  console.error(
    'este utilitário precisa do Playwright, que não é dependência do projeto:\n' +
      '  npm i -D playwright && npx playwright install chromium\n' +
      'ou aponte uma instalação existente: --playwright=/caminho/que/contenha/node_modules',
  )
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
const erros = []
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
page.on('pageerror', (e) => erros.push('pageerror: ' + e))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
} catch {
  console.error(`não consegui abrir ${URL} — rode "npm run preview" noutro terminal (ou passe --url=)`)
  await browser.close()
  process.exit(1)
}

await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

await page.getByRole('button', { name: 'Adicionar boneco' }).click()
await page.waitForTimeout(800)
await page.locator('#snapshot-resolution').selectOption('square')
await page.waitForTimeout(300)

const combo = page.locator('#pose-preset-select')
const canvas = page.locator('canvas').first()

/** Posar exige o boneco selecionado — daí a seleção a cada volta. */
async function aplicarPose(valor) {
  await page.locator('li.figures-panel__row').first().click()
  await page.waitForTimeout(180)
  await combo.selectOption(valor)
  await page.getByRole('button', { name: 'Aplicar pose' }).click()
  await page.waitForTimeout(320)
}

async function capturar(nome) {
  const espera = page.waitForEvent('download', { timeout: 120000 })
  await page.getByRole('button', { name: 'Capturar instantâneo' }).click()
  const arquivo = await espera
  const destino = path.join(temporario, `${nome}.png`)
  await arquivo.saveAs(destino)
  return destino
}

/**
 * Gira a câmera em torno da cena arrastando no canvas. O `OrbitControls`
 * converte pixels em ângulo pela ALTURA do elemento (2π por altura), então o
 * arrasto é calculado, não chutado.
 */
async function orbitar(graus) {
  const caixa = await canvas.boundingBox()
  const dx = (graus / 360) * caixa.height
  const cx = caixa.x + caixa.width / 2
  const cy = caixa.y + caixa.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx - dx, cy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}

await aplicarPose('tpose')
await page.locator('#camera-shot-select').selectOption('wide')
await page.getByRole('button', { name: 'Aplicar enquadramento' }).click()
await page.waitForTimeout(800)

const todasAsPoses = await combo.locator('option').evaluateAll((opcoes) =>
  opcoes.map((o) => ({ valor: o.value, rotulo: o.textContent.trim() })).filter((o) => o.valor),
)
const poses = args.limite ? todasAsPoses.slice(0, Number(args.limite)) : todasAsPoses
console.log(`${poses.length} poses; vista(s): ${VISTAS.join(', ')}; grade de ${COLUNAS} colunas`)

let giroAtual = 0
for (const vista of VISTAS) {
  const giroAlvo = vista === 'girada' ? GIRO_GRAUS : 0
  if (giroAlvo !== giroAtual) {
    await orbitar(giroAlvo - giroAtual)
    giroAtual = giroAlvo
  }

  const celulas = []
  for (const [indice, pose] of poses.entries()) {
    await aplicarPose(pose.valor)
    const arquivo = await capturar(`${vista}-${pose.valor}`)
    celulas.push({ ...pose, base64: fs.readFileSync(arquivo).toString('base64') })
    if ((indice + 1) % 10 === 0) console.log(`  ${vista}: ${indice + 1}/${poses.length}`)
  }

  // A montagem acontece DENTRO da página: um canvas 2D basta, e assim a
  // ferramenta não ganha dependência de processamento de imagem.
  const dataUrl = await page.evaluate(
    async ({ celulas, colunas, lado, rodape }) => {
      const linhas = Math.ceil(celulas.length / colunas)
      const folha = document.createElement('canvas')
      folha.width = colunas * lado
      folha.height = linhas * (lado + rodape)
      const ctx = folha.getContext('2d')
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(0, 0, folha.width, folha.height)

      for (const [i, celula] of celulas.entries()) {
        const img = new Image()
        img.src = 'data:image/png;base64,' + celula.base64
        await img.decode()

        const cx = (i % colunas) * lado
        const cy = Math.floor(i / colunas) * (lado + rodape)
        ctx.drawImage(img, cx, cy, lado, lado)
        ctx.strokeStyle = '#d4d4d8'
        ctx.strokeRect(cx + 0.5, cy + 0.5, lado - 1, lado - 1)

        ctx.fillStyle = '#18181b'
        ctx.font = '12px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(celula.rotulo, cx + lado / 2, cy + lado + 16, lado - 8)
      }
      return folha.toDataURL('image/png')
    },
    { celulas, colunas: COLUNAS, lado: LADO_CELULA, rodape: RODAPE },
  )

  const destino = path.join(SAIDA, `poses-${vista}.png`)
  fs.writeFileSync(destino, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log(`gravado: ${destino}`)
}

fs.rmSync(temporario, { recursive: true, force: true })
console.log('ERROS DE CONSOLE:', erros.length ? JSON.stringify(erros) : 'nenhum')
await browser.close()
