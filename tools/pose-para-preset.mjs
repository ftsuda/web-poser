// Converte poses salvas pelo usuário (biblioteca de poses → `poses.json`) nos
// blocos de preset de `src/figure/posePresets.ts`.
//
//   npm run pose:preset -- caminho/para/poses.json
//   npm run pose:preset -- poses.json --pose="Herói" --key=heroStance
//
// O trabalho de verdade está em `src/figure/poseCodegen.ts`, com testes; este
// arquivo é só a linha de comando. O TypeScript é carregado pelo próprio Vite
// (já é dependência do projeto), então não há passo de build nem pacote novo.
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const [, , arquivo, ...resto] = process.argv

if (!arquivo) {
  console.error('uso: npm run pose:preset -- <poses.json> [--pose="Nome"] [--key=chave]')
  process.exit(1)
}

const opcao = (nome) => {
  const encontrada = resto.find((a) => a.startsWith(`--${nome}=`))
  return encontrada ? encontrada.slice(nome.length + 3).replace(/^"|"$/g, '') : null
}

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { parsePosesFile } = await server.ssrLoadModule('/src/persistence/posesFile.ts')
  const { savedPoseToPresetCode } = await server.ssrLoadModule('/src/figure/poseCodegen.ts')

  const json = JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf-8'))
  const todas = parsePosesFile(json)

  const filtro = opcao('pose')
  const poses = filtro
    ? todas.filter((p) => p.name.toLowerCase().includes(filtro.toLowerCase()))
    : todas

  if (poses.length === 0) {
    console.error(
      filtro
        ? `nenhuma pose com "${filtro}" em ${arquivo} — há ${todas.length}: ${todas.map((p) => p.name).join(', ')}`
        : `nenhuma pose legível em ${arquivo}`,
    )
    process.exit(1)
  }

  if (filtro && poses.length > 1) {
    console.error(`"${filtro}" casa com ${poses.length} poses: ${poses.map((p) => p.name).join(', ')}`)
  }

  for (const pose of poses) {
    const { key, code, avisos } = savedPoseToPresetCode(pose, poses.length === 1 ? opcao('key') : null)

    console.log(`\n${'─'.repeat(72)}\n${pose.name}  →  ${key}\n${'─'.repeat(72)}\n`)
    console.log(code)

    if (avisos.length > 0) {
      console.log('\nAVISOS:')
      for (const aviso of avisos) console.log(`  ⚠ ${aviso}`)
    }

    console.log(`
FALTA À MÃO (o que o gerador não tem como saber):
  1. \`PosePresetKey\`: acrescentar '${key}' à união de chaves.
  2. \`POSE_PRESET_GROUPS\`: pôr '${key}' num grupo — é ele que define a ordem no combo,
     e \`POSE_PRESET_KEYS\` é derivado dele (há teste travando os dois sentidos).
  3. i18n nos DOIS idiomas: 'panels.properties.posePreset<Chave>' e, se a pose merecer
     explicação, '...Hint' (o teste de paridade pt-BR/en reprova se faltar num deles).
  4. \`POSE_PRESET_LABEL_KEYS\` no PropertiesPanel — é um Record completo, o build cobra.
  5. Um teste de INTENÇÃO em posePresets.test.ts: o que tem de ser verdade nesta pose
     ("as duas solas chapadas", "a mão à frente do rosto"), medido em coordenadas de mundo.
  6. Se for pose em dupla, o pareamento em \`posePairs.ts\` (o teste cobre os dois sentidos).`)
  }
} finally {
  await server.close()
}
