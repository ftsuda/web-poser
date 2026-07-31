import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getJoint,
  setJointLimitOverrides,
} from '../../figure/skeleton'
import { resolveHandPreset } from '../../figure/handPresets'
import { figureBlendState, resolveBlendTarget } from '../../figure/poseBlend'
import { mirrorRotation } from '../../figure/poseMirror'
import { resolvePosePreset, resolvePosePresetPlacement } from '../../figure/posePresets'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
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

  // Fase 9, item 14: um boneco oculto fica inerte — não pode continuar
  // selecionado (com gizmo no viewport) sem o usuário conseguir vê-lo.
  it('clears the selection when the currently selected figure is hidden', () => {
    const { addFigure, selectFigure, toggleVisibility } = useFiguresStore.getState()
    const id = addFigure() as string

    selectFigure(id)
    expect(useFiguresStore.getState().selectedJointName).toBe(ROOT_JOINT_NAME)

    toggleVisibility(id)
    expect(useFiguresStore.getState().selectedFigureId).toBeNull()
    expect(useFiguresStore.getState().selectedJointName).toBeNull()
    expect(useFiguresStore.getState().activeAxis).toBeNull()
  })

  it('keeps the selection of other figures when one is hidden, and when a figure is shown again', () => {
    const { addFigure, selectFigure, toggleVisibility } = useFiguresStore.getState()
    const first = addFigure() as string
    const second = addFigure() as string

    selectFigure(second)
    toggleVisibility(first)
    expect(useFiguresStore.getState().selectedFigureId).toBe(second)

    // Mostrar de volta nunca mexe na seleção.
    toggleVisibility(first)
    expect(useFiguresStore.getState().selectedFigureId).toBe(second)
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

  it('setJointRotations grava várias juntas num único set (um passo de undo), com clamp e trava', () => {
    const { addFigure, setJointRotations, toggleJointLock } = useFiguresStore.getState()
    const id = addFigure() as string
    toggleJointLock(id, 'shoulder.L')
    const lockedBefore = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose['shoulder.L']
    useFiguresStore.temporal.getState().clear()

    setJointRotations(id, {
      'elbow.L': { x: -999 },
      'shoulder.L': { x: -45 },
      spine: { z: 10 },
    })

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figure.pose['elbow.L'].x).toBe(-150) // clamp igual ao da escrita unitária
    expect(figure.pose['shoulder.L']).toEqual(lockedBefore) // travada não muda
    expect(figure.pose.spine.z).toBe(10)
    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(1)
  })

  it('changes a figure color to another palette color', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const id = addFigure() as string

    setColor(id, COLOR_PALETTE[2])
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe(
      COLOR_PALETTE[2],
    )
  })

  // Cor LIVRE (DECISOES.md #39): estes três testes substituem os dois antigos,
  // que travavam justamente o oposto — só cor da paleta e cor única entre os
  // bonecos.
  it('accepts ANY valid hex color, including one already used by another figure', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const firstId = addFigure() as string
    const secondId = addFigure() as string

    setColor(firstId, '#123456')
    expect(useFiguresStore.getState().figures.find((f) => f.id === firstId)?.color).toBe('#123456')

    // Dois bonecos da mesma cor é escolha de quem monta a cena, não erro.
    const secondColor = useFiguresStore.getState().figures.find((f) => f.id === secondId)?.color
    setColor(firstId, secondColor as string)
    expect(useFiguresStore.getState().figures.find((f) => f.id === firstId)?.color).toBe(secondColor)
  })

  it('normalizes the color to lowercase #rrggbb, expanding the short form', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const id = addFigure() as string

    setColor(id, '#AABBCC')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe('#aabbcc')

    setColor(id, '#0f8')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe('#00ff88')
  })

  it('ignores setColor when the value is not a color at all', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    const id = addFigure() as string
    const original = useFiguresStore.getState().figures.find((f) => f.id === id)?.color

    // Nada disso pode chegar ao material do three.js nem ao `style` do painel.
    for (const bogus of ['red', 'rgb(1,2,3)', '#12345', '#gggggg', '', 'javascript:alert(1)']) {
      setColor(id, bogus)
      expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.color).toBe(original)
    }
  })

  it('keeps adding figures up to the limit even when colors repeat', () => {
    const { addFigure, setColor } = useFiguresStore.getState()
    // Antes do #39 a paleta ERA o limite: com duas cores repetidas sobrava cor
    // na lista e `addFigure` devolvia null antes de chegar a MAX_FIGURES.
    const first = addFigure() as string
    const second = addFigure() as string
    setColor(first, '#111111')
    setColor(second, '#111111')

    while (useFiguresStore.getState().figures.length < MAX_FIGURES) {
      expect(addFigure()).not.toBeNull()
    }
    expect(useFiguresStore.getState().figures).toHaveLength(MAX_FIGURES)
    expect(addFigure()).toBeNull()
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

describe('figuresStore — snapshot sequence counter', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts at 1', () => {
    expect(useFiguresStore.getState().nextSnapshotNumber).toBe(1)
  })

  it('consumeSnapshotNumber returns the current number and advances the counter', () => {
    const { consumeSnapshotNumber } = useFiguresStore.getState()
    expect(consumeSnapshotNumber()).toBe(1)
    expect(consumeSnapshotNumber()).toBe(2)
    expect(consumeSnapshotNumber()).toBe(3)
    expect(useFiguresStore.getState().nextSnapshotNumber).toBe(4)
  })

  it('is not tracked in the undo history — capturing a snapshot is not an undoable content edit', () => {
    useFiguresStore.getState().consumeSnapshotNumber()
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)

    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().consumeSnapshotNumber()
    useFiguresStore.temporal.getState().undo()
    // Desfazer não deve "devolver" o número consumido: o arquivo já foi
    // (ou seria) salvo em disco com aquele número, então voltar o contador
    // arriscaria reescrever um arquivo existente na próxima captura.
    expect(useFiguresStore.getState().nextSnapshotNumber).toBe(3)
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

/**
 * A câmera de cena (fase 11): conteúdo persistido da cena, mas FORA do
 * histórico de undo — mover a câmera é enquadrar, como a navegação, e um
 * Ctrl+Z de pose não pode teleportá-la (decidido com o usuário).
 */
describe('figuresStore — câmera de cena (fase 11)', () => {
  const VISTA = {
    position: [5, 3, 1] as [number, number, number],
    target: [0, 1.2, 0] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
    focalMm: 85,
  }

  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('nasce com a câmera padrão e setSceneCamera a substitui', () => {
    expect(useFiguresStore.getState().sceneCamera).toEqual(DEFAULT_SCENE_CAMERA)
    useFiguresStore.getState().setSceneCamera(VISTA)
    expect(useFiguresStore.getState().sceneCamera).toEqual(VISTA)
  })

  it('mover a câmera não empilha histórico de undo', () => {
    useFiguresStore.getState().setSceneCamera(VISTA)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('desfazer uma edição de pose não teleporta a câmera de volta', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().setSceneCamera(VISTA)

    useFiguresStore.temporal.getState().undo()

    expect(useFiguresStore.getState().figures).toHaveLength(0)
    expect(useFiguresStore.getState().sceneCamera).toEqual(VISTA)
  })

  it('cada snapshot de cena guarda o próprio enquadramento e o devolve ao carregar', () => {
    useFiguresStore.getState().setSceneCamera(VISTA)
    const id = useFiguresStore.getState().saveSceneSnapshot('Com câmera')

    useFiguresStore.getState().setSceneCamera(DEFAULT_SCENE_CAMERA)
    expect(useFiguresStore.getState().loadSceneSnapshot(id)).toBe(true)

    expect(useFiguresStore.getState().sceneCamera).toEqual(VISTA)
  })

  it('resetWorkspace devolve a câmera ao padrão', () => {
    useFiguresStore.getState().setSceneCamera(VISTA)
    useFiguresStore.getState().resetWorkspace()
    expect(useFiguresStore.getState().sceneCamera).toEqual(DEFAULT_SCENE_CAMERA)
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
      props: [],
      nextPropSeq: 1,
      environment: { background: 'light', grid: false },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextSnapshotNumber: 9,
      sceneCamera: { position: [2, 1.6, 3], target: [0, 0.9, 0], up: [0, 1, 0], focalMm: 50 },
    })

    const state = useFiguresStore.getState()
    expect(state.sceneName).toBe('Cena importada')
    expect(state.figures).toHaveLength(0)
    expect(state.nextFigureSeq).toBe(5)
    expect(state.environment).toEqual({ background: 'light', grid: false })
    expect(state.nextSnapshotNumber).toBe(9)
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
          props: [],
          nextPropSeq: 1,
          environment: { background: 'dark' as const, grid: false },
          cameraBookmarks: [],
          nextCameraBookmarkSeq: 1,
          nextSnapshotNumber: 1,
          sceneCamera: DEFAULT_SCENE_CAMERA,
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

/**
 * Aplicação automática em dupla (DECISOES.md #41): as poses em par sempre
 * vieram aos pares, e montar a cena era manual — aplicar a outra metade no
 * segundo boneco e afastá-lo a olho até bater com a distância da dica. Agora,
 * com DOIS bonecos em cena, aplicar uma pose de par monta o par inteiro.
 * A geometria do encaixe é travada em `posePairs.test.ts`; aqui trava-se o
 * comportamento do store: quem é mexido, quem não é, e o que é uma edição só.
 */
describe('figuresStore — poses em dupla aplicadas nos dois bonecos', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  it('aplica a pose correspondente no outro boneco e o posiciona à distância do par', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(b, [3, 0, -4])

    useFiguresStore.getState().applyPosePreset(a, 'danceLead')

    expect(figureById(b).pose).toEqual(resolvePosePreset('danceFollow'))
    // De frente para quem conduz, a 0,36 m — não mais onde o usuário o tinha
    // deixado.
    expect(figureById(b).position[0]).toBeCloseTo(0, 5)
    expect(figureById(b).position[2]).toBeCloseTo(0.36, 5)
    expect(figureById(b).rotation).toEqual({ x: 0, y: 180, z: 0 })
    // Quem recebeu a pose não sai do lugar: é o parceiro que se move.
    expect(figureById(a).position[0]).toBe(0)
    expect(figureById(a).position[2]).toBe(0)
  })

  it('monta o par em volta de quem recebeu a pose, no giro em que ele estiver', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(a, [2, 0, 1])
    useFiguresStore.getState().setRootRotation(a, { y: 90 })

    useFiguresStore.getState().applyPosePreset(a, 'handshake')

    // Girado 90°, "à frente" passa a ser +X: o parceiro acompanha o giro em
    // vez de ficar no eixo Z do mundo.
    expect(figureById(b).position[0]).toBeCloseTo(2 + 0.755, 3)
    expect(figureById(b).position[2]).toBeCloseTo(1, 3)
    expect(figureById(b).rotation).toEqual({ x: 0, y: -90, z: 0 })
  })

  it('escala a distância do par pela altura dos bonecos', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setHeight(a, 1.5)
    useFiguresStore.getState().setHeight(b, 1.5)

    useFiguresStore.getState().applyPosePreset(a, 'handshake')

    expect(figureById(b).position[2]).toBeCloseTo(0.755 * (1.5 / 1.7), 3)
  })

  it('assenta o parceiro na altura que a pose dele pede', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string

    useFiguresStore.getState().applyPosePreset(a, 'pullingUp')

    // Quem é ajudado está no chão: o quadril desce de 0,90 m para 0,415 m.
    expect(figureById(b).position[1]).toBeCloseTo(0.415 - 0.9, 5)
  })

  it('compõe a rotação (em vez de somar graus em Y) quando a pose do parceiro é deitada', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(a, { y: 90 })

    useFiguresStore.getState().applyPosePreset(a, 'carryingCradle')

    // Deitado atravessado nos braços de quem carrega: com o carregador girado
    // 90°, somar 90 em `y` ROLARIA o corpo em torno do próprio eixo.
    expect(figureById(b).rotation).toEqual({ x: -90, y: 0, z: 0 })
  })

  it('não mexe em ninguém quando a pose é solo', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    const before = figureById(b)

    useFiguresStore.getState().applyPosePreset(a, 'running')

    expect(figureById(b)).toBe(before)
  })

  it('com o par automático desligado, só quem recebeu a pose muda', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(b, [3, 0, -4])
    const before = figureById(b)

    useFiguresStore.getState().applyPosePreset(a, 'handshake', { pairPartner: false })

    // O parceiro fica EXATAMENTE como estava — mesma pose, mesmo lugar, mesmo
    // objeto: a montagem do par volta a ser manual.
    expect(figureById(b)).toBe(before)
    expect(figureById(a).pose).toEqual(resolvePosePreset('handshake'))
  })

  it('o par automático continua ligado quando ninguém diz o contrário', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string

    useFiguresStore.getState().applyPosePreset(a, 'handshake', {})

    expect(figureById(b).pose).toEqual(resolvePosePreset('handshake'))
  })

  it('não mexe em ninguém com três bonecos em cena: não há como saber qual é o parceiro', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    const c = useFiguresStore.getState().addFigure() as string
    const beforeB = figureById(b)
    const beforeC = figureById(c)

    useFiguresStore.getState().applyPosePreset(a, 'handshake')

    expect(figureById(a).pose).toEqual(resolvePosePreset('handshake'))
    expect(figureById(b)).toBe(beforeB)
    expect(figureById(c)).toBe(beforeC)
  })

  it('funciona com um boneco só, sem parceiro nenhum', () => {
    const a = useFiguresStore.getState().addFigure() as string

    useFiguresStore.getState().applyPosePreset(a, 'hug')

    expect(useFiguresStore.getState().figures).toHaveLength(1)
    expect(figureById(a).pose).toEqual(resolvePosePreset('hug'))
  })

  it('um Ctrl+Z desfaz o par inteiro: as duas metades são uma edição só', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    const beforeA = figureById(a)
    const beforeB = figureById(b)

    useFiguresStore.getState().applyPosePreset(a, 'clinch')
    useFiguresStore.temporal.getState().undo()

    expect(figureById(a)).toEqual(beforeA)
    expect(figureById(b)).toEqual(beforeB)
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

  /**
   * Espelho completo (pedido do usuário): o que "Inverter lados" não fazia —
   * as juntas SEM par também são refletidas.
   */
  it('mirrorWholeFigure espelha membros E juntas sem par, e é reversível', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -40, z: -70 })
    useFiguresStore.getState().setJointRotation(id, 'head', { y: 25, z: -8 })
    useFiguresStore.getState().setJointRotation(id, 'spine', { y: -14 })
    const before = figureById(id).pose

    useFiguresStore.getState().mirrorWholeFigure(id)

    const pose = figureById(id).pose
    expect(pose['shoulder.L']).toEqual({ x: -40, y: 0, z: 70 })
    // O ombro direito recebe o espelho do que o ESQUERDO tinha — que na pose
    // padrão não é zero (os braços nascem baixos, com z perto de ±90).
    expect(pose['shoulder.R']).toEqual(mirrorRotation(before['shoulder.L']))
    expect(pose.head).toEqual({ x: 0, y: -25, z: 8 })
    expect(pose.spine.y).toBe(14)

    useFiguresStore.getState().mirrorWholeFigure(id)
    expect(figureById(id).pose).toEqual(before)
  })

  /** A colocação é do boneco, não da pose — espelhar não o tira do lugar. */
  it('mirrorWholeFigure não mexe em onde o boneco está nem para onde encara', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1.2, 0, -0.4])
    useFiguresStore.getState().setRootRotation(id, { y: 30 })
    useFiguresStore.getState().setJointRotation(id, 'head', { y: 25 })

    useFiguresStore.getState().mirrorWholeFigure(id)

    const figure = figureById(id)
    expect(figure.position).toEqual([1.2, 0, -0.4])
    expect(figure.rotation).toEqual({ x: 0, y: 30, z: 0 })
  })

  it('mirrorWholeFigure respeita as juntas travadas', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'head', { y: 25 })
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -40 })
    useFiguresStore.getState().toggleJointLock(id, 'head')

    useFiguresStore.getState().mirrorWholeFigure(id)

    const pose = figureById(id).pose
    expect(pose.head.y).toBe(25)
    expect(pose['shoulder.L'].x).toBe(-40)
  })

  it('applyRandomPose sorteia uma pose nova sem tirar o boneco do lugar (DECISOES.md #35)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1.2, 0, -0.4])
    useFiguresStore.getState().setRootRotation(id, { y: 30 })
    const before = figureById(id)

    useFiguresStore.getState().applyRandomPose(id)

    const after = figureById(id)
    expect(after.pose).not.toEqual(before.pose)
    // O sorteio é da POSE: onde o boneco está e para onde encara não mudam.
    expect(after.position).toEqual(before.position)
    expect(after.rotation).toEqual(before.rotation)
  })

  it('applyRandomPose entra no histórico de undo como qualquer edição de pose', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const before = figureById(id).pose

    useFiguresStore.getState().applyRandomPose(id)
    useFiguresStore.temporal.getState().undo()

    expect(figureById(id).pose).toEqual(before)
  })

  it('mirrorSide restrito a uma junta só mexe dela para baixo (DECISOES.md #34)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -40 })
    useFiguresStore.getState().setJointRotation(id, 'hip.R', { x: -35 })

    useFiguresStore.getState().mirrorSide(id, 'R', 'shoulder.R')

    const figure = figureById(id)
    expect(figure.pose['shoulder.L'].x).toBe(-40)
    expect(figure.pose['hip.L'].x).toBe(0)
  })

  it('swapSides restrito a uma junta troca só aquela cadeia', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -80 })
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: -30 })

    useFiguresStore.getState().swapSides(id, 'elbow.L')

    const figure = figureById(id)
    expect(figure.pose['elbow.R'].x).toBe(-80)
    expect(figure.pose['elbow.L'].x).toBe(0)
    expect(figure.pose['hip.L'].x).toBe(-30)
    expect(figure.pose['hip.R'].x).toBe(0)
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
      useFiguresStore.getState().applyRandomPose('figure-inexistente')
    }).not.toThrow()
  })
})

describe('figuresStore — novo workspace (fase 9, item 7)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    setJointLimitOverrides({})
  })

  it('limpa bonecos, catálogo de cenas, bookmarks, nome, contadores e ambiente', () => {
    const store = useFiguresStore.getState()
    const id = store.addFigure('Herói') as string
    store.selectFigure(id)
    store.addCameraBookmark({
      name: 'Vista',
      position: [1, 2, 3],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    store.saveSceneSnapshot('Cena salva')
    store.renameScene('Praia')
    store.setBackground('dark')
    store.consumeSnapshotNumber()

    useFiguresStore.getState().resetWorkspace()

    const after = useFiguresStore.getState()
    expect(after.figures).toEqual([])
    expect(after.scenes).toEqual([])
    expect(after.cameraBookmarks).toEqual([])
    expect(after.activeSceneId).toBeNull()
    expect(after.selectedFigureId).toBeNull()
    expect(after.selectedJointName).toBeNull()
    expect(after.sceneName).toBe('Cena 1')
    expect(after.nextFigureSeq).toBe(1)
    expect(after.nextCameraBookmarkSeq).toBe(1)
    expect(after.nextSceneSnapshotSeq).toBe(1)
    expect(after.nextSnapshotNumber).toBe(1)
    expect(after.environment).toEqual({ background: 'medium', grid: true })
    expect(after.jointLimits).toEqual({})
  })

  it('restaura os limites articulares padrão do skeleton.ts', () => {
    useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(getJoint('knee.L').limits.x?.max).toBe(45)

    useFiguresStore.getState().resetWorkspace()

    expect(getJoint('knee.L').limits.x?.max).not.toBe(45)
    expect(useFiguresStore.getState().jointLimits).toEqual({})
  })

  it('zera o histórico de undo — limpar o workspace não é desfazível', () => {
    useFiguresStore.getState().addFigure('Herói')
    expect(useFiguresStore.temporal.getState().pastStates.length).toBeGreaterThan(0)

    useFiguresStore.getState().resetWorkspace()

    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useFiguresStore.temporal.getState().futureStates).toHaveLength(0)
    expect(useFiguresStore.getState().figures).toEqual([])
  })
})

describe('figuresStore — resetar uma junta (fase 9, item 6)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    setJointLimitOverrides({})
  })

  it('devolve a junta ao valor da pose "Em pé", sem tocar nas outras', () => {
    const store = useFiguresStore.getState()
    const id = store.addFigure() as string
    store.setJointRotation(id, 'elbow.L', { x: -120 })
    store.setJointRotation(id, 'knee.L', { x: 60 })

    useFiguresStore.getState().resetJointRotation(id, 'elbow.L')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    const standing = resolvePosePreset('standing')
    // "Em pé" é a referência do reset, não zero cru: `elbow.*.y` tem torção
    // neutra não-nula (ver DECISOES.md #25).
    expect(figure?.pose['elbow.L']).toEqual(standing['elbow.L'])
    expect(figure?.pose['knee.L']?.x).toBe(60)
  })

  it('zera uma junta que não aparece na pose "Em pé"', () => {
    const store = useFiguresStore.getState()
    const id = store.addFigure() as string
    store.setJointRotation(id, 'fingersBase.L', { x: 45 })

    useFiguresStore.getState().resetJointRotation(id, 'fingersBase.L')

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.pose['fingersBase.L']).toEqual(resolvePosePreset('standing')['fingersBase.L'] ?? { x: 0, y: 0, z: 0 })
  })

  it('resetar o root zera a rotação de colocação sem mexer na posição', () => {
    const store = useFiguresStore.getState()
    const id = store.addFigure() as string
    store.setPosition(id, [1, 0.5, 2])
    store.setRootRotation(id, { x: 20, y: 45, z: -10 })

    useFiguresStore.getState().resetJointRotation(id, ROOT_JOINT_NAME)

    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.rotation).toEqual({ x: 0, y: 0, z: 0 })
    expect(figure?.position).toEqual([1, 0.5, 2])
  })
})

describe('figuresStore — salvar a cena ativa (Ctrl+S)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('cria um snapshot com o nome atual da cena quando ainda não há cena ativa', () => {
    useFiguresStore.getState().renameScene('Praia')
    useFiguresStore.getState().addFigure('Herói')

    const id = useFiguresStore.getState().saveOrUpdateActiveScene()

    const state = useFiguresStore.getState()
    expect(state.scenes).toHaveLength(1)
    expect(state.scenes[0].name).toBe('Praia')
    expect(state.activeSceneId).toBe(id)
  })

  it('ATUALIZA a cena ativa em vez de empilhar duplicatas a cada toque', () => {
    useFiguresStore.getState().renameScene('Praia')
    const id = useFiguresStore.getState().saveOrUpdateActiveScene()

    useFiguresStore.getState().addFigure('Herói')
    const again = useFiguresStore.getState().saveOrUpdateActiveScene()

    const state = useFiguresStore.getState()
    expect(again).toBe(id)
    expect(state.scenes).toHaveLength(1)
    expect(state.scenes[0].data.figures).toHaveLength(1)
  })

  it('leva o nome novo da cena para o snapshot ao regravar', () => {
    useFiguresStore.getState().saveOrUpdateActiveScene()
    useFiguresStore.getState().renameScene('Outro nome')
    useFiguresStore.getState().saveOrUpdateActiveScene()

    expect(useFiguresStore.getState().scenes[0].name).toBe('Outro nome')
  })

  it('cria um snapshot novo se a cena ativa tiver sido removida do catálogo', () => {
    const id = useFiguresStore.getState().saveOrUpdateActiveScene()
    useFiguresStore.getState().removeSceneSnapshot(id)

    const novo = useFiguresStore.getState().saveOrUpdateActiveScene()

    expect(novo).not.toBe(id)
    expect(useFiguresStore.getState().scenes).toHaveLength(1)
  })

  it('entra no histórico de undo como qualquer edição de conteúdo', () => {
    useFiguresStore.getState().saveOrUpdateActiveScene()
    expect(useFiguresStore.getState().scenes).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().scenes).toHaveLength(0)
  })
})

/**
 * Biblioteca de poses do usuário (DECISOES.md #42, PLANO.md > A.1). O que o
 * store garante: a pose salva volta inteira (juntas E assentamento), a
 * biblioteca é do WORKSPACE — atravessa a troca de cena — e salvar/remover é
 * conteúdo, com undo como o catálogo de cenas.
 */
describe('figuresStore — biblioteca de poses do usuário', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  it('salva a pose do boneco com nome e devolve o id', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'running')

    const poseId = useFiguresStore.getState().saveFigurePose(id, 'Corrida')

    const library = useFiguresStore.getState().poseLibrary
    expect(library).toHaveLength(1)
    expect(library[0].id).toBe(poseId)
    expect(library[0].name).toBe('Corrida')
    expect(library[0].pose['hip.L']).toEqual(figureById(id).pose['hip.L'])
  })

  it('cai num nome automático quando nenhum é informado', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, '   ')

    expect(useFiguresStore.getState().poseLibrary[0].name).toBe('Pose 1')
  })

  it('não salva nada para um boneco inexistente', () => {
    expect(useFiguresStore.getState().saveFigurePose('figure-inexistente')).toBeNull()
    expect(useFiguresStore.getState().poseLibrary).toEqual([])
  })

  it('aplica a pose salva em OUTRO boneco, preservando onde ele está e para onde encara', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'running')
    useFiguresStore.getState().setPosition(b, [3, 0, -4])
    useFiguresStore.getState().setRootRotation(b, { y: 45 })

    const poseId = useFiguresStore.getState().saveFigurePose(a, 'Corrida') as string
    useFiguresStore.getState().applySavedPose(b, poseId)

    expect(figureById(b).pose).toEqual(figureById(a).pose)
    expect(figureById(b).position[0]).toBe(3)
    expect(figureById(b).position[2]).toBe(-4)
    expect(figureById(b).rotation).toEqual({ x: 0, y: 45, z: 0 })
  })

  /** O ganho da decisão "pose + assentamento": deitado volta deitado. */
  it('devolve a inclinação e a altura do quadril de uma pose deitada', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'lyingSpreadSupine')

    const poseId = useFiguresStore.getState().saveFigurePose(a, 'Deitado') as string
    useFiguresStore.getState().applySavedPose(b, poseId)

    expect(figureById(b).rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(figureById(b).position[1]).toBeCloseTo(figureById(a).position[1], 6)
  })

  it('escala o assentamento pela altura de quem recebe a pose', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setHeight(b, 1.5)
    useFiguresStore.getState().applyPosePreset(a, 'sitting')

    const poseId = useFiguresStore.getState().saveFigurePose(a, 'Sentado') as string
    useFiguresStore.getState().applySavedPose(b, poseId)

    expect(figureById(b).position[1]).toBeCloseTo((0.485 - 0.9) * (1.5 / 1.7), 5)
  })

  it('ignora uma pose que não está na biblioteca', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const before = figureById(id)

    useFiguresStore.getState().applySavedPose(id, 'pose-inexistente')

    expect(figureById(id)).toBe(before)
  })

  it('renomeia e remove poses da biblioteca', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const poseId = useFiguresStore.getState().saveFigurePose(id, 'Rascunho') as string

    useFiguresStore.getState().renameSavedPose(poseId, ' Guarda alta ')
    expect(useFiguresStore.getState().poseLibrary[0].name).toBe('Guarda alta')

    // Nome vazio não apaga o que já estava lá.
    useFiguresStore.getState().renameSavedPose(poseId, '   ')
    expect(useFiguresStore.getState().poseLibrary[0].name).toBe('Guarda alta')

    useFiguresStore.getState().removeSavedPose(poseId)
    expect(useFiguresStore.getState().poseLibrary).toEqual([])
  })

  /** É o que faz dela uma BIBLIOTECA, e não uma propriedade da cena. */
  it('sobrevive a trocar de cena — a biblioteca é do workspace', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Guarda')
    useFiguresStore.getState().saveSceneSnapshot('Cena A')

    useFiguresStore.getState().addFigure()
    const sceneId = useFiguresStore.getState().scenes[0].id
    useFiguresStore.getState().loadSceneSnapshot(sceneId)

    expect(useFiguresStore.getState().poseLibrary).toHaveLength(1)
  })

  it('salvar uma pose é conteúdo: entra no histórico de undo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Guarda')
    expect(useFiguresStore.getState().poseLibrary).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().poseLibrary).toEqual([])
  })

  it('loadPoseLibrary substitui a biblioteca e continua a sequência acima dos ids lidos', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().loadPoseLibrary([
      {
        id: 'pose-7',
        name: 'Da pasta',
        pose: { 'shoulder.L': { x: 0, y: 90, z: 40 } },
        rotation: { x: 0, y: 0, z: 0 },
        groundOffsetM: 0,
        preservesHeading: true,
      },
    ])

    expect(useFiguresStore.getState().poseLibrary.map((pose) => pose.name)).toEqual(['Da pasta'])
    // Sem isto, a próxima pose salva nasceria com um id já usado pelo arquivo.
    expect(useFiguresStore.getState().saveFigurePose(id, 'Nova')).toBe('pose-8')
  })

  it('novo workspace limpa a biblioteca junto com o resto', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Guarda')

    useFiguresStore.getState().resetWorkspace()

    expect(useFiguresStore.getState().poseLibrary).toEqual([])
    expect(useFiguresStore.getState().nextPoseSeq).toBe(1)
  })
})

/**
 * Travamento de juntas (DECISOES.md #42, PLANO.md > A.5). A regra escolhida
 * pelo usuário é UMA só: junta travada não muda por nada automático. Estes
 * testes percorrem justamente cada caminho que escreve pose — é a lista de
 * lugares onde a regra poderia vazar.
 */
describe('figuresStore — travamento de juntas', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  function figuraComCotoveloTravado() {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -40 })
    useFiguresStore.getState().toggleJointLock(id, 'elbow.L')
    return id
  }

  it('trava e destrava, por boneco', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string

    useFiguresStore.getState().toggleJointLock(a, 'elbow.L')

    expect(useFiguresStore.getState().jointLocks[a]).toEqual(['elbow.L'])
    expect(useFiguresStore.getState().jointLocks[b]).toBeUndefined()

    useFiguresStore.getState().toggleJointLock(a, 'elbow.L')
    expect(useFiguresStore.getState().jointLocks[a]).toBeUndefined()
  })

  it('a raiz não pode ser travada: ela é colocação do boneco, não pose', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, 'root')
    expect(useFiguresStore.getState().jointLocks).toEqual({})
  })

  it('bloqueia a edição direta da junta (slider, gizmo, teclado) e o reset dela', () => {
    const id = figuraComCotoveloTravado()

    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: 0 })
    expect(figureById(id).pose['elbow.L'].x).toBe(-40)

    useFiguresStore.getState().resetJointRotation(id, 'elbow.L')
    expect(figureById(id).pose['elbow.L'].x).toBe(-40)

    // E não atrapalha as outras juntas.
    useFiguresStore.getState().setJointRotation(id, 'elbow.R', { x: -30 })
    expect(figureById(id).pose['elbow.R'].x).toBe(-30)
  })

  it('preserva a junta travada ao aplicar uma pose predefinida', () => {
    const id = figuraComCotoveloTravado()

    useFiguresStore.getState().applyPosePreset(id, 'running')

    expect(figureById(id).pose['elbow.L'].x).toBe(-40)
    // O resto da pose entra normalmente.
    expect(figureById(id).pose['hip.L'].x).not.toBe(0)
  })

  it('preserva a junta travada ao aplicar uma pose da biblioteca', () => {
    const id = figuraComCotoveloTravado()
    const outro = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(outro, 'running')
    const poseId = useFiguresStore.getState().saveFigurePose(outro, 'Corrida') as string

    useFiguresStore.getState().applySavedPose(id, poseId)

    expect(figureById(id).pose['elbow.L'].x).toBe(-40)
    expect(figureById(id).pose['hip.L']).toEqual(figureById(outro).pose['hip.L'])
  })

  it('preserva a junta travada no sorteio, no espelho, na inversão e na pose de mão', () => {
    const id = figuraComCotoveloTravado()
    useFiguresStore.getState().toggleJointLock(id, 'fingersBase.L')
    const dedosAntes = figureById(id).pose['fingersBase.L']

    useFiguresStore.getState().applyRandomPose(id)
    expect(figureById(id).pose['elbow.L'].x).toBe(-40)

    useFiguresStore.getState().setJointRotation(id, 'elbow.R', { x: -70 })
    useFiguresStore.getState().mirrorSide(id, 'R', null)
    expect(figureById(id).pose['elbow.L'].x).toBe(-40)

    useFiguresStore.getState().swapSides(id, null)
    expect(figureById(id).pose['elbow.L'].x).toBe(-40)

    useFiguresStore.getState().applyHandPreset(id, 'L', 'fist')
    expect(figureById(id).pose['fingersBase.L']).toEqual(dedosAntes)
    // A outra mão fecha normalmente.
    useFiguresStore.getState().applyHandPreset(id, 'R', 'fist')
    expect(figureById(id).pose['fingersBase.R'].x).toBeGreaterThan(60)
  })

  it('preserva a junta travada ao aplicar uma pose importada de arquivo', () => {
    const id = figuraComCotoveloTravado()

    useFiguresStore.getState().applyImportedPose(id, {
      height: 1.8,
      pose: { ...resolvePosePreset('running'), 'elbow.L': { x: 0, y: 90, z: 0 } },
    })

    expect(figureById(id).pose['elbow.L'].x).toBe(-40)
    expect(figureById(id).height).toBe(1.8)
  })

  it('protege o PARCEIRO numa pose em dupla, e não só quem recebe a pose', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(b, 'elbow.L', { x: -40 })
    useFiguresStore.getState().toggleJointLock(b, 'elbow.L')

    useFiguresStore.getState().applyPosePreset(a, 'handshake')

    expect(figureById(b).pose['elbow.L'].x).toBe(-40)
    // O par continua sendo montado: o parceiro é posado e posicionado.
    expect(figureById(b).position[2]).toBeCloseTo(0.755, 3)
  })

  it('destrava tudo de um boneco de uma vez', () => {
    const id = figuraComCotoveloTravado()
    useFiguresStore.getState().toggleJointLock(id, 'knee.R')

    useFiguresStore.getState().clearJointLocks(id)

    expect(useFiguresStore.getState().jointLocks[id]).toBeUndefined()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: 0 })
    expect(figureById(id).pose['elbow.L'].x).toBe(0)
  })

  it('remover o boneco leva as travas dele junto', () => {
    const id = figuraComCotoveloTravado()
    useFiguresStore.getState().removeFigure(id)
    expect(useFiguresStore.getState().jointLocks).toEqual({})
  })

  it('duplicar o boneco leva as travas junto — a cópia tem a mesma pose a proteger', () => {
    const id = figuraComCotoveloTravado()
    const copia = useFiguresStore.getState().duplicateFigure(id) as string

    expect(useFiguresStore.getState().jointLocks[copia]).toEqual(['elbow.L'])
    useFiguresStore.getState().setJointRotation(copia, 'elbow.L', { x: 0 })
    expect(figureById(copia).pose['elbow.L'].x).toBe(-40)
  })

  it('carregar uma cena descarta travas de bonecos que não estão nela', () => {
    const id = figuraComCotoveloTravado()
    useFiguresStore.getState().saveSceneSnapshot('Com boneco')
    const sceneId = useFiguresStore.getState().scenes[0].id
    useFiguresStore.getState().removeFigure(id)
    useFiguresStore.getState().toggleJointLock(useFiguresStore.getState().addFigure() as string, 'knee.L')

    useFiguresStore.getState().loadSceneSnapshot(sceneId)

    // O boneco da cena carregada tem o mesmo id do que estava em tela: sem a
    // poda, a trava do outro boneco recairia sobre ele.
    expect(Object.keys(useFiguresStore.getState().jointLocks)).toEqual([])
  })

  /** Travar é modo de trabalho, não edição: desfazer não pode reabrir a proteção. */
  it('não entra no histórico de undo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -40 })
    const antes = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().toggleJointLock(id, 'elbow.L')

    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(antes)
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['elbow.L'])
  })

  it('novo workspace limpa as travas', () => {
    figuraComCotoveloTravado()
    useFiguresStore.getState().resetWorkspace()
    expect(useFiguresStore.getState().jointLocks).toEqual({})
  })
})

describe('figuresStore — abrir workspace traz a biblioteca de poses da pasta', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const daPasta = [
    {
      id: 'pose-5',
      name: 'Da pasta',
      pose: { 'shoulder.L': { x: 0, y: 90, z: 40 } },
      rotation: { x: 0, y: 0, z: 0 },
      groundOffsetM: 0,
      preservesHeading: true,
    },
  ]

  it('substitui a biblioteca em memória pela do workspace aberto', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Antiga')

    useFiguresStore.getState().loadWorkspaceCatalog([], null, {}, daPasta)

    expect(useFiguresStore.getState().poseLibrary.map((pose) => pose.name)).toEqual(['Da pasta'])
    expect(useFiguresStore.getState().nextPoseSeq).toBe(6)
  })

  /** Abrir um workspace é UMA edição: um Ctrl+Z não pode deixar a biblioteca nova com o catálogo velho. */
  it('traz biblioteca e catálogo na mesma entrada de histórico', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Antiga')
    const antes = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().loadWorkspaceCatalog(
      [{ id: 'scene-1', name: 'Cena da pasta', data: useFiguresStore.getState().scenes[0]?.data ?? {
        figures: [],
        nextFigureSeq: 1,
        props: [],
        nextPropSeq: 1,
        environment: { background: 'medium', grid: true },
        cameraBookmarks: [],
        nextCameraBookmarkSeq: 1,
        nextSnapshotNumber: 1,
        sceneCamera: DEFAULT_SCENE_CAMERA,
      } }],
      'scene-1',
      {},
      daPasta,
    )

    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(antes + 1)
  })

  it('sem arquivo de poses, mantém a biblioteca que já estava em memória', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().saveFigurePose(id, 'Antiga')

    useFiguresStore.getState().loadWorkspaceCatalog([], null, {})

    expect(useFiguresStore.getState().poseLibrary.map((pose) => pose.name)).toEqual(['Antiga'])
  })
})

/**
 * Mistura entre duas poses (DECISOES.md #43, PLANO.md > A.6). A geometria da
 * interpolação está travada em `poseBlend.test.ts`; aqui trava-se o que o
 * store garante: 100% é idêntico a aplicar a pose, 0% devolve exatamente a
 * pose de partida, e a mistura respeita junta travada como toda escrita.
 */
describe('figuresStore — mistura entre duas poses', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  function pontas(id: string, key: Parameters<typeof resolvePosePreset>[0]) {
    const figure = figureById(id)
    return {
      base: figureBlendState(figure),
      target: resolveBlendTarget(figure, { pose: resolvePosePreset(key), ...resolvePosePresetPlacement(key) }),
    }
  }

  it('em 100% chega exatamente ao mesmo resultado de aplicar a pose', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(a, { y: 40 })
    useFiguresStore.getState().setRootRotation(b, { y: 40 })

    const { base, target } = pontas(a, 'sitting')
    useFiguresStore.getState().blendPose(a, base, target, 1)
    useFiguresStore.getState().applyPosePreset(b, 'sitting')

    expect(figureById(a).pose).toEqual(figureById(b).pose)
    expect(figureById(a).rotation).toEqual(figureById(b).rotation)
    expect(figureById(a).position[1]).toBeCloseTo(figureById(b).position[1], 6)
  })

  it('vale também para uma pose deitada, que impõe a inclinação e a altura', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string

    const { base, target } = pontas(a, 'lyingSpreadSupine')
    useFiguresStore.getState().blendPose(a, base, target, 1)
    useFiguresStore.getState().applyPosePreset(b, 'lyingSpreadSupine')

    expect(figureById(a).rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(figureById(a).position[1]).toBeCloseTo(figureById(b).position[1], 6)
  })

  it('em 0% devolve a pose de partida, mesmo depois de passear pelo slider', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const antes = figureById(id)
    const { base, target } = pontas(id, 'fetal')

    for (const t of [0.3, 0.7, 1, 0.5, 0]) {
      useFiguresStore.getState().blendPose(id, base, target, t)
    }

    expect(figureById(id).pose).toEqual(antes.pose)
    expect(figureById(id).rotation).toEqual(antes.rotation)
    expect(figureById(id).position).toEqual(antes.position)
  })

  it('no meio do caminho a pose fica entre as duas, sem sair dos limites', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const { base, target } = pontas(id, 'running')

    useFiguresStore.getState().blendPose(id, base, target, 0.5)

    const meio = figureById(id).pose['hip.L'].x
    const extremos = [base.pose['hip.L'].x, target.pose['hip.L'].x].sort((x, y) => x - y)
    expect(meio).toBeGreaterThan(extremos[0])
    expect(meio).toBeLessThan(extremos[1])
    for (const [jointName, rotation] of Object.entries(figureById(id).pose)) {
      expect(clampJointRotation(jointName, rotation)).toEqual(rotation)
    }
  })

  it('preserva onde o boneco está no chão', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [3, 0, -4])
    const { base, target } = pontas(id, 'sitting')

    useFiguresStore.getState().blendPose(id, base, target, 0.5)

    expect(figureById(id).position[0]).toBe(3)
    expect(figureById(id).position[2]).toBe(-4)
  })

  it('respeita junta travada, como toda escrita de pose', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -40 })
    useFiguresStore.getState().toggleJointLock(id, 'elbow.L')
    const { base, target } = pontas(id, 'running')

    useFiguresStore.getState().blendPose(id, base, target, 0.5)

    expect(figureById(id).pose['elbow.L'].x).toBe(-40)
    expect(figureById(id).pose['hip.L'].x).not.toBe(base.pose['hip.L'].x)
  })

  it('é uma edição normal: entra no histórico de undo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const antes = figureById(id).pose
    const { base, target } = pontas(id, 'running')

    useFiguresStore.getState().blendPose(id, base, target, 0.4)
    expect(figureById(id).pose).not.toEqual(antes)

    useFiguresStore.temporal.getState().undo()
    expect(figureById(id).pose).toEqual(antes)
  })

  it('não faz nada para um boneco inexistente', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const { base, target } = pontas(id, 'running')
    expect(() => useFiguresStore.getState().blendPose('figure-inexistente', base, target, 0.5)).not.toThrow()
    expect(figureById(id).pose).toEqual(base.pose)
  })
})

/**
 * Copiar a pose de um boneco para outro. Segue exatamente a regra da biblioteca
 * de poses (DECISOES.md #42): vai o ASSENTAMENTO junto — juntas, inclinação do
 * corpo e altura do quadril —, e NÃO vai o que é identidade e encenação de cada
 * boneco: onde ele está no chão, a altura, a cor e o nome.
 */
describe('figuresStore — copiar pose entre bonecos', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

  it('copia as juntas de um boneco para o outro', () => {
    const origem = useFiguresStore.getState().addFigure('Herói') as string
    const destino = useFiguresStore.getState().addFigure('Coadjuvante') as string
    useFiguresStore.getState().applyPosePreset(origem, 'running', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    expect(figureById(destino).pose).toEqual(figureById(origem).pose)
  })

  it('não leva lugar no chão, altura, cor nem nome — isso é de cada boneco', () => {
    const origem = useFiguresStore.getState().addFigure('Herói') as string
    const destino = useFiguresStore.getState().addFigure('Coadjuvante') as string
    useFiguresStore.getState().setPosition(destino, [3, 0, -4])
    useFiguresStore.getState().setHeight(destino, 1.5)
    useFiguresStore.getState().setColor(destino, '#2255cc')
    useFiguresStore.getState().applyPosePreset(origem, 'sitting', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    const alvo = figureById(destino)
    expect(alvo.name).toBe('Coadjuvante')
    expect(alvo.color).toBe('#2255cc')
    expect(alvo.height).toBe(1.5)
    expect(alvo.position[0]).toBe(3)
    expect(alvo.position[2]).toBe(-4)
  })

  it('leva o assentamento: copiar uma pose deitada deita o outro também', () => {
    const origem = useFiguresStore.getState().addFigure() as string
    const destino = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(origem, 'lyingHandsBehindHead', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    // Sem o assentamento, o boneco voltaria em pé e atravessando o chão.
    expect(figureById(destino).rotation.x).toBeCloseTo(figureById(origem).rotation.x, 6)
    expect(figureById(destino).position[1]).toBeCloseTo(figureById(origem).position[1], 6)
  })

  it('a altura do quadril acompanha a escala de quem recebe', () => {
    const origem = useFiguresStore.getState().addFigure() as string
    const destino = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setHeight(destino, 1.5)
    useFiguresStore.getState().applyPosePreset(origem, 'lyingHandsBehindHead', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    // A mesma pose num boneco menor assenta mais baixo, na proporção da altura.
    const razao = figureById(destino).position[1] / figureById(origem).position[1]
    expect(razao).toBeCloseTo(1.5 / 1.7, 4)
  })

  it('boneco em pé preserva o giro de encenação de quem recebe', () => {
    const origem = useFiguresStore.getState().addFigure() as string
    const destino = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(destino, { y: 40 })
    useFiguresStore.getState().applyPosePreset(origem, 'running', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    // Em pé, o giro em Y é para onde o boneco encara na cena — não faz parte da pose.
    expect(figureById(destino).rotation.y).toBe(40)
  })

  it('junta travada no destino não muda — a regra do #42 vale aqui também', () => {
    const origem = useFiguresStore.getState().addFigure() as string
    const destino = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(destino, 'elbow.R', { z: 0 })
    useFiguresStore.getState().toggleJointLock(destino, 'elbow.R')
    const travada = { ...figureById(destino).pose['elbow.R'] }
    useFiguresStore.getState().applyPosePreset(origem, 'running', { pairPartner: false })

    useFiguresStore.getState().copyFigurePose(origem, destino)

    expect(figureById(destino).pose['elbow.R']).toEqual(travada)
    expect(figureById(destino).pose['knee.R']).toEqual(figureById(origem).pose['knee.R'])
  })

  it('copiar para si mesmo, ou de/para boneco inexistente, não faz nada', () => {
    const origem = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(origem, 'running', { pairPartner: false })
    const antes = figureById(origem)

    useFiguresStore.getState().copyFigurePose(origem, origem)
    useFiguresStore.getState().copyFigurePose(origem, 'nao-existe')
    useFiguresStore.getState().copyFigurePose('nao-existe', origem)

    expect(figureById(origem)).toBe(antes)
  })
})
