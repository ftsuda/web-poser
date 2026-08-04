// Imagem → pose do app (PLANO.md > "MCP de análise de pose", etapa 2).
//
//   npm run pose:from-image -- foto.jpg
//   npm run pose:from-image -- foto.jpg --out=poses/ --pessoas=4
//
// Pipeline: a foto entra num Chromium headless (Playwright) onde o MediaPipe
// Pose Landmarker (wasm, local — modelo baixado uma vez por `pose:model`)
// extrai os 33 world landmarks de cada pessoa; o retargeting de verdade mora
// em `src/pose-import/retarget.ts`, com testes — este arquivo é só a linha de
// comando, como o `pose-para-preset.mjs`. Sai um arquivo de pose do app
// ("Pose em arquivo", leitor único #86/#87) por pessoa detectada.
//
// Nada aqui toca a rede: o bundle do MediaPipe vem do node_modules, o modelo
// do disco, e a página falsa é servida por interceptação de rota.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const [, , imagem, ...resto] = process.argv

if (!imagem) {
  console.error('uso: npm run pose:from-image -- <imagem.jpg|png|webp> [--out=pasta] [--pessoas=4] [--modelo=…] [--playwright=…]')
  process.exit(1)
}

const opcao = (nome) => {
  const encontrada = resto.find((a) => a.startsWith(`--${nome}=`))
  return encontrada ? encontrada.slice(nome.length + 3).replace(/^"|"$/g, '') : null
}

const caminhoImagem = path.resolve(imagem)
if (!fs.existsSync(caminhoImagem)) {
  console.error(`imagem não encontrada: ${caminhoImagem}`)
  process.exit(1)
}

const MIMES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const mime = MIMES[path.extname(caminhoImagem).toLowerCase()]
if (!mime) {
  console.error(`formato não suportado: ${path.extname(caminhoImagem)} (aceitos: jpg, jpeg, png, webp)`)
  process.exit(1)
}

const modelo = path.resolve(opcao('modelo') ?? 'tools/models/pose_landmarker_full.task')
if (!fs.existsSync(modelo)) {
  console.error(`modelo não encontrado em ${modelo} — rode primeiro: npm run pose:model`)
  process.exit(1)
}

const pessoas = Math.max(1, Number(opcao('pessoas') ?? 4))
const saida = path.resolve(opcao('out') ?? path.dirname(caminhoImagem))

// Mesmo regime do `folha-de-contato.mjs`: o Playwright não é imposição do
// `npm install` de quem só usa o app — resolve-se o que houver instalado.
const require = createRequire(import.meta.url)
let chromium
try {
  const caminhos = [opcao('playwright'), process.cwd()].filter(Boolean)
  const modulo = await import(pathToFileURL(require.resolve('playwright', { paths: caminhos })))
  chromium = (modulo.default ?? modulo).chromium
} catch {
  console.error(
    'este utilitário precisa do Playwright (navegador headless para o wasm do MediaPipe):\n' +
      '  npx playwright install chromium\n' +
      'ou aponte uma instalação: --playwright=/caminho/que/contenha/node_modules',
  )
  process.exit(1)
}

// O `exports` do pacote não expõe o package.json — resolve-se o entry point
// (vision_bundle.cjs) e fica-se com a pasta.
const pacoteVision = path.dirname(require.resolve('@mediapipe/tasks-vision'))

const browser = await chromium.launch()
const page = await browser.newPage()
const errosDePagina = []
page.on('pageerror', (erro) => errosDePagina.push(String(erro)))

// A "origem" é falsa: cada caminho é servido do disco por interceptação.
const ORIGEM = 'http://webposer-pose.local'
await page.route(`${ORIGEM}/**`, (rota) => {
  const caminho = new URL(rota.request().url()).pathname
  if (caminho === '/index.html') {
    return rota.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
  }
  if (caminho === '/imagem') {
    return rota.fulfill({ contentType: mime, body: fs.readFileSync(caminhoImagem) })
  }
  if (caminho === '/modelo.task') {
    return rota.fulfill({ contentType: 'application/octet-stream', body: fs.readFileSync(modelo) })
  }
  const local = caminho.startsWith('/wasm/')
    ? path.join(pacoteVision, 'wasm', path.basename(caminho))
    : path.join(pacoteVision, path.basename(caminho))
  if (!fs.existsSync(local)) return rota.fulfill({ status: 404, body: 'não existe' })
  const tipo = local.endsWith('.mjs') || local.endsWith('.js') ? 'text/javascript' : 'application/wasm'
  return rota.fulfill({ contentType: tipo, body: fs.readFileSync(local) })
})

let deteccao
try {
  await page.goto(`${ORIGEM}/index.html`)
  await page.addScriptTag({
    type: 'module',
    content: `
      import { FilesetResolver, PoseLandmarker } from '/vision_bundle.mjs'
      window.__detectar = async (numPoses) => {
        const vision = await FilesetResolver.forVisionTasks('/wasm')
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/modelo.task', delegate: 'CPU' },
          runningMode: 'IMAGE',
          numPoses,
        })
        const img = new Image()
        img.src = '/imagem'
        await img.decode()
        const resultado = landmarker.detect(img)
        return {
          worldLandmarks: resultado.worldLandmarks.map((pessoa) =>
            pessoa.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
          ),
        }
      }
      window.__pronto = true
    `,
  })
  await page.waitForFunction(() => window.__pronto === true)
  deteccao = await page.evaluate((numPoses) => window.__detectar(numPoses), pessoas)
} catch (erro) {
  console.error(`falha na detecção: ${erro}`)
  for (const e of errosDePagina) console.error(`  página: ${e}`)
  await browser.close()
  process.exit(1)
} finally {
  await browser.close()
}

if (!deteccao || deteccao.worldLandmarks.length === 0) {
  console.error('nenhuma pessoa detectada na imagem.')
  process.exit(1)
}

console.log(`${deteccao.worldLandmarks.length} pessoa(s) detectada(s) em ${path.basename(caminhoImagem)}`)

// Retargeting + serialização: os módulos do próprio app, via Vite SSR — uma
// fonte de verdade só (mudou o esqueleto, quebra aqui em vez de divergir).
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { retargetPose } = await server.ssrLoadModule('/src/pose-import/retarget.ts')
  const { serializeFigurePoseFile } = await server.ssrLoadModule('/src/persistence/figurePoseFile.ts')

  const base = path.basename(caminhoImagem, path.extname(caminhoImagem))
  const varias = deteccao.worldLandmarks.length > 1
  fs.mkdirSync(saida, { recursive: true })

  deteccao.worldLandmarks.forEach((landmarks, indice) => {
    const rotulo = varias ? `${base} — pessoa ${indice + 1}` : base
    const resultado = retargetPose(landmarks, { name: rotulo })
    if (!resultado) {
      console.error(`  pessoa ${indice + 1}: landmarks insuficientes (quadris/ombros ocultos) — pulada.`)
      return
    }

    const arquivo = path.join(saida, `${base}${varias ? `-pessoa-${indice + 1}` : ''}-pose.json`)
    fs.writeFileSync(arquivo, serializeFigurePoseFile(resultado.figure))
    console.log(`  → ${arquivo}`)
    for (const aviso of resultado.warnings) console.log(`    ⚠ ${aviso}`)
  })

  console.log(
    '\npara usar: painel de Propriedades > "Pose em arquivo" > Importar (desktop),\n' +
      'ou módulo de poses > aba Arquivo > "Aplicar pose do arquivo".',
  )
} finally {
  await server.close()
}
