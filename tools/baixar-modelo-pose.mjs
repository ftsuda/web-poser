// Baixa o modelo do MediaPipe Pose Landmarker (BlazePose, Apache 2.0) para
// `tools/models/` — o ÚNICO passo com rede da família `pose:from-image`, e
// explícito de propósito: o app continua zero-rede em runtime, e a ferramenta
// de linha de comando só carrega o modelo do disco.
//
//   npm run pose:model                # baixa uma vez (pula se já existe)
//   npm run pose:model -- --forcar    # baixa de novo por cima
//   npm run pose:model -- --url=...   # outra variante (lite/heavy)
import fs from 'node:fs'
import path from 'node:path'

const URL_PADRAO =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'

const resto = process.argv.slice(2)
const opcao = (nome) => {
  const encontrada = resto.find((a) => a.startsWith(`--${nome}=`))
  return encontrada ? encontrada.slice(nome.length + 3).replace(/^"|"$/g, '') : null
}

const url = opcao('url') ?? URL_PADRAO
const destino = path.resolve('tools/models', path.basename(new URL(url).pathname))

if (fs.existsSync(destino) && !resto.includes('--forcar')) {
  console.log(`modelo já existe em ${destino} — use --forcar para baixar de novo`)
  process.exit(0)
}

console.log(`baixando ${url}…`)
const resposta = await fetch(url)
if (!resposta.ok) {
  console.error(`falhou: HTTP ${resposta.status}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(destino), { recursive: true })
fs.writeFileSync(destino, Buffer.from(await resposta.arrayBuffer()))
console.log(`ok: ${destino} (${(fs.statSync(destino).size / 1024 / 1024).toFixed(1)} MB)`)
