import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  REFERENCE_HEIGHT_M,
  getJoint,
  setJointLimitOverrides,
} from '../../figure/skeleton'
import { resolveHandPreset } from '../../figure/handPresets'
import { resolvePosePreset } from '../../figure/posePresets'
import { COLOR_PALETTE, MAX_FIGURES, useFiguresStore } from '../figuresStore'

describe('figuresStore', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  it('starts empty with no selection', () => {
    const state = useFiguresStore.getState()
    expect(state.figures).toEqual([])
    expect(state.selectedFigureId).toBeNull()
  })

  it('adds a figure with a default height and the first palette color', () => {
    const id = useFiguresStore.getState().addFigure()
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)

    expect(figure).toBeDefined()
    expect(figure?.height).toBe(REFERENCE_HEIGHT_M)
    expect(figure?.visible).toBe(true)
    expect(figure?.color).toBe(COLOR_PALETTE[0])
    // T-pose por padrão, não a pose neutra — ver DECISOES.md #19.
    expect(figure?.pose).toEqual(resolvePosePreset('tpose'))
  })

  it('spreads new figures apart on X so they do not overlap by default', () => {
    const { addFigure } = useFiguresStore.getState()
    const firstId = addFigure() as string
    const secondId = addFigure() as string

    const first = useFiguresStore.getState().figures.find((f) => f.id === firstId)
    const second = useFiguresStore.getState().figures.find((f) => f.id === secondId)

    expect(first?.position).toEqual([0, 0, 0])
    expect(second?.position[0]).not.toBe(first?.position[0])
  })

  it('assigns a distinct palette color to each new figure', () => {
    const { addFigure } = useFiguresStore.getState()
    const ids = [addFigure(), addFigure(), addFigure(), addFigure(), addFigure()]
    const colors = useFiguresStore
      .getState()
      .figures.filter((f) => ids.includes(f.id))
      .map((f) => f.color)

    expect(new Set(colors).size).toBe(5)
    expect([...colors].sort()).toEqual([...COLOR_PALETTE].sort())
  })

  it('refuses to add a 6th figure and returns null', () => {
    const { addFigure } = useFiguresStore.getState()
    for (let i = 0; i < MAX_FIGURES; i += 1) addFigure()

    const sixthId = addFigure()

    expect(sixthId).toBeNull()
    expect(useFiguresStore.getState().figures).toHaveLength(MAX_FIGURES)
  })

  it('frees a color for reuse when a figure is removed', () => {
    const { addFigure, removeFigure } = useFiguresStore.getState()
    const firstId = addFigure()
    expect(firstId).not.toBeNull()

    removeFigure(firstId as string)
    expect(useFiguresStore.getState().figures).toHaveLength(0)

    const newId = useFiguresStore.getState().addFigure()
    const figure = useFiguresStore.getState().figures.find((f) => f.id === newId)
    expect(figure?.color).toBe(COLOR_PALETTE[0])
  })

  it('clears the selection when the selected figure is removed', () => {
    const { addFigure, removeFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    expect(useFiguresStore.getState().selectedFigureId).toBe(id)

    removeFigure(id)
    expect(useFiguresStore.getState().selectedFigureId).toBeNull()
  })

  it('duplicates a figure with a new id, a copied pose and height, and an unused color', () => {
    const { addFigure, setHeight, setJointRotation, duplicateFigure } = useFiguresStore.getState()
    const originalId = addFigure() as string
    setHeight(originalId, 1.85)
    setJointRotation(originalId, 'elbow.L', { x: 90 })

    const duplicateId = duplicateFigure(originalId) as string
    expect(duplicateId).not.toBe(originalId)

    const original = useFiguresStore.getState().figures.find((f) => f.id === originalId)
    const duplicate = useFiguresStore.getState().figures.find((f) => f.id === duplicateId)

    expect(duplicate?.height).toBe(1.85)
    expect(duplicate?.pose).toEqual(original?.pose)
    expect(duplicate?.color).not.toBe(original?.color)
    expect(duplicate?.position[0]).not.toBe(original?.position[0])
  })

  it('refuses to duplicate when already at the figure limit', () => {
    const { addFigure, duplicateFigure } = useFiguresStore.getState()
    const firstId = addFigure() as string
    for (let i = 1; i < MAX_FIGURES; i += 1) addFigure()

    expect(duplicateFigure(firstId)).toBeNull()
    expect(useFiguresStore.getState().figures).toHaveLength(MAX_FIGURES)
  })

  it('renames a figure', () => {
    const { addFigure, renameFigure } = useFiguresStore.getState()
    const id = addFigure() as string

    renameFigure(id, 'Herói')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.name).toBe('Herói')
  })

  it('toggles figure visibility', () => {
    const { addFigure, toggleVisibility } = useFiguresStore.getState()
    const id = addFigure() as string

    toggleVisibility(id)
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.visible).toBe(false)

    toggleVisibility(id)
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.visible).toBe(true)
  })

  it('clamps height to the 1.50-1.90m adjustable range', () => {
    const { addFigure, setHeight } = useFiguresStore.getState()
    const id = addFigure() as string

    setHeight(id, 3)
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.height).toBe(MAX_HEIGHT_M)

    setHeight(id, 0.1)
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.height).toBe(MIN_HEIGHT_M)
  })

  it('clamps joint rotations through the skeleton definition', () => {
    const { addFigure, setJointRotation } = useFiguresStore.getState()
    const id = addFigure() as string

    setJointRotation(id, 'elbow.L', { x: -999 })
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    // y começa em 90 (torção neutra da T-pose, ver DECISOES.md #25) — só o x é alterado aqui.
    expect(figure?.pose['elbow.L']).toEqual({ x: -150, y: 90, z: 0 })
  })

  it('changes a figure color to an unused palette color', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const id = addFigure() as string

    setColor(id, COLOR_PALETTE[2])
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe(
      COLOR_PALETTE[2],
    )
  })

  it('ignores setColor to a color already used by another figure', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const firstId = addFigure() as string
    addFigure()
    const firstColor = useFiguresStore.getState().figures.find((f) => f.id === firstId)?.color

    setColor(firstId, COLOR_PALETTE[1])
    expect(useFiguresStore.getState().figures.find((f) => f.id === firstId)?.color).toBe(
      firstColor,
    )
  })

  it('ignores setColor to a color outside the fixed palette', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const id = addFigure() as string
    const originalColor = useFiguresStore.getState().figures.find((f) => f.id === id)?.color

    setColor(id, '#123456')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe(originalColor)
  })

  it('sets the root position and free rotation without clamping', () => {
    const { addFigure, setPosition, setRootRotation } = useFiguresStore.getState()
    const id = addFigure() as string

    setPosition(id, [1, 0, -2])
    setRootRotation(id, { y: 999 })

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.position).toEqual([1, 0, -2])
    expect(figure?.rotation.y).toBe(999)
  })
})

describe('figuresStore — joint selection', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  it('starts with no joint selected', () => {
    expect(useFiguresStore.getState().selectedJointName).toBeNull()
  })

  it('selects and clears a joint', () => {
    const { selectJoint } = useFiguresStore.getState()

    selectJoint('elbow.L')
    expect(useFiguresStore.getState().selectedJointName).toBe('elbow.L')

    selectJoint(null)
    expect(useFiguresStore.getState().selectedJointName).toBeNull()
  })

  it('selecting a figure defaults its joint selection to root (ready to move/rotate)', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string

    selectFigure(id)
    expect(useFiguresStore.getState().selectedJointName).toBe('root')
  })

  it('clears the joint selection when the figure selection is cleared', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('elbow.L')

    selectFigure(null)
    expect(useFiguresStore.getState().selectedJointName).toBeNull()
  })

  it('switches the joint selection to a different joint of the same figure', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    selectJoint('elbow.L')
    expect(useFiguresStore.getState().selectedJointName).toBe('elbow.L')
  })

  it('clears the joint selection when the selected figure is removed', () => {
    const { addFigure, selectFigure, selectJoint, removeFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('elbow.L')

    removeFigure(id)
    expect(useFiguresStore.getState().selectedJointName).toBeNull()
  })
})

describe('figuresStore — active axis', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  it('starts with no active axis', () => {
    expect(useFiguresStore.getState().activeAxis).toBeNull()
  })

  it('defaults the active axis to the joint\'s first DOF when a multi-axis joint is selected', () => {
    const { selectJoint } = useFiguresStore.getState()
    selectJoint('shoulder.L')
    expect(useFiguresStore.getState().activeAxis).toBe('x')
  })

  it('defaults the active axis to the single DOF of a hinge joint', () => {
    const { selectJoint } = useFiguresStore.getState()
    selectJoint('knee.L')
    expect(useFiguresStore.getState().activeAxis).toBe('x')
  })

  it('leaves the active axis null when the root (free placement) is selected', () => {
    const { selectJoint } = useFiguresStore.getState()
    selectJoint('root')
    expect(useFiguresStore.getState().activeAxis).toBeNull()
  })

  it('clears the active axis when the joint selection is cleared', () => {
    const { selectJoint } = useFiguresStore.getState()
    selectJoint('shoulder.L')
    selectJoint(null)
    expect(useFiguresStore.getState().activeAxis).toBeNull()
  })

  it('lets the active axis be changed explicitly to another DOF of the selected joint', () => {
    const { selectJoint, setActiveAxis } = useFiguresStore.getState()
    selectJoint('shoulder.L')

    setActiveAxis('z')
    expect(useFiguresStore.getState().activeAxis).toBe('z')
  })

  it('ignores setActiveAxis to an axis that is not a DOF of the selected joint', () => {
    const { selectJoint, setActiveAxis } = useFiguresStore.getState()
    selectJoint('knee.L')

    setActiveAxis('z')
    expect(useFiguresStore.getState().activeAxis).toBe('x')
  })
})

describe('figuresStore — undo/redo (zundo)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('undoes and redoes a figure addition', () => {
    const { addFigure } = useFiguresStore.getState()
    addFigure()
    expect(useFiguresStore.getState().figures).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().figures).toHaveLength(0)

    useFiguresStore.temporal.getState().redo()
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('undoes a pose change', () => {
    const { addFigure, setJointRotation } = useFiguresStore.getState()
    const id = addFigure() as string
    setJointRotation(id, 'elbow.L', { x: -90 })
    // y começa em 90 (torção neutra da T-pose, ver DECISOES.md #25) — só o x é alterado aqui.
    expect(useFiguresStore.getState().figures[0].pose['elbow.L']).toEqual({ x: -90, y: 90, z: 0 })

    useFiguresStore.temporal.getState().undo()
    // volta ao valor inicial da T-pose (não mais undefined — a pose inicial
    // já vem preenchida, ver DECISOES.md #19), não a uma pose vazia.
    expect(useFiguresStore.getState().figures[0].pose['elbow.L']).toEqual({ x: 0, y: 90, z: 0 })
  })

  it('does not track selection changes in the undo history', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    useFiguresStore.temporal.getState().clear()

    selectFigure(id)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('tracks creating and removing a camera bookmark in the same undo history as figure edits', () => {
    const { addCameraBookmark, removeCameraBookmark } = useFiguresStore.getState()
    const id = addCameraBookmark({
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(0)

    useFiguresStore.temporal.getState().redo()
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(1)

    removeCameraBookmark(id as string)
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(0)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(1)
  })
})

describe('figuresStore — camera bookmarks', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  const sampleBookmark = {
    name: 'Frente',
    position: [0, 1, 5] as [number, number, number],
    target: [0, 1, 0] as [number, number, number],
    projection: 'orthographic' as const,
    fov: 50,
    zoom: 80,
  }

  it('saves a camera bookmark with a generated id, preserving the given snapshot', () => {
    const { addCameraBookmark } = useFiguresStore.getState()
    const id = addCameraBookmark(sampleBookmark)

    const bookmark = useFiguresStore.getState().cameraBookmarks.find((b) => b.id === id)
    expect(bookmark).toMatchObject(sampleBookmark)
  })

  it('assigns distinct ids to successive bookmarks', () => {
    const { addCameraBookmark } = useFiguresStore.getState()
    const firstId = addCameraBookmark(sampleBookmark)
    const secondId = addCameraBookmark({ ...sampleBookmark, name: 'Costas' })

    expect(firstId).not.toBe(secondId)
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(2)
  })

  it('removes a bookmark by id, leaving the others untouched', () => {
    const { addCameraBookmark, removeCameraBookmark } = useFiguresStore.getState()
    const firstId = addCameraBookmark(sampleBookmark) as string
    const secondId = addCameraBookmark({ ...sampleBookmark, name: 'Costas' }) as string

    removeCameraBookmark(firstId)

    const remaining = useFiguresStore.getState().cameraBookmarks
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(secondId)
  })
})

describe('figuresStore — environment settings', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  it('starts with a medium background and grid visible', () => {
    const state = useFiguresStore.getState()
    expect(state.environment.background).toBe('medium')
    expect(state.environment.grid).toBe(true)
  })

  it('setBackground updates the background tone', () => {
    useFiguresStore.getState().setBackground('dark')
    expect(useFiguresStore.getState().environment.background).toBe('dark')
  })

  it('toggleGrid flips grid visibility', () => {
    useFiguresStore.getState().toggleGrid()
    expect(useFiguresStore.getState().environment.grid).toBe(false)

    useFiguresStore.getState().toggleGrid()
    expect(useFiguresStore.getState().environment.grid).toBe(true)
  })
})

describe('figuresStore — undo/redo covers environment changes in the same chronological history as figures', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('undoes a background change tracked in the shared undo history', () => {
    useFiguresStore.getState().setBackground('dark')
    expect(useFiguresStore.getState().environment.background).toBe('dark')

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().environment.background).toBe('medium')

    useFiguresStore.temporal.getState().redo()
    expect(useFiguresStore.getState().environment.background).toBe('dark')
  })

  it('undoes a figure edit and an environment edit in true chronological order, interleaved', () => {
    const { addFigure, setBackground, toggleGrid } = useFiguresStore.getState()
    const id = addFigure() as string // 1
    setBackground('dark') // 2
    useFiguresStore.getState().setHeight(id, 1.5) // 3
    toggleGrid() // 4 (grid -> false)

    // Desfazer na ordem inversa exata em que as edições aconteceram,
    // independente de serem "boneco" ou "ambiente" — é exatamente essa
    // linha do tempo combinada que motivou mover `environment` para este
    // store em vez de manter um `sceneStore` com histórico próprio.
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().environment.grid).toBe(true) // desfaz (4)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().figures[0].height).not.toBe(1.5) // desfaz (3)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().environment.background).toBe('medium') // desfaz (2)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().figures).toHaveLength(0) // desfaz (1)
  })

  it('does not track selection/joint/axis changes mixed with an environment change', () => {
    const { addFigure, selectFigure, setBackground } = useFiguresStore.getState()
    const id = addFigure() as string
    useFiguresStore.temporal.getState().clear()

    selectFigure(id)
    setBackground('light')
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(1)
  })
})

describe('figuresStore — scene name', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts with a default scene name', () => {
    expect(useFiguresStore.getState().sceneName).toBe('Cena 1')
  })

  it('renameScene updates the scene name', () => {
    useFiguresStore.getState().renameScene('Cena da praia')
    expect(useFiguresStore.getState().sceneName).toBe('Cena da praia')
  })

  it('tracks scene renames in the shared undo history, like renaming a figure', () => {
    useFiguresStore.getState().renameScene('Cena da praia')
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().sceneName).toBe('Cena 1')
  })
})

describe('figuresStore — keyframe sequence counter', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts at 1', () => {
    expect(useFiguresStore.getState().nextKeyframeNumber).toBe(1)
  })

  it('consumeKeyframeNumber returns the current number and advances the counter', () => {
    const { consumeKeyframeNumber } = useFiguresStore.getState()
    expect(consumeKeyframeNumber()).toBe(1)
    expect(consumeKeyframeNumber()).toBe(2)
    expect(consumeKeyframeNumber()).toBe(3)
    expect(useFiguresStore.getState().nextKeyframeNumber).toBe(4)
  })

  it('is not tracked in the undo history — capturing a keyframe is not an undoable content edit', () => {
    useFiguresStore.getState().consumeKeyframeNumber()
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)

    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().consumeKeyframeNumber()
    useFiguresStore.temporal.getState().undo()
    // Desfazer não deve "devolver" o número consumido: o arquivo já foi
    // (ou seria) salvo em disco com aquele número, então voltar o contador
    // arriscaria reescrever um arquivo existente na próxima captura.
    expect(useFiguresStore.getState().nextKeyframeNumber).toBe(3)
    expect(useFiguresStore.getState().figures).toHaveLength(0)
  })
})

describe('figuresStore — workspace: catálogo de snapshots de cena', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts with no saved snapshots and no active scene', () => {
    const state = useFiguresStore.getState()
    expect(state.scenes).toEqual([])
    expect(state.activeSceneId).toBeNull()
  })

  it('saveSceneSnapshot captures the current working state and becomes the active scene', () => {
    const { addFigure, setBackground, saveSceneSnapshot } = useFiguresStore.getState()
    addFigure('Boneco A')
    setBackground('dark')

    const id = saveSceneSnapshot('Pose inicial')

    const state = useFiguresStore.getState()
    expect(state.activeSceneId).toBe(id)
    const snapshot = state.scenes.find((scene) => scene.id === id)
    expect(snapshot?.name).toBe('Pose inicial')
    expect(snapshot?.data.figures).toHaveLength(1)
    expect(snapshot?.data.figures[0].name).toBe('Boneco A')
    expect(snapshot?.data.environment.background).toBe('dark')
  })

  it('saveSceneSnapshot defaults the snapshot name to the current scene name', () => {
    const { renameScene, saveSceneSnapshot } = useFiguresStore.getState()
    renameScene('Cena da praia')
    const id = saveSceneSnapshot()
    expect(useFiguresStore.getState().scenes.find((s) => s.id === id)?.name).toBe('Cena da praia')
  })

  it('saving two snapshots assigns distinct sequential ids', () => {
    const { saveSceneSnapshot } = useFiguresStore.getState()
    const first = saveSceneSnapshot('A')
    const second = saveSceneSnapshot('B')
    expect(first).not.toBe(second)
    expect(useFiguresStore.getState().scenes).toHaveLength(2)
  })

  it('loadSceneSnapshot replaces the working figures/environment/bookmarks and clears selection', () => {
    const { addFigure, selectFigure, setBackground, saveSceneSnapshot, loadSceneSnapshot } =
      useFiguresStore.getState()
    const figureId = addFigure() as string
    selectFigure(figureId)
    setBackground('dark')
    const snapshotId = saveSceneSnapshot('Cena A')

    // Muda o estado de trabalho depois de salvar o snapshot.
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().setBackground('light')
    expect(useFiguresStore.getState().figures).toHaveLength(2)

    const found = loadSceneSnapshot(snapshotId)

    const state = useFiguresStore.getState()
    expect(found).toBe(true)
    expect(state.figures).toHaveLength(1)
    expect(state.environment.background).toBe('dark')
    expect(state.activeSceneId).toBe(snapshotId)
    expect(state.sceneName).toBe('Cena A')
    expect(state.selectedFigureId).toBeNull()
  })

  it('loadSceneSnapshot returns false and does nothing for an unknown id', () => {
    const { addFigure, loadSceneSnapshot } = useFiguresStore.getState()
    addFigure()
    const found = loadSceneSnapshot('scene-inexistente')
    expect(found).toBe(false)
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('renameSceneSnapshot renames a saved snapshot without touching the working scene name', () => {
    const { saveSceneSnapshot, renameSceneSnapshot, renameScene } = useFiguresStore.getState()
    const id = saveSceneSnapshot('Nome antigo')
    renameSceneSnapshot(id, 'Nome novo')
    expect(useFiguresStore.getState().scenes.find((s) => s.id === id)?.name).toBe('Nome novo')
    expect(useFiguresStore.getState().sceneName).toBe('Cena 1') // trabalho não foi recarregado, não muda
    renameScene('outro nome') // sanity: ações continuam independentes
  })

  it('removeSceneSnapshot deletes a snapshot and clears activeSceneId if it was active', () => {
    const { saveSceneSnapshot, removeSceneSnapshot } = useFiguresStore.getState()
    const id = saveSceneSnapshot('A')
    removeSceneSnapshot(id)
    const state = useFiguresStore.getState()
    expect(state.scenes).toEqual([])
    expect(state.activeSceneId).toBeNull()
  })

  it('removeSceneSnapshot does not touch the current working figures', () => {
    const { addFigure, saveSceneSnapshot, removeSceneSnapshot } = useFiguresStore.getState()
    addFigure()
    const id = saveSceneSnapshot('A')
    removeSceneSnapshot(id)
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('tracks snapshot create/rename/remove in the shared undo history, like camera bookmarks', () => {
    const { saveSceneSnapshot, renameSceneSnapshot, removeSceneSnapshot } = useFiguresStore.getState()
    const id = saveSceneSnapshot('A')
    renameSceneSnapshot(id, 'B')
    removeSceneSnapshot(id)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().scenes).toHaveLength(1) // desfaz remove

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().scenes[0].name).toBe('A') // desfaz rename

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().scenes).toHaveLength(0) // desfaz save
  })

  it('loadSceneSnapshot is a single undo step, restoring the exact previous working state on undo', () => {
    const { addFigure, saveSceneSnapshot, loadSceneSnapshot } = useFiguresStore.getState()
    const emptySnapshotId = saveSceneSnapshot('Vazia')
    addFigure()
    addFigure()
    useFiguresStore.temporal.getState().clear()

    loadSceneSnapshot(emptySnapshotId)
    expect(useFiguresStore.getState().figures).toHaveLength(0)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().figures).toHaveLength(2) // volta ao estado de trabalho anterior ao load, num único passo
  })
})

describe('figuresStore — importação de arquivo (.glb)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('loadSceneWorkingState substitui a cena de trabalho por dados importados de um arquivo, num único passo de undo', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().loadSceneWorkingState({
      name: 'Cena importada',
      figures: [],
      nextFigureSeq: 5,
      environment: { background: 'light', grid: false },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextKeyframeNumber: 9,
    })

    const state = useFiguresStore.getState()
    expect(state.sceneName).toBe('Cena importada')
    expect(state.figures).toHaveLength(0)
    expect(state.nextFigureSeq).toBe(5)
    expect(state.environment).toEqual({ background: 'light', grid: false })
    expect(state.nextKeyframeNumber).toBe(9)
    expect(state.activeSceneId).toBeNull() // não é um snapshot salvo do catálogo
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('applyImportedPose aplica altura/pose importadas a um boneco existente, preservando identidade/cor/posição', () => {
    const id = useFiguresStore.getState().addFigure('Original') as string
    useFiguresStore.getState().setPosition(id, [2, 0, 1])

    useFiguresStore.getState().applyImportedPose(id, { height: 1.85, pose: { 'elbow.L': { x: 45, y: 0, z: 0 } } })

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.name).toBe('Original')
    expect(figure?.position).toEqual([2, 0, 1])
    expect(figure?.height).toBe(1.85)
    expect(figure?.pose['elbow.L']).toEqual({ x: 45, y: 0, z: 0 })
  })

  it('importFigureAsNew cria um novo boneco a partir dos dados importados', () => {
    const id = useFiguresStore.getState().importFigureAsNew({
      name: 'Boneco importado',
      color: '#e04040',
      visible: true,
      height: 1.6,
      position: [3, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      pose: { 'knee.R': { x: 30, y: 0, z: 0 } },
    })

    expect(id).not.toBeNull()
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.name).toBe('Boneco importado')
    expect(figure?.height).toBe(1.6)
    expect(figure?.pose['knee.R']).toEqual({ x: 30, y: 0, z: 0 })
  })

  it('importFigureAsNew recusa quando já há 5 bonecos e retorna null', () => {
    const { addFigure, importFigureAsNew } = useFiguresStore.getState()
    for (let i = 0; i < MAX_FIGURES; i += 1) addFigure()

    const id = importFigureAsNew({
      name: 'Extra',
      color: '#e04040',
      visible: true,
      height: 1.7,
      position: [0, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      pose: {},
    })

    expect(id).toBeNull()
    expect(useFiguresStore.getState().figures).toHaveLength(MAX_FIGURES)
  })

  it('importCameraBookmarks adiciona bookmarks preservando os existentes', () => {
    const { addCameraBookmark, importCameraBookmarks } = useFiguresStore.getState()
    addCameraBookmark({ name: 'Vista A', position: [1, 1, 1], target: [0, 0, 0], projection: 'perspective', fov: 50, zoom: 1 })

    importCameraBookmarks([
      { name: 'Vista B', position: [2, 2, 2], target: [0, 0, 0], projection: 'perspective', fov: 50, zoom: 1 },
    ])

    const names = useFiguresStore.getState().cameraBookmarks.map((b) => b.name)
    expect(names).toEqual(['Vista A', 'Vista B'])
  })

  it('loadWorkspaceCatalog substitui o catálogo de cenas e carrega a cena ativa na cena de trabalho', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.temporal.getState().clear()

    const importedScenes = [
      {
        id: 'scene-1',
        name: 'Cena importada A',
        data: {
          figures: [],
          nextFigureSeq: 1,
          environment: { background: 'dark' as const, grid: false },
          cameraBookmarks: [],
          nextCameraBookmarkSeq: 1,
          nextKeyframeNumber: 1,
        },
      },
    ]

    useFiguresStore.getState().loadWorkspaceCatalog(importedScenes, 'scene-1')

    const state = useFiguresStore.getState()
    expect(state.scenes).toEqual(importedScenes)
    expect(state.activeSceneId).toBe('scene-1')
    expect(state.sceneName).toBe('Cena importada A')
    expect(state.environment.background).toBe('dark')
    expect(state.figures).toEqual([])
  })

  it('loadWorkspaceCatalog só substitui o catálogo quando não há um id de cena ativa correspondente', () => {
    useFiguresStore.getState().addFigure('Boneco existente')

    useFiguresStore.getState().loadWorkspaceCatalog([], null)

    const state = useFiguresStore.getState()
    expect(state.scenes).toEqual([])
    expect(state.activeSceneId).toBeNull()
    expect(state.figures).toHaveLength(1) // cena de trabalho não é tocada
  })

  // Limites articulares customizados pelo workspace — ver DECISOES.md #29.
  it('applyJointLimits instala a faixa customizada e ajusta as poses já carregadas', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 150 })

    useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 45 } } })

    const state = useFiguresStore.getState()
    expect(state.jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(state.figures.find((f) => f.id === id)?.pose['knee.L'].x).toBe(45)
    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 45 })
  })

  it('applyJointLimits também ajusta as poses dos snapshots do catálogo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 150 })
    useFiguresStore.getState().saveSceneSnapshot('Cena com joelho dobrado')

    useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 45 } } })

    const snapshot = useFiguresStore.getState().scenes[0]
    expect(snapshot.data.figures[0].pose['knee.L'].x).toBe(45)
  })

  it('applyJointLimits com nada fora da faixa não mexe nas poses (não empilha undo)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 30 })
    const figuresBefore = useFiguresStore.getState().figures
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 45 } } })

    expect(useFiguresStore.getState().figures).toBe(figuresBefore)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('resetJointLimits volta aos limites do código e reajusta poses que ficaram fora deles', () => {
    const id = useFiguresStore.getState().addFigure() as string
    // Faixa alargada além do padrão do joelho (0..150) e uma pose que a usa.
    useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 170 } } })
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 170 })

    useFiguresStore.getState().resetJointLimits()

    const state = useFiguresStore.getState()
    expect(state.jointLimits).toEqual({})
    expect(state.figures.find((f) => f.id === id)?.pose['knee.L'].x).toBe(150)
  })

  it('loadWorkspaceCatalog espelha os limites do workspace e ajusta a cena de trabalho que ficou na tela', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 150 })
    // Quem carrega a pasta instala os limites antes de chamar o store.
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })

    useFiguresStore.getState().loadWorkspaceCatalog([], null, { 'knee.L': { x: { min: 0, max: 45 } } })

    const state = useFiguresStore.getState()
    expect(state.jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(state.figures.find((f) => f.id === id)?.pose['knee.L'].x).toBe(45)
  })

  it('importCameraBookmarks adiciona um sufixo automático quando o nome já existe', () => {
    const { addCameraBookmark, importCameraBookmarks } = useFiguresStore.getState()
    addCameraBookmark({ name: 'Vista A', position: [1, 1, 1], target: [0, 0, 0], projection: 'perspective', fov: 50, zoom: 1 })

    importCameraBookmarks([
      { name: 'Vista A', position: [2, 2, 2], target: [0, 0, 0], projection: 'perspective', fov: 50, zoom: 1 },
    ])

    const names = useFiguresStore.getState().cameraBookmarks.map((b) => b.name)
    expect(names).toEqual(['Vista A', 'Vista A (2)'])
  })
})

describe('figuresStore — poses predefinidas', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('applyPosePreset substitui a pose do boneco pela pose completa do preset', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'sitting')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figure.pose['hip.L'].x).toBeLessThan(0)
    expect(figure.pose['knee.L'].x).toBeGreaterThan(0)
  })

  it('preserva onde o boneco está no chão e a direção que ele encara, numa pose em pé', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1, 0, 2])
    useFiguresStore.getState().setRootRotation(id, { y: 45 })

    useFiguresStore.getState().applyPosePreset(id, 'running')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figure.position).toEqual([1, 0, 2])
    // X/Z (onde ele está) e o giro em Y (para onde ele encara) são encenação do
    // usuário — só a altura e a inclinação pertencem ao preset (DECISOES.md #30).
    expect(figure.rotation).toEqual({ x: 0, y: 45, z: 0 })
  })

  it('assenta o boneco no chão quando o preset pede (sentado desce o quadril)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1, 0, 2])

    useFiguresStore.getState().applyPosePreset(id, 'sitting')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figure.position[0]).toBe(1)
    expect(figure.position[2]).toBe(2)
    // Quadril a 0,485 m (altura de assento) em vez dos 0,90 m de pé.
    expect(figure.position[1]).toBeCloseTo(0.485 - 0.9, 5)
  })

  it('deita o boneco (impondo a rotação inteira) e desfaz isso ao voltar para uma pose em pé', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(id, { y: 45 })

    useFiguresStore.getState().applyPosePreset(id, 'lyingHandsBehindHead')
    let figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    // Deitado de costas: a inclinação vale por inteiro — manter o giro prévio
    // deixaria o boneco rolado sobre o próprio eixo em vez de deitado.
    expect(figure.rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(figure.position[1]).toBeLessThan(0)

    useFiguresStore.getState().applyPosePreset(id, 'standing')
    figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figure.rotation).toEqual({ x: 0, y: 0, z: 0 })
    expect(figure.position[1]).toBe(0)
  })

  it('escala o deslocamento vertical pela altura do boneco', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setHeight(id, 1.5)
    useFiguresStore.getState().applyPosePreset(id, 'sitting')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    // Um boneco menor senta num assento proporcionalmente mais baixo.
    expect(figure.position[1]).toBeCloseTo((0.485 - 0.9) * (1.5 / 1.7), 5)
  })

  it('is tracked by undo, like any other pose edit', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'walking')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose['hip.L'].x).not.toBe(0)

    useFiguresStore.temporal.getState().undo()
    // volta à pose inicial (T-pose, ver DECISOES.md #19), não a uma pose vazia.
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toEqual(
      resolvePosePreset('tpose'),
    )
  })

  it('does nothing for an unknown figure id', () => {
    expect(() => useFiguresStore.getState().applyPosePreset('figure-inexistente', 'standing')).not.toThrow()
  })
})

describe('figuresStore — poses de mão e simetria (DECISOES.md #30)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  it('applyHandPreset fecha só a mão pedida, sem tocar na outra nem no braço', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const before = figureById(id)

    useFiguresStore.getState().applyHandPreset(id, 'R', 'fist')

    const figure = figureById(id)
    expect(figure.pose['fingersBase.R']).toEqual(resolveHandPreset('fist', 'R')['fingersBase.R'])
    expect(figure.pose['fingersBase.L']).toEqual(before.pose['fingersBase.L'])
    expect(figure.pose['wrist.R']).toEqual(before.pose['wrist.R'])
    expect(figure.pose['elbow.R']).toEqual(before.pose['elbow.R'])
  })

  it('applyHandPreset preserva o ângulo do punho que o usuário já tinha ajustado', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'wrist.L', { x: 40 })

    useFiguresStore.getState().applyHandPreset(id, 'L', 'thumbsUp')

    expect(figureById(id).pose['wrist.L'].x).toBe(40)
  })

  it('mirrorSide copia o lado indicado espelhado, sem mexer no tronco', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -40, z: -70 })
    useFiguresStore.getState().setJointRotation(id, 'spine', { y: 25 })

    useFiguresStore.getState().mirrorSide(id, 'R')

    const figure = figureById(id)
    expect(figure.pose['shoulder.L']).toEqual({ x: -40, y: 0, z: 70 })
    expect(figure.pose['spine'].y).toBe(25)
  })

  it('swapSides troca os dois lados e é reversível aplicando de novo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: -30 })
    useFiguresStore.getState().setJointRotation(id, 'hip.R', { x: 20 })
    const before = figureById(id).pose

    useFiguresStore.getState().swapSides(id)
    expect(figureById(id).pose['hip.L'].x).toBe(20)
    expect(figureById(id).pose['hip.R'].x).toBe(-30)

    useFiguresStore.getState().swapSides(id)
    expect(figureById(id).pose).toEqual(before)
  })

  it('as três operações entram no histórico de undo como qualquer edição de pose', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const tpose = figureById(id).pose

    useFiguresStore.getState().applyHandPreset(id, 'L', 'fist')
    useFiguresStore.getState().mirrorSide(id, 'L')
    useFiguresStore.getState().swapSides(id)

    useFiguresStore.temporal.getState().undo()
    useFiguresStore.temporal.getState().undo()
    useFiguresStore.temporal.getState().undo()
    expect(figureById(id).pose).toEqual(tpose)
  })

  it('respeita os limites customizados do workspace ao espelhar (DECISOES.md #29)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { z: -120 })
    // Workspace aperta só o lado esquerdo: o espelho não pode furar esse limite.
    useFiguresStore.getState().applyJointLimits({ 'shoulder.L': { z: { min: -20, max: 45 } } })

    useFiguresStore.getState().mirrorSide(id, 'R')

    expect(figureById(id).pose['shoulder.L'].z).toBe(45)
  })

  it('não faz nada para um id de boneco inexistente', () => {
    expect(() => {
      useFiguresStore.getState().applyHandPreset('figure-inexistente', 'L', 'fist')
      useFiguresStore.getState().mirrorSide('figure-inexistente', 'L')
      useFiguresStore.getState().swapSides('figure-inexistente')
    }).not.toThrow()
  })
})
