/**
 * Conversão pura entre o estado de uma cena (bonecos, objetos, ambiente,
 * bookmarks de câmera etc.) e o schema serializável dela — ver PLANO.md >
 * "Persistência (formato da cena)". Não depende de `three` nenhum: só mapeia
 * objetos JS simples, então é 100% testável sem navegador/WebGL.
 *
 * **Este módulo é o formato**, e os dois destinos o consomem: `sceneFile.ts`
 * grava/lê o `.json` em disco e `autosave.ts` grava/lê o `localStorage`. Um
 * schema, duas saídas — é o que fez a troca do `.glb` por JSON (DECISOES.md
 * #85) não custar uma linha daqui.
 *
 * O nome `extras` nas funções é herança do `.glb`, onde este bloco vivia em
 * `extras["virtual-mockup"]` (o nome de batismo do app, hoje WebPoser); hoje
 * ele é o nível de cima do arquivo.
 *
 * A leitura do BONECO não mora aqui desde o #86: é `figure/figureFormat.ts`,
 * compartilhada com a animação, os trechos e a pose avulsa. O que sobra neste
 * arquivo é o que é da CENA — ambiente, câmera, bookmarks, objetos e contadores.
 */
import type { JointRotation } from '../figure/skeleton'
import { readRotation, sanitizeFigure, toVec3 } from '../figure/figureFormat'
import { DEFAULT_SCENE_CAMERA, type CameraViewState } from '../scene/cameraMove'
import { clampFocalLength } from '../scene/lens'
import { DEFAULT_LIGHT, lightFromUnknown, type LightSettings } from '../scene/sceneLight'
import type { BackgroundTone, CameraBookmark, CameraProjection, EnvironmentSettings, Figure } from '../store/figuresStore'
import { controlPointCount } from '../props/propGeometry'
import {
  DEFAULT_PROP_COLOR,
  DEFAULT_PROP_SIZE,
  clampPropSize,
  isPropShape,
  normalizePropColor,
  propShapeHasFreeVertex,
  sanitizePropAttachment,
  sanitizeVertexOffsets,
  type PropShape,
  type SceneProp,
  type VertexOffsets,
} from '../props/sceneProp'

export const SCENE_EXTRAS_VERSION = 1

export type Vec3Tuple = [number, number, number]

/**
 * O boneco da cena é o **`Figure` do store, verbatim** — o mesmo objeto que
 * vive dentro de `keyframes[].figures[]` de uma animação e dentro do arquivo de
 * pose avulsa (DECISOES.md #86).
 *
 * Até o #86 existia aqui um `FigureExtras` próprio, com `joints:[x,y,z]` e
 * `rotation:[x,y,z]` — uma segunda codificação do mesmo boneco, com uma segunda
 * rotina de leitura para manter em dia. A leitura aceita as duas para sempre
 * (`figureFormat.sanitizeFigure` lê `joints` como sinônimo de `pose`), então
 * cena e autosave gravados antes continuam abrindo.
 */
export type FigureExtras = Figure

export interface CameraBookmarkExtras {
  id: string
  name: string
  position: Vec3Tuple
  target: Vec3Tuple
  projection: CameraProjection
  fov: number
  zoom: number
  /** Topo da tela — ausente nos arquivos gravados antes do ângulo holandês (#46). */
  up?: Vec3Tuple
}

/**
 * Objeto de cena serializado (item 42). Guarda **forma + tamanho + desvios**,
 * e não uma malha: o arquivo continua pequeno, o objeto continua editável como
 * primitiva depois de reabrir, e a malha de verdade é reconstruída por
 * `propGeometry.buildPropGeometry`.
 */
export interface PropExtras {
  id: string
  name: string
  shape: PropShape
  color: string
  visible: boolean
  hiddenInEditor: boolean
  locked: boolean
  position: Vec3Tuple
  rotation: Vec3Tuple
  /** Medida real por eixo, em metros. */
  size: Vec3Tuple
  /** Vértices arrastados à mão, por índice de ponto de controle. Ausente quando o objeto está intacto. */
  vertices?: Record<string, Vec3Tuple>
  /**
   * Amarração a uma junta de boneco (PLANO.md > amarração). Campo ADITIVO,
   * sem subir `SCENE_EXTRAS_VERSION` — mesmo precedente do próprio `props`.
   * Ausente quando o objeto é cenário solto, que é o caso comum.
   */
  attachment?: {
    figureId: string
    jointName: string
    position: Vec3Tuple
    rotation: Vec3Tuple
  }
}

/** A câmera de cena serializada (fase 11). Mesmo formato do `CameraViewState`. */
export interface SceneCameraExtras {
  position: Vec3Tuple
  target: Vec3Tuple
  up: Vec3Tuple
  focalMm: number
}

export interface SceneExtras {
  version: number
  name: string
  environment: EnvironmentSettings
  /**
   * A câmera de cena (fase 11). Adição de campo, sem subir
   * `SCENE_EXTRAS_VERSION`: arquivo antigo sem ela recebe a câmera padrão.
   */
  sceneCamera: SceneCameraExtras
  /**
   * Próximo número da sequência de instantâneos. Era `keyframeCounter` até a
   * fase 10 (DECISOES.md #52); grava-se o nome novo e lê-se os dois, para que
   * cenas antigas continuem a contagem em vez de reiniciar do 1. Adição de
   * campo não sobe `SCENE_EXTRAS_VERSION`.
   */
  snapshotCounter: number
  nextFigureSeq: number
  nextCameraBookmarkSeq: number
  cameraBookmarks: CameraBookmarkExtras[]
  figures: FigureExtras[]
  /**
   * Objetos de cena (item 42). Campo ADITIVO, sem subir
   * `SCENE_EXTRAS_VERSION` — mesmo precedente do `sceneCamera` e do
   * `snapshotCounter`: um arquivo gravado antes disto abre com cena sem
   * objetos, que é exatamente o que ele tinha.
   */
  props: PropExtras[]
  nextPropSeq: number
}

/** Estado de uma cena de trabalho, no formato usado pelo `figuresStore`. */
export interface SceneWorkingState {
  name: string
  figures: Figure[]
  nextFigureSeq: number
  props: SceneProp[]
  nextPropSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  nextSnapshotNumber: number
  sceneCamera: CameraViewState
}

const DEFAULT_BACKGROUND: BackgroundTone = 'medium'
const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  background: DEFAULT_BACKGROUND,
  grid: true,
  ...DEFAULT_LIGHT,
}
const VALID_BACKGROUNDS: readonly BackgroundTone[] = ['light', 'medium', 'dark']
const VALID_PROJECTIONS: readonly CameraProjection[] = ['perspective', 'orthographic']

function rotationToTuple(rotation: JointRotation): Vec3Tuple {
  return [rotation.x, rotation.y, rotation.z]
}

/**
 * Cópia funda do boneco para gravar. Não converte nada desde o #86 — o formato
 * de arquivo É o `Figure`. Copiar, e não devolver a referência do store, é o que
 * impede uma edição posterior de vazar para um snapshot já tirado.
 */
export function figureToExtras(figure: Figure): FigureExtras {
  const pose: Record<string, JointRotation> = {}
  for (const [jointName, rotation] of Object.entries(figure.pose)) {
    pose[jointName] = { ...rotation }
  }
  return {
    ...figure,
    position: [...figure.position],
    rotation: { ...figure.rotation },
    pose,
  }
}

/**
 * Lê um boneco da cena. Delega ao leitor único (`figureFormat.ts`), que aceita
 * as duas codificações — `pose:{x,y,z}` do que se grava hoje e `joints:[x,y,z]`
 * das cenas e autosaves anteriores ao #86.
 */
export function figureFromExtras(extras: unknown, fallbackIndex: number): Figure {
  return sanitizeFigure(extras, fallbackIndex)
}

export function propToExtras(prop: SceneProp): PropExtras {
  const vertices: Record<string, Vec3Tuple> = {}
  for (const [index, offset] of Object.entries(prop.vertexOffsets)) {
    vertices[index] = [...offset]
  }

  return {
    id: prop.id,
    name: prop.name,
    shape: prop.shape,
    color: prop.color,
    visible: prop.visible,
    hiddenInEditor: prop.hiddenInEditor,
    locked: prop.locked,
    position: [...prop.position],
    rotation: rotationToTuple(prop.rotation),
    size: [...prop.size],
    // Objeto intacto não grava a chave: é o caso comum, e um `{}` por objeto
    // em cada cena do catálogo pesaria no `localStorage` à toa.
    ...(Object.keys(vertices).length > 0 ? { vertices } : {}),
    // Mesma regra para a amarração: objeto solto não ocupa nada.
    ...(prop.attachment
      ? {
          attachment: {
            figureId: prop.attachment.figureId,
            jointName: prop.attachment.jointName,
            position: [...prop.attachment.position] as Vec3Tuple,
            rotation: rotationToTuple(prop.attachment.rotation),
          },
        }
      : {}),
  }
}

/**
 * Reconstrói um objeto de um bloco não confiável. A FORMA é o campo que manda:
 * ela decide o tamanho padrão e quantos pontos de controle existem, e por isso
 * é resolvida antes de tamanho e vértices. Uma forma desconhecida (arquivo de
 * uma versão futura, ou editado à mão) vira caixa — o objeto continua na cena,
 * no lugar certo, em vez de desaparecer sem aviso.
 *
 * `figureIds` são os bonecos da MESMA cena: uma amarração para boneco fora da
 * lista (ou junta desconhecida) é podada, e o objeto volta à própria
 * colocação — o mesmo comportamento de remover o boneco com objeto amarrado.
 */
export function propFromExtras(
  extras: unknown,
  fallbackIndex: number,
  figureIds: ReadonlySet<string> = new Set(),
): SceneProp {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>
  const shape: PropShape = isPropShape(source.shape) ? source.shape : 'box'

  // Forma composta não tem vértice livre (kit de armas): desvio gravado para
  // ela — arquivo editado à mão, ou de uma versão que venha a permitir — é
  // descartado, e o modelo abre íntegro.
  const offsets: VertexOffsets = sanitizeVertexOffsets(
    source.vertices,
    propShapeHasFreeVertex(shape) ? controlPointCount(shape) : 0,
  )

  return {
    id: typeof source.id === 'string' ? source.id : `prop-${fallbackIndex + 1}`,
    name: typeof source.name === 'string' ? source.name : `Object ${fallbackIndex + 1}`,
    shape,
    color: normalizePropColor(source.color) ?? DEFAULT_PROP_COLOR,
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    // Os dois padrões são o estado "sem nada de especial": um objeto lido de um
    // arquivo antigo (ou de fora) aparece na bancada e aceita clique.
    hiddenInEditor: typeof source.hiddenInEditor === 'boolean' ? source.hiddenInEditor : false,
    locked: typeof source.locked === 'boolean' ? source.locked : false,
    position: toVec3(source.position, [0, 0, 0]),
    rotation: readRotation(source.rotation),
    size: clampPropSize(source.size ?? DEFAULT_PROP_SIZE[shape], shape),
    vertexOffsets: offsets,
    attachment: sanitizePropAttachment(source.attachment, figureIds),
  }
}

export function cameraBookmarkToExtras(bookmark: CameraBookmark): CameraBookmarkExtras {
  return {
    id: bookmark.id,
    name: bookmark.name,
    position: [...bookmark.position],
    target: [...bookmark.target],
    projection: bookmark.projection,
    fov: bookmark.fov,
    zoom: bookmark.zoom,
    ...(bookmark.up ? { up: [...bookmark.up] as Vec3Tuple } : {}),
  }
}

export function cameraBookmarkFromExtras(extras: unknown, fallbackIndex: number): CameraBookmark {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>
  const projection = source.projection
  return {
    id: typeof source.id === 'string' ? source.id : `camera-bookmark-${fallbackIndex + 1}`,
    name: typeof source.name === 'string' ? source.name : `Bookmark ${fallbackIndex + 1}`,
    position: toVec3(source.position, [0, 0, 0]),
    target: toVec3(source.target, [0, 0, 0]),
    projection: VALID_PROJECTIONS.includes(projection as CameraProjection)
      ? (projection as CameraProjection)
      : 'perspective',
    fov: typeof source.fov === 'number' ? source.fov : 50,
    zoom: typeof source.zoom === 'number' ? source.zoom : 1,
    // Sem `up` no arquivo, a câmera volta em pé — foi assim que ela foi salva.
    ...(Array.isArray(source.up) ? { up: toVec3(source.up, [0, 1, 0]) } : {}),
  }
}

export function sceneCameraToExtras(camera: CameraViewState): SceneCameraExtras {
  return {
    position: [...camera.position],
    target: [...camera.target],
    up: [...camera.up],
    focalMm: camera.focalMm,
  }
}

/**
 * Reconstrói a câmera de cena de um bloco não confiável. Além dos defaults de
 * praxe, recusa uma câmera DEGENERADA (posição em cima do alvo, que não define
 * direção de visão) devolvendo a padrão — um arquivo editado à mão não pode
 * deixar a cena sem enquadramento válido.
 */
export function sceneCameraFromExtras(extras: unknown): CameraViewState {
  if (typeof extras !== 'object' || extras === null) return DEFAULT_SCENE_CAMERA
  const source = extras as Record<string, unknown>

  const position = toVec3(source.position, [...DEFAULT_SCENE_CAMERA.position])
  const target = toVec3(source.target, [...DEFAULT_SCENE_CAMERA.target])
  const up = toVec3(source.up, [...DEFAULT_SCENE_CAMERA.up])

  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  if (dx * dx + dy * dy + dz * dz < 1e-8) return DEFAULT_SCENE_CAMERA
  if (up[0] * up[0] + up[1] * up[1] + up[2] * up[2] < 1e-8) return DEFAULT_SCENE_CAMERA

  return {
    position,
    target,
    up,
    focalMm:
      typeof source.focalMm === 'number' && Number.isFinite(source.focalMm)
        ? clampFocalLength(source.focalMm)
        : DEFAULT_SCENE_CAMERA.focalMm,
  }
}

function environmentFromExtras(extras: unknown): EnvironmentSettings {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>
  const background = VALID_BACKGROUNDS.includes(source.background as BackgroundTone)
    ? (source.background as BackgroundTone)
    : DEFAULT_ENVIRONMENT.background
  const grid = typeof source.grid === 'boolean' ? source.grid : DEFAULT_ENVIRONMENT.grid
  // A luz (item 16) entrou SEM subir `SCENE_EXTRAS_VERSION`, pelo precedente da
  // persistência aditiva: arquivo antigo não tem os três campos e cai no padrão,
  // que por construção é a luz fixa de antes — abre com a mesma sombra.
  return { background, grid, ...lightFromUnknown(source as Partial<LightSettings>) }
}

/** Monta o bloco serializável da cena (o antigo `extras` do tempo do glTF) a partir do estado de uma cena de trabalho. */
export function sceneToExtras(scene: SceneWorkingState): SceneExtras {
  return {
    version: SCENE_EXTRAS_VERSION,
    name: scene.name,
    environment: { ...scene.environment },
    sceneCamera: sceneCameraToExtras(scene.sceneCamera),
    snapshotCounter: scene.nextSnapshotNumber,
    nextFigureSeq: scene.nextFigureSeq,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    cameraBookmarks: scene.cameraBookmarks.map(cameraBookmarkToExtras),
    figures: scene.figures.map(figureToExtras),
    props: scene.props.map(propToExtras),
    nextPropSeq: scene.nextPropSeq,
  }
}

/**
 * Reconstrói o estado de uma cena de trabalho a partir de um bloco de
 * cena lido de um arquivo (ou de qualquer JSON não confiável — nunca
 * assume que os campos existem/têm o tipo certo, ver PLANO.md > "Regras de
 * leitura/gravação" > "Campo version + validação com defaults ao carregar").
 */
export function sceneFromExtras(extras: unknown): SceneWorkingState {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>

  const figuresSource = Array.isArray(source.figures) ? source.figures : []
  const figures = figuresSource.map((figureExtras, index) => figureFromExtras(figureExtras, index))

  // Arquivo gravado antes do item 42 simplesmente não tem o campo: a cena abre
  // sem objetos, que é o conteúdo que ela sempre teve. As amarrações são
  // validadas contra os bonecos DESTA cena — por isso os bonecos são lidos antes.
  const figureIds = new Set(figures.map((figure) => figure.id))
  const propsSource = Array.isArray(source.props) ? source.props : []
  const props = propsSource.map((propExtras, index) => propFromExtras(propExtras, index, figureIds))

  const bookmarksSource = Array.isArray(source.cameraBookmarks) ? source.cameraBookmarks : []
  const cameraBookmarks = bookmarksSource.map((bookmarkExtras, index) =>
    cameraBookmarkFromExtras(bookmarkExtras, index),
  )

  return {
    name: typeof source.name === 'string' && source.name.trim() !== '' ? source.name : 'Cena 1',
    figures,
    nextFigureSeq: typeof source.nextFigureSeq === 'number' ? source.nextFigureSeq : figures.length + 1,
    props,
    nextPropSeq: typeof source.nextPropSeq === 'number' ? source.nextPropSeq : props.length + 1,
    environment: environmentFromExtras(source.environment),
    sceneCamera: sceneCameraFromExtras(source.sceneCamera),
    cameraBookmarks,
    nextCameraBookmarkSeq:
      typeof source.nextCameraBookmarkSeq === 'number'
        ? source.nextCameraBookmarkSeq
        : cameraBookmarks.length + 1,
    nextSnapshotNumber:
      typeof source.snapshotCounter === 'number'
        ? source.snapshotCounter
        : typeof source.keyframeCounter === 'number'
          ? source.keyframeCounter
          : 1,
  }
}
