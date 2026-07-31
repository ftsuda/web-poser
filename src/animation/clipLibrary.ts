import { getHeightScale, type JointRotation } from '../figure/skeleton'
import { asRecord, readRotation, sanitizePose, toVec3 } from '../figure/figureFormat'
import type { Figure } from '../store/figuresStore'
import { clampKeyframeDuration, type Animation, type AnimationKeyframe } from './animation'

/**
 * Biblioteca de TRECHOS do usuário (PLANO.md > lista de propostas, item 39):
 * uma faixa de keyframes vira item nomeado, reaplicável em qualquer animação de
 * qualquer cena — o mesmo mecanismo da biblioteca de poses (DECISOES.md #42),
 * um nível acima.
 *
 * **O que o trecho guarda:** os keyframes literais — pose, colocação, giro e
 * duração de cada passo. **Não guarda a câmera** (decisão do usuário): ao
 * inserir, o trecho congela a câmera viva em todos os keyframes, exatamente a
 * regra dos trechos de fábrica (DECISOES.md #60). Assim um trecho do usuário se
 * comporta como um pronto, em vez de sequestrar o enquadramento de quem o
 * aplica.
 *
 * **Papéis, não bonecos.** O trecho grava PAPÉIS (0, 1, 2…), na ordem em que os
 * bonecos aparecem na cena gravada; ao inserir, cada papel é mapeado para um
 * boneco da cena atual. Só entram como papel os bonecos que MUDAM ao longo da
 * faixa: quem ficou parado o tempo todo era cenário, não parte do trecho (se
 * ninguém se mexe, todos entram — é o caso de uma pausa gravada de propósito).
 *
 * **Reancoragem.** O trecho é gravado em coordenadas absolutas e reinserido
 * relativo ao boneco escolhido para o papel 0: a diferença de posição e de
 * heading é aplicada a todos os papéis, como os trechos de fábrica fazem com o
 * boneco A. Deslocamentos no chão são reescalados pela razão de altura, e a
 * altura do quadril acompanha a escala do próprio boneco — as mesmas regras de
 * `applyPosePreset`.
 */

export interface SavedClipFigureState {
  /** Índice do papel (0 = âncora do trecho). */
  role: number
  pose: Record<string, JointRotation>
  rotation: JointRotation
  position: [number, number, number]
}

export interface SavedClipStep {
  /** Duração, em ms, da transição que CHEGA a este passo (a do primeiro é ignorada). */
  durationMs: number
  /** Rótulo do grupo do keyframe gravado (item 38), quando havia um. */
  label?: string
  figures: SavedClipFigureState[]
}

export interface SavedClip {
  id: string
  name: string
  /** Altura, em metros, de cada papel na gravação — é o que permite reescalar os deslocamentos. */
  roleHeights: number[]
  steps: SavedClipStep[]
}

function sameFigureState(a: Figure, b: Figure): boolean {
  if (a.position.some((value, index) => value !== b.position[index])) return false
  if (a.rotation.x !== b.rotation.x || a.rotation.y !== b.rotation.y || a.rotation.z !== b.rotation.z) {
    return false
  }
  return a.pose === b.pose || JSON.stringify(a.pose) === JSON.stringify(b.pose)
}

/**
 * Grava uma faixa de keyframes (`fromIndex`..`toIndex`, inclusive) como trecho
 * reutilizável. Devolve `null` quando a faixa não existe ou tem menos de dois
 * keyframes — um trecho de um keyframe só é uma pose, e para isso já existe a
 * biblioteca de poses.
 */
export function captureClipFromAnimation(
  animation: Animation,
  fromIndex: number,
  toIndex: number,
  options: { id: string; name: string },
): SavedClip | null {
  const first = Math.min(fromIndex, toIndex)
  const last = Math.max(fromIndex, toIndex)
  if (first < 0 || last >= animation.keyframes.length || last - first < 1) return null

  const range = animation.keyframes.slice(first, last + 1)
  const candidates = range[0].figures

  // Só é papel quem se mexe na faixa; se ninguém se mexe, o trecho é uma pausa
  // e todos entram.
  const moved = candidates.filter((figure) =>
    range.some((keyframe) => {
      const other = keyframe.figures.find((candidate) => candidate.id === figure.id)
      return other !== undefined && !sameFigureState(figure, other)
    }),
  )
  const roles = moved.length > 0 ? moved : candidates
  if (roles.length === 0) return null

  const steps: SavedClipStep[] = range.map((keyframe) => ({
    // A duração que CHEGA ao primeiro passo do trecho não vale nada dentro
    // dele: quem a define é onde o trecho for inserido.
    durationMs: keyframe.durationMs,
    ...(keyframe.label ? { label: keyframe.label } : {}),
    figures: roles.map((role, roleIndex) => {
      const figure = keyframe.figures.find((candidate) => candidate.id === role.id) ?? role
      return {
        role: roleIndex,
        pose: figure.pose,
        rotation: figure.rotation,
        position: [...figure.position] as [number, number, number],
      }
    }),
  }))

  return {
    id: options.id,
    name: options.name.trim() || 'Trecho',
    roleHeights: roles.map((role) => role.height),
    steps,
  }
}

/** Quantos bonecos o trecho precisa para ser inserido. */
export function clipRoleCount(clip: SavedClip): number {
  return clip.roleHeights.length
}

export interface ResolvedClipStepFigure {
  role: number
  pose: Record<string, JointRotation>
  rotation: JointRotation
  position: [number, number, number]
}

/**
 * O trecho reancorado num boneco: posição e heading passam a ser relativos a
 * onde o boneco do papel 0 está agora, e os deslocamentos no chão são
 * reescalados pela razão de altura.
 */
export function resolveSavedClip(
  clip: SavedClip,
  anchor: { position: readonly [number, number, number]; headingDeg: number; heightM: number },
): ResolvedClipStepFigure[][] {
  const recorded = clip.steps[0]?.figures.find((figure) => figure.role === 0)
  if (!recorded) return []

  const deltaDeg = anchor.headingDeg - recorded.rotation.y
  const rad = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const groundScale = getHeightScale(anchor.heightM) / getHeightScale(clip.roleHeights[0] ?? anchor.heightM)

  return clip.steps.map((step) =>
    step.figures.map((figure) => {
      // Deslocamento em relação à âncora gravada, girado pelo heading novo.
      const dx = (figure.position[0] - recorded.position[0]) * groundScale
      const dz = (figure.position[2] - recorded.position[2]) * groundScale
      const heightRatio =
        getHeightScale(anchor.heightM) / getHeightScale(clip.roleHeights[figure.role] ?? anchor.heightM)

      return {
        role: figure.role,
        pose: figure.pose,
        rotation: { ...figure.rotation, y: figure.rotation.y + deltaDeg },
        position: [
          anchor.position[0] + dx * cos + dz * sin,
          // A altura do quadril acompanha a escala do próprio boneco, como em
          // qualquer aplicação de pose.
          figure.position[1] * heightRatio,
          anchor.position[2] - dx * sin + dz * cos,
        ] as [number, number, number],
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Leitura de dado não confiável (autosave, `clips.json`)
// ---------------------------------------------------------------------------

/** Lê uma lista de trechos vinda de fora (autosave ou `clips.json` editado à mão). */
export function sanitizeSavedClips(value: unknown): SavedClip[] {
  if (!Array.isArray(value)) return []

  const clips: SavedClip[] = []
  value.forEach((candidate, index) => {
    const source = asRecord(candidate)
    if (!Array.isArray(source.steps)) return

    const steps: SavedClipStep[] = []
    for (const rawStep of source.steps) {
      const step = asRecord(rawStep)
      if (!Array.isArray(step.figures) || step.figures.length === 0) continue
      const label = typeof step.label === 'string' ? step.label.trim() : ''
      steps.push({
        durationMs: clampKeyframeDuration(step.durationMs),
        ...(label === '' ? {} : { label }),
        figures: step.figures.map((rawFigure, roleIndex) => {
          const figure = asRecord(rawFigure)
          return {
            role: typeof figure.role === 'number' ? figure.role : roleIndex,
            pose: sanitizePose(figure.pose),
            rotation: readRotation(figure.rotation),
            position: toVec3(figure.position, [0, 0, 0]),
          }
        }),
      })
    }
    // Um trecho de menos de dois passos não interpola nada.
    if (steps.length < 2) return

    const roleCount = Math.max(...steps.map((step) => step.figures.length))
    const heights = Array.isArray(source.roleHeights) ? source.roleHeights : []

    clips.push({
      id: typeof source.id === 'string' ? source.id : `clip-${index + 1}`,
      name: typeof source.name === 'string' && source.name.trim() !== '' ? source.name : `Clip ${index + 1}`,
      roleHeights: Array.from({ length: roleCount }, (_, role) =>
        typeof heights[role] === 'number' ? (heights[role] as number) : 1.7,
      ),
      steps,
    })
  })
  return clips
}

/**
 * Os keyframes que o trecho vira ao ser inserido, já reancorados e com a câmera
 * congelada.
 *
 * `assignments` é uma lista de elencos: cada elenco põe um boneco em cada papel
 * do trecho. Um trecho de um papel só pode ser aplicado a vários bonecos ao
 * mesmo tempo (item 37) — aí são vários elencos de um boneco cada, e cada um
 * executa o trecho a partir de onde está.
 */
export function buildKeyframesFromClip(options: {
  clip: SavedClip
  assignments: readonly (readonly Figure[])[]
  /** Todos os bonecos da cena — quem não participa aparece parado em todos os passos. */
  sceneFigures: readonly Figure[]
  camera: AnimationKeyframe['camera']
  /** Id do primeiro keyframe novo: `k<baseSeq + 1>`. */
  baseSeq: number
  /** Rótulo do grupo, já livre de colisão. */
  label?: string
}): AnimationKeyframe[] {
  const { clip, assignments, sceneFigures, camera, baseSeq, label } = options

  // Um retrato por passo, por boneco escalado: `figureId -> estado`.
  const posedByStep: Map<string, ResolvedClipStepFigure>[] = clip.steps.map(() => new Map())

  for (const cast of assignments) {
    const anchorFigure = cast[0]
    if (!anchorFigure) continue

    const resolved = resolveSavedClip(clip, {
      position: anchorFigure.position,
      headingDeg: anchorFigure.rotation.y,
      heightM: anchorFigure.height,
    })

    resolved.forEach((stepFigures, index) => {
      for (const posed of stepFigures) {
        const figure = cast[posed.role]
        if (figure) posedByStep[index]?.set(figure.id, posed)
      }
    })
  }

  return clip.steps.map((step, index) => ({
    id: `k${baseSeq + index + 1}`,
    durationMs: step.durationMs,
    figures: sceneFigures.map((figure) => {
      const posed = posedByStep[index].get(figure.id)
      if (!posed) return figure
      return { ...figure, pose: posed.pose, rotation: posed.rotation, position: posed.position }
    }),
    camera,
    ...(label ? { label } : {}),
  }))
}
