import { sanitizeFigure } from '../animation/animation'
import type { Figure } from '../store/figuresStore'

/**
 * Arquivo de POSE AVULSA de um boneco — a ponte entre a pose montada no celular
 * e o refino no computador (PLANO.md > "Edição em dispositivo touch",
 * DECISOES.md #81).
 *
 * **O formato é o do keyframe, não um novo.** O campo `figure` é exatamente o
 * objeto que vive dentro de `keyframes[].figures[]` do `animations.json` — mesmo
 * `pose`, mesma `rotation`, mesma `height`. A leitura passa pelo
 * `sanitizeFigure` da própria animação, então há uma regra só de validação e
 * grampeamento para os dois caminhos. É isso que permite, mais tarde, montar
 * poses no celular e emendá-las como keyframes aqui sem conversão nenhuma.
 *
 * **Colocação no chão não é pose.** Ao GRAVAR, o boneco é considerado sempre no
 * (0,0) do plano horizontal: X e Z saem zerados. Ao CARREGAR, X e Z do boneco de
 * destino são PRESERVADOS e só o Y vem do arquivo. A razão é que onde o boneco
 * pisa na cena é composição — quem recebe a pose já colocou o boneco no lugar
 * dele, e uma pose não tem por que arrastá-lo para a origem. O Y, ao contrário,
 * faz parte da pose: é ele que distingue um boneco agachado de um pulando, e
 * perdê-lo deixaria a pose flutuando ou enterrada.
 *
 * **O que o arquivo carrega e a leitura ignora.** Por reusar a estrutura do
 * keyframe, o JSON traz também `id`, `name`, `color` e `visible`. Nenhum deles é
 * aplicado ao carregar: identidade e aparência são do boneco de destino, não da
 * pose (mesma regra do `poses.json` e do `applyImportedPose`). Eles ficam no
 * arquivo em vez de serem removidos justamente para o objeto continuar sendo um
 * `figures[]` válido de animação.
 */

export const FIGURE_POSE_VERSION = 1

/** Explicação embutida no próprio arquivo — JSON não aceita comentários. */
const README_LINES: readonly string[] = [
  'Pose de UM boneco. O objeto "figure" tem exatamente a mesma estrutura de um boneco dentro de "keyframes[].figures[]" do animations.json — é o mesmo formato, não uma conversão.',
  'As juntas ficam em "pose", em GRAUS, como {"x":0,"y":0,"z":0} por junta. "rotation" é a inclinação do boneco inteiro e "height" a altura dele em metros.',
  'Ao gravar, o boneco é considerado no (0,0) do plano horizontal: "position" sai como [0, y, 0].',
  'Ao carregar, o boneco de destino MANTÉM onde está no plano (X e Z) e recebe do arquivo apenas a altura Y — agachar e pular fazem parte da pose, andar para o lado não.',
  '"id", "name", "color" e "visible" viajam para o objeto continuar sendo um boneco de animação válido, mas NÃO são aplicados ao carregar: identidade e cor são do boneco de destino.',
  'Juntas desconhecidas são descartadas e as que estiverem fora dos limites em vigor são ajustadas para dentro deles.',
  'Cuidado com pares L/R: nos eixos y e z o MESMO número produz o movimento oposto nos dois lados (ver DECISOES.md #14).',
  'A leitura também aceita um animations.json inteiro ou um keyframe solto: nesse caso entra o primeiro boneco do primeiro keyframe.',
]

export interface FigurePoseFile {
  version: number
  leiame: readonly string[]
  figure: Figure
}

/**
 * O boneco como ele vai para o arquivo: igual ao da cena, com a colocação no
 * plano horizontal zerada (ver o docblock acima).
 */
export function figureForPoseFile(figure: Figure): Figure {
  return { ...figure, position: [0, figure.position[1], 0] }
}

export function buildFigurePoseFile(figure: Figure): FigurePoseFile {
  return {
    version: FIGURE_POSE_VERSION,
    leiame: README_LINES,
    figure: figureForPoseFile(figure),
  }
}

/** O JSON de uma pose, pronto para baixar. */
export function serializeFigurePoseFile(figure: Figure): string {
  return JSON.stringify(buildFigurePoseFile(figure), null, 2)
}

/** O que a aplicação de uma pose lida precisa: tudo menos identidade e cor. */
export interface ImportedFigurePose {
  height: number
  /** Y da colocação — X e Z do arquivo são descartados aqui, não no store. */
  positionY: number
  rotation: Figure['rotation']
  pose: Figure['pose']
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** Primeiro boneco de uma lista de keyframes — keyframes sem bonecos são pulados. */
function figureFromKeyframes(keyframes: readonly unknown[]): unknown {
  for (const keyframe of keyframes) {
    const figures = asRecord(keyframe).figures
    if (Array.isArray(figures) && figures.length > 0) return figures[0]
  }
  return undefined
}

/**
 * Acha o boneco dentro de qualquer um dos formatos que a família de arquivos de
 * animação produz, do mais específico ao mais geral:
 *
 * 1. o arquivo de pose deste módulo (`{ figure }`);
 * 2. um boneco cru (quem edita à mão às vezes cola só ele);
 * 3. um keyframe solto (`{ figures: [...] }`);
 * 4. uma animação solta (`{ keyframes: [...] }`);
 * 5. um `animations.json` inteiro (`{ animations: [...] }`);
 * 6. um array cru de qualquer um dos acima — o mesmo carinho que
 *    `parseAnimationsFile` tem com quem cola só a lista.
 *
 * Nos casos com vários bonecos entra sempre o PRIMEIRO do primeiro keyframe que
 * tiver algum. Aceitar essa família toda é o que faz do arquivo de pose uma
 * ponte de verdade: uma animação exportada no computador serve de fonte de pose
 * sem precisar ser recortada à mão antes.
 */
function findFigureSource(json: unknown): unknown {
  if (Array.isArray(json)) {
    for (const entry of json) {
      const found = findFigureSource(entry)
      if (found !== undefined && found !== null) return found
    }
    return undefined
  }

  const source = asRecord(json)

  if (source.figure !== undefined) return source.figure
  // Um boneco cru é reconhecido pelo campo que só ele tem entre estes formatos.
  if (source.pose !== undefined) return source
  if (Array.isArray(source.figures) && source.figures.length > 0) return source.figures[0]
  if (Array.isArray(source.keyframes)) return figureFromKeyframes(source.keyframes)

  if (Array.isArray(source.animations)) {
    for (const animation of source.animations) {
      const keyframes = asRecord(animation).keyframes
      if (!Array.isArray(keyframes)) continue
      const found = figureFromKeyframes(keyframes)
      if (found !== undefined) return found
    }
  }

  return undefined
}

/**
 * Lê um arquivo de pose (nunca confiável). Devolve `null` quando não há boneco
 * nenhum a aproveitar — é o caso do arquivo que não é de pose, do vazio e do
 * `animations.json` cujos keyframes não têm bonecos.
 *
 * O grampeamento das juntas aos limites em vigor acontece aqui dentro, via
 * `sanitizeFigure`: uma pose vinda de um workspace com limites mais largos entra
 * ajustada, como em qualquer outro carregamento.
 */
export function parseFigurePoseFile(json: unknown): ImportedFigurePose | null {
  const candidate = findFigureSource(json)
  if (candidate === undefined || candidate === null) return null

  const figure = sanitizeFigure(candidate, 0)
  // `sanitizeFigure` nunca falha (preenche tudo com padrões), então um objeto
  // sem junta alguma passaria como pose vazia e apagaria a pose de destino sem
  // avisar. Exigir ao menos uma junta conhecida é o que distingue "pose lida"
  // de "arquivo que por acaso é um objeto".
  if (Object.keys(figure.pose).length === 0) return null

  return {
    height: figure.height,
    positionY: figure.position[1],
    rotation: figure.rotation,
    pose: figure.pose,
  }
}
