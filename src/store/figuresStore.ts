import { create } from 'zustand'
import { temporal } from 'zundo'
import {
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getHeightScale,
  getJointAxes,
  getJointLimitOverrides,
  setJointLimitOverrides,
  type Axis,
  type JointLimitOverrides,
  type JointRotation,
} from '../figure/skeleton'
import { resolveHandPreset, type HandPresetKey } from '../figure/handPresets'
import { mirrorPoseSide, swapPoseSides, type Side } from '../figure/poseMirror'
import { resolvePosePreset, resolvePosePresetPlacement, type PosePresetKey } from '../figure/posePresets'
import { loadWorkspaceFromLocalStorage } from '../persistence/autosave'

export const MAX_FIGURES = 5

export type BackgroundTone = 'light' | 'medium' | 'dark'

export interface EnvironmentSettings {
  background: BackgroundTone
  grid: boolean
}

export type CameraProjection = 'perspective' | 'orthographic'

/**
 * Posição nomeada de câmera salva pelo usuário (ver PLANO.md > "Ambiente e
 * câmera" > "Bookmarks de câmera"). Vive no mesmo store (e histórico de undo)
 * dos bonecos porque o plano trata "criar/remover bookmark" como uma edição
 * de conteúdo normal — diferente da navegação livre (órbita/pan/zoom), que
 * fica fora do histórico e não é rastreada aqui (ver `cameraStore.ts`).
 */
export interface CameraBookmark {
  id: string
  name: string
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  projection: CameraProjection
  fov: number
  zoom: number
}

/** Paleta fixa de 5 cores de alto contraste: vermelho, azul, verde, laranja, roxo. */
export const COLOR_PALETTE: readonly string[] = [
  '#e04040',
  '#4060e0',
  '#40a840',
  '#e08020',
  '#8040c0',
]

export interface Figure {
  id: string
  name: string
  color: string
  visible: boolean
  height: number
  /** Posição do root na cena (colocação no chão), em metros. */
  position: readonly [number, number, number]
  /** Rotação livre do root (colocação), em graus — não passa por limites articulares. */
  rotation: JointRotation
  /** Rotação de cada junta não-root, em graus, já dentro dos limites do skeleton.ts. */
  pose: Record<string, JointRotation>
}

/**
 * Snapshot nomeado do estado de trabalho (bonecos/poses/ambiente/bookmarks de
 * câmera/contador de keyframe) — o "catálogo de cenas" do workspace (ver
 * PLANO.md > "Workspace: catálogo de cenas" e DECISOES.md #11). Cada
 * snapshot é exatamente o que vira um `.glb` ao exportar aquela cena.
 */
export interface SceneSnapshotData {
  figures: Figure[]
  nextFigureSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  nextKeyframeNumber: number
}

export interface SceneSnapshot {
  id: string
  name: string
  data: SceneSnapshotData
}

export interface FiguresState {
  figures: Figure[]
  selectedFigureId: string | null
  selectedJointName: string | null
  /** Eixo com foco para os atalhos de teclado (setas) quando uma junta com mais de um DOF está selecionada. */
  activeAxis: Axis | null
  nextFigureSeq: number
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  environment: EnvironmentSettings
  sceneName: string
  /** Próximo número de sequência de keyframe (`kf001`, `kf002`…). Não entra no histórico de undo — ver `consumeKeyframeNumber`. */
  nextKeyframeNumber: number
  /** Catálogo de snapshots de cena salvos (workspace) — ver `SceneSnapshot`. */
  scenes: SceneSnapshot[]
  nextSceneSnapshotSeq: number
  /** Id do snapshot mais recentemente salvo/carregado — navegação, fora do histórico de undo (ver `partialize`). */
  activeSceneId: string | null
  /**
   * Limites articulares customizados pelo workspace (ver DECISOES.md #29) —
   * vazio quando valem os padrões de `skeleton.ts`. É um espelho do estado
   * global do `skeleton.ts` mantido aqui só para (a) entrar no autosave junto
   * com o resto do workspace e (b) re-renderizar os sliders quando muda.
   */
  jointLimits: JointLimitOverrides
  addFigure: (name?: string) => string | null
  removeFigure: (id: string) => void
  duplicateFigure: (id: string) => string | null
  renameFigure: (id: string, name: string) => void
  toggleVisibility: (id: string) => void
  selectFigure: (id: string | null) => void
  selectJoint: (jointName: string | null) => void
  setActiveAxis: (axis: Axis) => void
  setHeight: (id: string, heightM: number) => void
  setColor: (id: string, color: string) => void
  setPosition: (id: string, position: readonly [number, number, number]) => void
  setRootRotation: (id: string, rotation: Partial<JointRotation>) => void
  setJointRotation: (id: string, jointName: string, rotation: Partial<JointRotation>) => void
  /**
   * Devolve UMA junta à pose de referência (fase 9, item 6). A referência é a
   * pose "Em pé" (`posePresets.ts`), não zero cru — há eixos cujo neutro do
   * modelo não é zero, como a torção do antebraço `elbow.*.y` (DECISOES.md
   * #25). Para o `root`, zera só a rotação de colocação (a posição fica).
   */
  resetJointRotation: (id: string, jointName: string) => void
  addCameraBookmark: (bookmark: Omit<CameraBookmark, 'id'>) => string
  removeCameraBookmark: (id: string) => void
  setBackground: (background: BackgroundTone) => void
  toggleGrid: () => void
  renameScene: (name: string) => void
  /** Consome (lê e avança) o próximo número de keyframe — ver PLANO.md > "Exportação de imagem". */
  consumeKeyframeNumber: () => number
  /** Salva um novo snapshot a partir do estado de trabalho atual; retorna o id gerado. */
  saveSceneSnapshot: (name?: string) => string
  /**
   * "Salvar" no sentido de um editor (atalho `Ctrl+S`): regrava a cena ativa
   * do catálogo com o estado de trabalho e o nome atuais, ou cria a primeira
   * se ainda não houver — sem diálogo. Diferente de `saveSceneSnapshot`, que
   * sempre acrescenta um snapshot novo (é o botão "salvar como" do painel);
   * tocar `Ctrl+S` várias vezes não pode encher o catálogo de duplicatas.
   * Retorna o id da cena gravada.
   */
  saveOrUpdateActiveScene: () => string
  /** Substitui o estado de trabalho pelo snapshot indicado; retorna `false` se o id não existir. */
  loadSceneSnapshot: (id: string) => boolean
  renameSceneSnapshot: (id: string, name: string) => void
  removeSceneSnapshot: (id: string) => void
  /** Substitui a cena de trabalho por dados lidos de um `.glb` importado — não é um snapshot salvo do catálogo. */
  loadSceneWorkingState: (data: SceneSnapshotData & { name: string }) => void
  /** Aplica altura/pose importadas a um boneco existente, mantendo identidade/cor/posição — ver PLANO.md > "Exportação/importação de um boneco individual". */
  applyImportedPose: (id: string, imported: { height: number; pose: Record<string, JointRotation> }) => void
  /** Cria um boneco novo a partir de um boneco importado — sujeito ao limite de 5 bonecos e a uma cor livre da paleta. */
  importFigureAsNew: (imported: Omit<Figure, 'id'>) => string | null
  /** Adiciona bookmarks importados aos já existentes (nunca substitui); nomes duplicados recebem um sufixo automático. */
  importCameraBookmarks: (bookmarks: readonly Omit<CameraBookmark, 'id'>[]) => void
  /** Substitui o catálogo de cenas por um workspace lido de uma pasta; carrega a cena ativa na cena de trabalho, se houver. */
  loadWorkspaceCatalog: (
    scenes: SceneSnapshot[],
    activeSceneId: string | null,
    jointLimits?: JointLimitOverrides,
  ) => void
  /** Instala limites articulares customizados (JSON do workspace) e ajusta as poses já carregadas para dentro deles. */
  applyJointLimits: (raw: unknown) => void
  /** Volta aos limites do código, reajustando poses que tenham ficado fora da faixa padrão. */
  resetJointLimits: () => void
  /**
   * Limpa e reseta todo o ambiente (fase 9, item 7): bonecos, catálogo de
   * cenas, bookmarks de câmera, nome/contadores da cena, configuração de
   * ambiente e limites articulares customizados voltam ao estado inicial —
   * equivalente a começar do zero, sem recarregar a página. Ação destrutiva e
   * **irreversível**: também zera o próprio histórico de undo (a UI pede
   * confirmação antes de chamar).
   */
  resetWorkspace: () => void
  /**
   * Substitui a pose interna do boneco por um preset e o assenta no chão
   * conforme o preset pedir (rotação do boneco e altura do quadril — ver
   * `resolvePosePresetPlacement` e DECISOES.md #30). X/Z, ou seja, ONDE o
   * boneco está no chão, nunca mudam.
   */
  applyPosePreset: (id: string, key: PosePresetKey) => void
  /** Aplica uma pose de mão a UM lado, preservando punho, braço e a outra mão. */
  applyHandPreset: (id: string, side: Side, key: HandPresetKey) => void
  /** Copia o lado indicado, espelhado, para o outro — só juntas `.L`/`.R`. */
  mirrorSide: (id: string, from: Side) => void
  /** Troca as poses dos dois lados, cada uma espelhada — só juntas `.L`/`.R`. */
  swapSides: (id: string) => void
}

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

const INITIAL_ENVIRONMENT: EnvironmentSettings = {
  background: 'medium',
  grid: true,
}

/** Espaçamento padrão em X entre bonecos recém-criados, para que não fiquem sobrepostos. */
const DEFAULT_SPACING_M = 0.9

/**
 * Restaura o workspace salvo em `localStorage` (autosave), se houver, uma
 * única vez na criação do store — sem diálogo de confirmação (decisão
 * confirmada com o usuário, ver DECISOES.md #11). Avaliado no carregamento
 * do módulo, então cada teste que chama `useFiguresStore.getInitialState()`
 * volta a este mesmo snapshot (tipicamente vazio, já que os testes rodam num
 * `localStorage` de `jsdom` limpo).
 */
const restoredWorkspace = loadWorkspaceFromLocalStorage()

function clampHeight(heightM: number): number {
  return Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, heightM))
}

function nextAvailableColor(figures: readonly Figure[]): string | null {
  const used = new Set(figures.map((figure) => figure.color))
  return COLOR_PALETTE.find((color) => !used.has(color)) ?? null
}

function updateFigure(
  figures: Figure[],
  id: string,
  update: (figure: Figure) => Figure,
): Figure[] {
  return figures.map((figure) => (figure.id === id ? update(figure) : figure))
}

function clampFigurePose(figure: Figure): Figure {
  let changed = false
  const pose: Record<string, JointRotation> = {}

  for (const [jointName, rotation] of Object.entries(figure.pose)) {
    const clamped = clampJointRotation(jointName, rotation)
    pose[jointName] = clamped
    if (clamped.x !== rotation.x || clamped.y !== rotation.y || clamped.z !== rotation.z) {
      changed = true
    }
  }

  return changed ? { ...figure, pose } : figure
}

/**
 * Reajusta poses para dentro dos limites em vigor, preservando a identidade
 * dos arrays/objetos quando nada muda — assim trocar de limites sem nenhuma
 * pose fora da faixa não empilha histórico de undo (a `equality` do `zundo`
 * compara por referência).
 */
function clampFigures(figures: Figure[]): Figure[] {
  const next = figures.map(clampFigurePose)
  return next.some((figure, index) => figure !== figures[index]) ? next : figures
}

function clampScenes(scenes: SceneSnapshot[]): SceneSnapshot[] {
  const next = scenes.map((scene) => {
    const figures = clampFigures(scene.data.figures)
    return figures === scene.data.figures ? scene : { ...scene, data: { ...scene.data, figures } }
  })
  return next.some((scene, index) => scene !== scenes[index]) ? next : scenes
}

export const useFiguresStore = create<FiguresState>()(
  temporal(
    (set, get) => ({
      figures: restoredWorkspace?.workingScene.figures ?? [],
      selectedFigureId: null,
      selectedJointName: null,
      activeAxis: null,
      nextFigureSeq: restoredWorkspace?.workingScene.nextFigureSeq ?? 1,
      cameraBookmarks: restoredWorkspace?.workingScene.cameraBookmarks ?? [],
      nextCameraBookmarkSeq: restoredWorkspace?.workingScene.nextCameraBookmarkSeq ?? 1,
      environment: restoredWorkspace?.workingScene.environment ?? INITIAL_ENVIRONMENT,
      sceneName: restoredWorkspace?.workingScene.name ?? 'Cena 1',
      nextKeyframeNumber: restoredWorkspace?.workingScene.nextKeyframeNumber ?? 1,
      scenes: restoredWorkspace?.scenes ?? [],
      nextSceneSnapshotSeq: restoredWorkspace?.nextSceneSnapshotSeq ?? 1,
      activeSceneId: restoredWorkspace?.activeSceneId ?? null,
      // O autosave já aplicou esses limites ao `skeleton.ts` ao restaurar (as
      // poses acima foram lidas com eles valendo); aqui é só o espelho.
      jointLimits: restoredWorkspace?.jointLimits ?? {},

      addFigure: (name) => {
        const { figures, nextFigureSeq } = get()
        if (figures.length >= MAX_FIGURES) return null

        const color = nextAvailableColor(figures)
        if (!color) return null

        const id = `figure-${nextFigureSeq}`
        const figure: Figure = {
          id,
          name: name ?? `Figure ${nextFigureSeq}`,
          color,
          visible: true,
          height: REFERENCE_HEIGHT_M,
          position: [figures.length * DEFAULT_SPACING_M, 0, 0],
          rotation: { ...ZERO_ROTATION },
          // T-pose por padrão (pedido do usuário, ver DECISOES.md #19) —
          // separa os membros do corpo e facilita posar/testar, em vez da
          // pose "em pé" relaxada (braços colados ao corpo).
          pose: resolvePosePreset('tpose'),
        }

        set({ figures: [...figures, figure], nextFigureSeq: nextFigureSeq + 1 })
        return id
      },

      removeFigure: (id) => {
        set((state) => ({
          figures: state.figures.filter((figure) => figure.id !== id),
          selectedFigureId: state.selectedFigureId === id ? null : state.selectedFigureId,
          selectedJointName: state.selectedFigureId === id ? null : state.selectedJointName,
          activeAxis: state.selectedFigureId === id ? null : state.activeAxis,
        }))
      },

      duplicateFigure: (id) => {
        const { figures, nextFigureSeq } = get()
        if (figures.length >= MAX_FIGURES) return null

        const original = figures.find((figure) => figure.id === id)
        if (!original) return null

        const color = nextAvailableColor(figures)
        if (!color) return null

        const newId = `figure-${nextFigureSeq}`
        const duplicate: Figure = {
          ...original,
          id: newId,
          name: `${original.name} (2)`,
          color,
          pose: { ...original.pose },
          rotation: { ...original.rotation },
          position: [
            original.position[0] + DEFAULT_SPACING_M,
            original.position[1],
            original.position[2],
          ],
        }

        set({ figures: [...figures, duplicate], nextFigureSeq: nextFigureSeq + 1 })
        return newId
      },

      renameFigure: (id, name) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({ ...figure, name })),
        }))
      },

      toggleVisibility: (id) => {
        set((state) => {
          const figures = updateFigure(state.figures, id, (figure) => ({
            ...figure,
            visible: !figure.visible,
          }))
          // Ocultar o boneco selecionado limpa a seleção: ele fica inerte ao
          // mouse (ver `Figure.tsx`), então deixá-lo selecionado manteria um
          // gizmo no viewport sobre um corpo invisível (fase 9, item 14).
          const hidden = figures.find((figure) => figure.id === id)?.visible === false
          if (!hidden || state.selectedFigureId !== id) return { figures }
          return { figures, selectedFigureId: null, selectedJointName: null, activeAxis: null }
        })
      },

      selectFigure: (id) => {
        // Selecionar o boneco equivale a selecionar seu root — pronto para
        // mover/girar (ver PLANO.md > "Interação de pose", passo 1).
        set({ selectedFigureId: id, selectedJointName: id ? ROOT_JOINT_NAME : null, activeAxis: null })
      },

      selectJoint: (jointName) => {
        const axes = jointName ? getJointAxes(jointName) : []
        set({ selectedJointName: jointName, activeAxis: axes[0] ?? null })
      },

      setActiveAxis: (axis) => {
        const { selectedJointName } = get()
        if (!selectedJointName || !getJointAxes(selectedJointName).includes(axis)) return
        set({ activeAxis: axis })
      },

      setHeight: (id, heightM) => {
        const height = clampHeight(heightM)
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({ ...figure, height })),
        }))
      },

      setColor: (id, color) => {
        if (!COLOR_PALETTE.includes(color)) return

        const { figures } = get()
        const takenByAnother = figures.some((figure) => figure.id !== id && figure.color === color)
        if (takenByAnother) return

        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({ ...figure, color })),
        }))
      },

      setPosition: (id, position) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({ ...figure, position })),
        }))
      },

      setRootRotation: (id, rotation) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            rotation: { ...figure.rotation, ...rotation },
          })),
        }))
      },

      setJointRotation: (id, jointName, rotation) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose: {
              ...figure.pose,
              [jointName]: clampJointRotation(jointName, {
                ...figure.pose[jointName],
                ...rotation,
              }),
            },
          })),
        }))
      },

      resetJointRotation: (id, jointName) => {
        if (jointName === ROOT_JOINT_NAME) {
          set((state) => ({
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              rotation: { ...ZERO_ROTATION },
            })),
          }))
          return
        }

        const neutral = resolvePosePreset('standing')[jointName] ?? ZERO_ROTATION
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose: { ...figure.pose, [jointName]: clampJointRotation(jointName, neutral) },
          })),
        }))
      },

      addCameraBookmark: (bookmark) => {
        const { cameraBookmarks, nextCameraBookmarkSeq } = get()
        const id = `camera-bookmark-${nextCameraBookmarkSeq}`
        set({
          cameraBookmarks: [...cameraBookmarks, { ...bookmark, id }],
          nextCameraBookmarkSeq: nextCameraBookmarkSeq + 1,
        })
        return id
      },

      removeCameraBookmark: (id) => {
        set((state) => ({
          cameraBookmarks: state.cameraBookmarks.filter((bookmark) => bookmark.id !== id),
        }))
      },

      setBackground: (background) =>
        set((state) => ({ environment: { ...state.environment, background } })),

      toggleGrid: () =>
        set((state) => ({ environment: { ...state.environment, grid: !state.environment.grid } })),

      renameScene: (name) => set({ sceneName: name }),

      consumeKeyframeNumber: () => {
        const { nextKeyframeNumber } = get()
        set({ nextKeyframeNumber: nextKeyframeNumber + 1 })
        return nextKeyframeNumber
      },

      saveSceneSnapshot: (name) => {
        const state = get()
        const id = `scene-${state.nextSceneSnapshotSeq}`
        const snapshot: SceneSnapshot = {
          id,
          name: name ?? state.sceneName,
          data: {
            figures: state.figures,
            nextFigureSeq: state.nextFigureSeq,
            environment: state.environment,
            cameraBookmarks: state.cameraBookmarks,
            nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
            nextKeyframeNumber: state.nextKeyframeNumber,
          },
        }
        set({
          scenes: [...state.scenes, snapshot],
          nextSceneSnapshotSeq: state.nextSceneSnapshotSeq + 1,
          activeSceneId: id,
        })
        return id
      },

      saveOrUpdateActiveScene: () => {
        const state = get()
        const active = state.scenes.find((scene) => scene.id === state.activeSceneId)
        // Sem cena ativa (ou apontando para uma cena já removida): cai no
        // caminho de criar, que já cuida do id, da sequência e do ponteiro.
        if (!active) return state.saveSceneSnapshot()

        const data: SceneSnapshotData = {
          figures: state.figures,
          nextFigureSeq: state.nextFigureSeq,
          environment: state.environment,
          cameraBookmarks: state.cameraBookmarks,
          nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
          nextKeyframeNumber: state.nextKeyframeNumber,
        }
        set({
          scenes: state.scenes.map((scene) =>
            // O nome acompanha o campo "Nome da cena" da Toolbar: é o nome da
            // cena de trabalho que está sendo gravada.
            scene.id === active.id ? { ...scene, name: state.sceneName, data } : scene,
          ),
        })
        return active.id
      },

      loadSceneSnapshot: (id) => {
        const { scenes } = get()
        const snapshot = scenes.find((scene) => scene.id === id)
        if (!snapshot) return false

        set({
          ...snapshot.data,
          sceneName: snapshot.name,
          activeSceneId: id,
          selectedFigureId: null,
          selectedJointName: null,
          activeAxis: null,
        })
        return true
      },

      renameSceneSnapshot: (id, name) => {
        set((state) => ({
          scenes: state.scenes.map((scene) => (scene.id === id ? { ...scene, name } : scene)),
        }))
      },

      removeSceneSnapshot: (id) => {
        set((state) => ({
          scenes: state.scenes.filter((scene) => scene.id !== id),
          activeSceneId: state.activeSceneId === id ? null : state.activeSceneId,
        }))
      },

      loadSceneWorkingState: (data) => {
        set({
          figures: data.figures,
          nextFigureSeq: data.nextFigureSeq,
          environment: data.environment,
          cameraBookmarks: data.cameraBookmarks,
          nextCameraBookmarkSeq: data.nextCameraBookmarkSeq,
          nextKeyframeNumber: data.nextKeyframeNumber,
          sceneName: data.name,
          activeSceneId: null,
          selectedFigureId: null,
          selectedJointName: null,
          activeAxis: null,
        })
      },

      applyImportedPose: (id, imported) => {
        const height = clampHeight(imported.height)
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({ ...figure, height, pose: imported.pose })),
        }))
      },

      importFigureAsNew: (imported) => {
        const { figures, nextFigureSeq } = get()
        if (figures.length >= MAX_FIGURES) return null

        const color = nextAvailableColor(figures) ?? imported.color
        const id = `figure-${nextFigureSeq}`
        const figure: Figure = { ...imported, id, color }

        set({ figures: [...figures, figure], nextFigureSeq: nextFigureSeq + 1 })
        return id
      },

      importCameraBookmarks: (bookmarks) => {
        const { cameraBookmarks, nextCameraBookmarkSeq } = get()
        const existingNames = new Set(cameraBookmarks.map((bookmark) => bookmark.name))

        let seq = nextCameraBookmarkSeq
        const imported: CameraBookmark[] = bookmarks.map((bookmark) => {
          let name = bookmark.name
          let suffix = 2
          while (existingNames.has(name)) {
            name = `${bookmark.name} (${suffix})`
            suffix += 1
          }
          existingNames.add(name)

          const id = `camera-bookmark-${seq}`
          seq += 1
          return { ...bookmark, id, name }
        })

        set({ cameraBookmarks: [...cameraBookmarks, ...imported], nextCameraBookmarkSeq: seq })
      },

      loadWorkspaceCatalog: (scenes, activeSceneId, jointLimits) => {
        // Quem carrega a pasta já instalou os limites no `skeleton.ts` antes de
        // reconstruir as cenas (ordem exigida pelo clamp das poses — ver
        // `workspaceFolder.ts`); o padrão aqui é só espelhar o que está valendo.
        const limits = jointLimits ?? getJointLimitOverrides()
        const active = activeSceneId ? scenes.find((scene) => scene.id === activeSceneId) : undefined

        if (active) {
          set({
            scenes,
            activeSceneId,
            ...active.data,
            jointLimits: limits,
            sceneName: active.name,
            selectedFigureId: null,
            selectedJointName: null,
            activeAxis: null,
          })
        } else {
          // Sem cena ativa a cena de trabalho atual continua na tela, e ela não
          // passou pela leitura do `.glb` — precisa ser reajustada aqui.
          set((state) => ({
            scenes,
            activeSceneId,
            jointLimits: limits,
            figures: clampFigures(state.figures),
          }))
        }
      },

      applyJointLimits: (raw) => {
        const jointLimits = setJointLimitOverrides(raw)
        set((state) => ({
          jointLimits,
          figures: clampFigures(state.figures),
          scenes: clampScenes(state.scenes),
        }))
      },

      resetJointLimits: () => {
        get().applyJointLimits({})
      },

      resetWorkspace: () => {
        // Limites voltam ao padrão do código antes do `set`, para que o
        // espelho `jointLimits` do store e o `skeleton.ts` fiquem coerentes.
        setJointLimitOverrides({})
        set({
          figures: [],
          selectedFigureId: null,
          selectedJointName: null,
          activeAxis: null,
          nextFigureSeq: 1,
          cameraBookmarks: [],
          nextCameraBookmarkSeq: 1,
          environment: { ...INITIAL_ENVIRONMENT },
          sceneName: 'Cena 1',
          nextKeyframeNumber: 1,
          scenes: [],
          nextSceneSnapshotSeq: 1,
          activeSceneId: null,
          jointLimits: {},
        })
        // Depois do `set`: limpar o workspace não é desfazível (o próprio
        // histórico faz parte do que é resetado). Se fosse antes, este `set`
        // empilharia uma entrada nova e um Ctrl+Z traria tudo de volta.
        useFiguresStore.temporal.getState().clear()
      },

      applyPosePreset: (id, key) => {
        const pose = resolvePosePreset(key)
        const placement = resolvePosePresetPlacement(key)
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose,
            rotation: placement.preservesHeading
              ? { ...placement.rotation, y: figure.rotation.y }
              : placement.rotation,
            // O deslocamento vertical acompanha a escala do boneco, para que um
            // de 1,50 m deite tão colado ao chão quanto um de 1,90 m; X e Z
            // (onde ele está no chão) ficam onde o usuário os deixou.
            position: [
              figure.position[0],
              placement.groundOffsetM * getHeightScale(figure.height),
              figure.position[2],
            ],
          })),
        }))
      },

      applyHandPreset: (id, side, key) => {
        const hand = resolveHandPreset(key, side)
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose: { ...figure.pose, ...hand },
          })),
        }))
      },

      mirrorSide: (id, from) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose: mirrorPoseSide(figure.pose, from),
          })),
        }))
      },

      swapSides: (id) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            pose: swapPoseSides(figure.pose),
          })),
        }))
      },
    }),
    {
      // Seleção de boneco/junta/eixo ativo, navegação de câmera (fora deste
      // store, ver `cameraStore.ts`) e `nextKeyframeNumber` ficam fora do
      // histórico de undo — não são edição de conteúdo (ver PLANO.md >
      // "Interação de pose", item 5). O contador de keyframe em particular
      // não pode "voltar" no undo: o arquivo correspondente já foi (ou seria)
      // salvo em disco com aquele número, e desfazer o contador arriscaria
      // sobrescrever esse arquivo na próxima captura.
      // `cameraBookmarks`, `environment` (fundo/grade) e `sceneName` entram
      // normalmente: o plano trata criar/remover bookmark e mudar a
      // configuração da cena como edição de conteúdo igual a qualquer outra,
      // e renomear a cena é análogo a renomear um boneco. Todos vivem neste
      // store (em vez de stores próprios com `temporal` individual) porque o
      // `zundo` mantém uma pilha de undo por store — só um único store
      // consegue dar uma linha do tempo cronológica combinada (ver
      // DECISOES.md #8). `scenes`/`nextSceneSnapshotSeq` (catálogo de
      // snapshots do workspace) seguem a mesma regra — salvar/renomear/
      // remover um snapshot é conteúdo; `activeSceneId` fica de fora, como
      // `selectedFigureId` (é só um ponteiro de qual snapshot está carregado
      // no momento, não conteúdo em si — ver DECISOES.md #11). `jointLimits`
      // também fica de fora: é configuração do modelo que veio de um arquivo do
      // workspace (não uma edição), e desfazê-la deixaria o espelho do store
      // divergente dos limites realmente instalados no `skeleton.ts` — as poses
      // que a troca de limites ajustar, essas sim, entram no histórico normal
      // (ver DECISOES.md #29).
      partialize: (state) => ({
        figures: state.figures,
        nextFigureSeq: state.nextFigureSeq,
        cameraBookmarks: state.cameraBookmarks,
        nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
        environment: state.environment,
        sceneName: state.sceneName,
        scenes: state.scenes,
        nextSceneSnapshotSeq: state.nextSceneSnapshotSeq,
      }),
      // Toda ação do store faz atualização imutável (sempre cria um novo
      // array/objeto ao mudar algo), então igualdade referencial basta para
      // detectar "nada mudou" (ex.: só a seleção) e não empilhar histórico.
      equality: (past, current) =>
        past.figures === current.figures &&
        past.nextFigureSeq === current.nextFigureSeq &&
        past.cameraBookmarks === current.cameraBookmarks &&
        past.nextCameraBookmarkSeq === current.nextCameraBookmarkSeq &&
        past.environment === current.environment &&
        past.sceneName === current.sceneName &&
        past.scenes === current.scenes &&
        past.nextSceneSnapshotSeq === current.nextSceneSnapshotSeq,
      limit: 100,
    },
  ),
)
