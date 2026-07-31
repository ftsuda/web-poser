import { getHeightScale } from '../figure/skeleton'
import type { CameraViewState } from '../scene/cameraMove'
import type { Figure } from '../store/figuresStore'
import type { AnimationKeyframe } from './animation'

/**
 * Remapeamento de uma animação importada para os bonecos que já estão em cena
 * (fase 12, decisão do usuário). Sem ele, importar uma animação gravada em
 * outra cena SUBSTITUI o elenco: os bonecos do arquivo — com os nomes, cores e
 * alturas de lá — passam a ser os da cena. Com ele, o arquivo vira o que sempre
 * foi de fato: uma coreografia. Quem a executa são os seus bonecos.
 *
 * **Papéis, não bonecos** — a mesma ideia dos trechos salvos (`clipLibrary`).
 * O papel 0 é o primeiro boneco gravado, o 1 o segundo, e assim por diante;
 * quem importa diz qual boneco da cena faz cada papel.
 *
 * **Por que não reusa `resolveSavedClip`.** Aquela função resolve um trecho a
 * partir de UMA âncora e escala a altura de todos os papéis pela altura do
 * boneco âncora — aproximação que funciona num trecho de dupla e erra numa
 * animação de elenco misto (um boneco de 1,55 m no papel 1 herdaria a escala do
 * de 1,90 m no papel 0). Aqui cada papel é corrigido pela PRÓPRIA altura, e
 * ainda há a câmera para transportar, que o trecho não tem (DECISOES.md #60).
 *
 * O que o boneco da cena mantém: id, nome, cor e altura. O que ele recebe do
 * arquivo: pose, giro, colocação e visibilidade, keyframe a keyframe.
 */

/**
 * Como as posições gravadas chegam à cena.
 *
 * - `absolute`: cada boneco assume a colocação gravada, e a câmera do arquivo
 *   continua enquadrando exatamente o que enquadrava. É o modo de SUBSTITUIR:
 *   a animação chega inteira, como foi gravada.
 * - `anchored`: a ação é transportada para onde o boneco do papel 0 está agora
 *   (posição e heading), e a câmera vai junto pelo mesmo transporte. É o modo
 *   de ANEXAR, onde a emenda com o que já está na linha do tempo é que importa.
 */
export type RemapAnchoring = 'absolute' | 'anchored'

/**
 * Os papéis da animação importada, na ordem: o primeiro boneco gravado é o
 * papel 0. A lista é a UNIÃO dos bonecos de todos os keyframes (por id, na
 * ordem em que aparecem) — uma animação montada enquanto se acrescentava um
 * boneco à cena não tem o mesmo elenco em todos os keyframes.
 *
 * Devolve os bonecos gravados em si (não só os ids): o diálogo de importação
 * mostra os nomes de lá para quem escolhe quem faz o quê.
 */
export function importedAnimationRoles(keyframes: readonly AnimationKeyframe[]): Figure[] {
  const roles: Figure[] = []
  const seen = new Set<string>()
  for (const keyframe of keyframes) {
    for (const figure of keyframe.figures) {
      if (seen.has(figure.id)) continue
      seen.add(figure.id)
      roles.push(figure)
    }
  }
  return roles
}

/** Giro em torno do eixo Y, na convenção de heading do app (a mesma de `resolveSavedClip`). */
function rotateXZ(
  dx: number,
  dz: number,
  cos: number,
  sin: number,
): { x: number; z: number } {
  return { x: dx * cos + dz * sin, z: -dx * sin + dz * cos }
}

/**
 * Leva um ponto do mundo pelo transporte rígido do remapeamento ancorado: giro
 * pelo heading novo em torno da âncora gravada, e translação até a âncora da
 * cena. Sem escala — a câmera não encolhe nem cresce com a altura do boneco.
 */
function transportPoint(
  point: readonly [number, number, number],
  anchor: { recorded: readonly [number, number, number]; scene: readonly [number, number, number] },
  cos: number,
  sin: number,
): [number, number, number] {
  const { x, z } = rotateXZ(point[0] - anchor.recorded[0], point[2] - anchor.recorded[2], cos, sin)
  return [anchor.scene[0] + x, point[1], anchor.scene[2] + z]
}

/**
 * Leva a câmera gravada pelo mesmo transporte dos bonecos: `position` e
 * `target` são pontos do mundo e giram junto com a translação; `up` é direção e
 * só gira. É isto que faz o enquadramento sobreviver à reancoragem — sem ele, a
 * animação anexada mostraria o chão vazio onde ela foi gravada.
 *
 * A lente não muda. O enquadramento é EXATO quando o boneco âncora da cena tem
 * a altura do gravado; com alturas diferentes, os deslocamentos no chão são
 * reescalados (como nos trechos) e a câmera não, então o enquadramento fica
 * aproximado.
 */
export function transportCameraView(
  view: CameraViewState,
  anchor: { recorded: readonly [number, number, number]; scene: readonly [number, number, number] },
  headingDeltaDeg: number,
): CameraViewState {
  const rad = (headingDeltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const up = rotateXZ(view.up[0], view.up[2], cos, sin)

  return {
    position: transportPoint(view.position, anchor, cos, sin),
    target: transportPoint(view.target, anchor, cos, sin),
    up: [up.x, view.up[1], up.z],
    focalMm: view.focalMm,
  }
}

export interface RemapOptions {
  /** A linha do tempo lida do arquivo. */
  keyframes: readonly AnimationKeyframe[]
  /** Os bonecos da cena — os que não recebem papel aparecem parados em todos os keyframes. */
  sceneFigures: readonly Figure[]
  /**
   * Id do boneco da cena que faz cada papel, na ordem dos papéis. Papel sem
   * boneco (string vazia ou id que não existe) simplesmente não é executado.
   */
  assignment: readonly string[]
  anchoring: RemapAnchoring
  /** Id do primeiro keyframe gerado: `k<baseSeq + 1>`. */
  baseSeq: number
}

/**
 * Um keyframe do arquivo já traduzido para o elenco da cena, mas ainda SEM
 * decidir onde ele entra: quem monta o keyframe final é quem chama.
 *
 * `posed` traz só os bonecos que têm papel — os demais dependem do destino, e
 * é justamente aí que remapear (que parte da cena) e substituir (que parte do
 * keyframe da bancada) divergem.
 */
interface RemappedKeyframe {
  /** `id do boneco da cena -> estado que ele assume neste keyframe`. */
  posed: Map<string, Figure>
  camera: CameraViewState
  durationMs: number
  label?: string
}

/**
 * O miolo do remapeamento, compartilhado pelos dois modos. Devolve `null`
 * quando nenhum papel tem boneco — quem chama trata isso como "não dá para
 * remapear", e não como uma animação vazia.
 */
function remapPosedKeyframes(options: Omit<RemapOptions, 'baseSeq'>): RemappedKeyframe[] | null {
  const { keyframes, sceneFigures, assignment, anchoring } = options
  if (keyframes.length === 0) return null

  const roles = importedAnimationRoles(keyframes)
  /** `id gravado -> boneco da cena que o executa`. */
  const cast = new Map<string, Figure>()
  roles.forEach((role, index) => {
    const figure = sceneFigures.find((candidate) => candidate.id === assignment[index])
    if (figure) cast.set(role.id, figure)
  })
  if (cast.size === 0) return null

  // Âncora: o papel 0 como ele foi gravado no PRIMEIRO keyframe, e o boneco da
  // cena que o executa. Sem papel 0 mapeado não há de onde transportar, e o
  // remapeamento cai no absoluto — que é o que ele já é quando ninguém âncora.
  const recordedAnchor = roles[0]
  const sceneAnchor = cast.get(recordedAnchor?.id ?? '')
  const transported = anchoring === 'anchored' && recordedAnchor !== undefined && sceneAnchor !== undefined

  const headingDeltaDeg = transported ? sceneAnchor.rotation.y - recordedAnchor.rotation.y : 0
  const rad = (headingDeltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const anchorPoints = {
    recorded: recordedAnchor?.position ?? ([0, 0, 0] as const),
    scene: sceneAnchor?.position ?? ([0, 0, 0] as const),
  }
  // Deslocamento no chão acompanha a razão de altura entre o boneco âncora e o
  // gravado — a mesma regra dos trechos: um boneco mais alto dá passos maiores.
  const groundScale = transported
    ? getHeightScale(sceneAnchor.height) / getHeightScale(recordedAnchor.height)
    : 1

  /**
   * Estado gravado de cada papel no keyframe atual. Papel ausente de um
   * keyframe (elenco que mudou no meio da montagem) mantém o último estado
   * conhecido — e, antes de aparecer, o primeiro.
   */
  const lastKnown = new Map<string, Figure>(roles.map((role) => [role.id, role]))

  return keyframes.map((keyframe) => {
    for (const figure of keyframe.figures) {
      if (lastKnown.has(figure.id)) lastKnown.set(figure.id, figure)
    }

    /** `id do boneco da cena -> estado que ele assume neste keyframe`. */
    const posed = new Map<string, Figure>()
    for (const role of roles) {
      const target = cast.get(role.id)
      if (!target) continue
      const recorded = lastKnown.get(role.id) ?? role

      // A altura do quadril (e de qualquer deslocamento vertical) acompanha a
      // escala do PRÓPRIO boneco: quem executa a pose é ele, não o gravado.
      const heightRatio = getHeightScale(target.height) / getHeightScale(recorded.height)
      const y = recorded.position[1] * heightRatio

      let position: [number, number, number]
      let rotationY = recorded.rotation.y
      if (transported) {
        const offset = rotateXZ(
          (recorded.position[0] - anchorPoints.recorded[0]) * groundScale,
          (recorded.position[2] - anchorPoints.recorded[2]) * groundScale,
          cos,
          sin,
        )
        position = [anchorPoints.scene[0] + offset.x, y, anchorPoints.scene[2] + offset.z]
        rotationY += headingDeltaDeg
      } else {
        position = [recorded.position[0], y, recorded.position[2]]
      }

      posed.set(target.id, {
        ...target,
        pose: recorded.pose,
        rotation: { ...recorded.rotation, y: rotationY },
        position,
        // Aparecer e sumir fazem parte da coreografia: a visibilidade é a
        // gravada. Nome, cor e altura continuam sendo os do boneco da cena.
        visible: recorded.visible,
      })
    }

    return {
      posed,
      durationMs: keyframe.durationMs,
      camera: transported
        ? transportCameraView(keyframe.camera, anchorPoints, headingDeltaDeg)
        : keyframe.camera,
      ...(keyframe.label ? { label: keyframe.label } : {}),
    }
  })
}

/**
 * A animação importada executada pelos bonecos da cena. Devolve `[]` quando
 * nenhum papel tem boneco — quem chama trata isso como "não dá para remapear",
 * e não como uma animação vazia.
 *
 * Os keyframes saem com a duração e o rótulo gravados; renumerar rótulos
 * repetidos é de quem insere na linha do tempo (`figuresStore`), que é quem
 * sabe o que já está lá.
 *
 * O retrato de cada keyframe é a CENA INTEIRA: quem não tem papel aparece
 * parado onde está agora, porque não há linha do tempo anterior de onde tirá-lo
 * — a animação toda está sendo escrita do zero.
 */
export function remapImportedKeyframes(options: RemapOptions): AnimationKeyframe[] {
  const remapped = remapPosedKeyframes(options)
  if (!remapped) return []

  return remapped.map((frame, index) => ({
    id: `k${options.baseSeq + index + 1}`,
    durationMs: frame.durationMs,
    figures: options.sceneFigures.map((figure) => frame.posed.get(figure.id) ?? figure),
    camera: frame.camera,
    ...(frame.label ? { label: frame.label } : {}),
  }))
}

// ---------------------------------------------------------------------------
// Substituição a partir de um keyframe (pedido do usuário, 2026-07-31)
// ---------------------------------------------------------------------------

export interface SubstituteOptions {
  /** A linha do tempo lida do arquivo. */
  keyframes: readonly AnimationKeyframe[]
  /** A linha do tempo da BANCADA — é ela que está sendo reescrita em parte. */
  target: readonly AnimationKeyframe[]
  sceneFigures: readonly Figure[]
  /** Id do boneco da cena que faz cada papel. Papel em branco não é substituído. */
  assignment: readonly string[]
  /** Índice, na bancada, do primeiro keyframe a receber o arquivo. */
  startIndex: number
  /** Se a câmera gravada também entra, ou se as da bancada ficam como estão. */
  replaceCamera: boolean
  /** Id dos keyframes que sobrarem para o fim: `k<baseSeq + n>`. */
  baseSeq: number
}

export interface SubstituteResult {
  /** A linha do tempo INTEIRA da bancada, já com a substituição feita. */
  keyframes: AnimationKeyframe[]
  /** Quantos keyframes entraram DEPOIS do antigo fim — os que não couberam. */
  appended: number
}

/**
 * Enxerta a animação do arquivo na linha do tempo da bancada a partir de
 * `startIndex`, trocando só o que foi escolhido (decisão do usuário,
 * 2026-07-31): as poses dos bonecos de destino e, opcionalmente, a câmera.
 *
 * **Por que é enxerto e não importação.** Substituir e anexar escrevem uma
 * linha do tempo; isto reescreve PARTE de uma que já existe. Tudo o que não foi
 * escolhido continua exatamente como estava — os keyframes anteriores a
 * `startIndex`, os bonecos sem papel em cada keyframe atingido, as durações de
 * cada trecho e (se a caixa da câmera estiver desmarcada) o enquadramento
 * montado. É o que permite trocar a coreografia de um boneco no meio de uma
 * cena montada sem remontar o resto.
 *
 * **A colocação é a ABSOLUTA do arquivo** (decisão do usuário): o boneco de
 * destino assume a posição e o giro gravados, como no modo "Substituir". A
 * alternativa — transportar para onde ele está no keyframe inicial — foi
 * descartada por ser o contrato do "Anexar", que existe para emendar, não para
 * enxertar.
 *
 * **O que sobra vai para o fim** (decisão do usuário): arquivo mais comprido do
 * que o que resta da bancada estende a linha do tempo, com as durações e os
 * rótulos gravados. Os bonecos sem papel congelam no estado do último keyframe
 * da bancada — é onde eles pararam.
 *
 * Devolve `null` quando não há o que enxertar: arquivo vazio, bancada vazia ou
 * nenhum papel com boneco de destino.
 */
export function substituteImportedKeyframes(options: SubstituteOptions): SubstituteResult | null {
  const { keyframes, target, sceneFigures, assignment, startIndex, replaceCamera, baseSeq } = options
  if (keyframes.length === 0 || target.length === 0) return null

  const remapped = remapPosedKeyframes({
    keyframes,
    sceneFigures,
    assignment,
    // Ver o cabeçalho: enxertar leva a colocação gravada, como "Substituir".
    anchoring: 'absolute',
  })
  if (!remapped) return null

  const start = Math.min(Math.max(0, Math.round(startIndex) || 0), target.length - 1)

  /**
   * O retrato do keyframe com os bonecos de destino trocados. Quem tem papel
   * mas ainda NÃO aparecia naquele retrato entra na lista: o keyframe pode ser
   * anterior à entrada do boneco na cena, e sem isto a substituição não teria
   * efeito nenhum ali — justamente no boneco que se pediu para trocar.
   */
  const merge = (base: AnimationKeyframe, posed: Map<string, Figure>): Figure[] => {
    const known = new Set(base.figures.map((figure) => figure.id))
    return [
      ...base.figures.map((figure) => posed.get(figure.id) ?? figure),
      ...[...posed.values()].filter((figure) => !known.has(figure.id)),
    ]
  }

  const last = target[target.length - 1]
  const body: AnimationKeyframe[] = []
  let appended = 0

  remapped.forEach((frame, index) => {
    const at = start + index
    const existing = target[at]
    if (existing) {
      // Id, duração e rótulo são do keyframe da bancada: o trecho que chega até
      // ele e o grupo a que ele pertence não são assunto do arquivo.
      body.push({
        ...existing,
        figures: merge(existing, frame.posed),
        camera: replaceCamera ? frame.camera : existing.camera,
      })
      return
    }

    appended += 1
    body.push({
      id: `k${baseSeq + appended}`,
      durationMs: frame.durationMs,
      figures: merge(last, frame.posed),
      camera: replaceCamera ? frame.camera : last.camera,
      ...(frame.label ? { label: frame.label } : {}),
    })
  })

  return {
    keyframes: [...target.slice(0, start), ...body, ...target.slice(start + remapped.length)],
    appended,
  }
}
