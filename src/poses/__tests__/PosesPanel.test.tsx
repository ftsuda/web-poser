import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { findWorkingAnimation } from '../../animation/animation'
import { WORKSPACE_AUTOSAVE_KEY, saveWorkspaceToLocalStorage } from '../../persistence/autosave'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore } from '../../store/figuresStore'
import { usePosesShellStore } from '../../store/posesShellStore'
import { useSceneStashStore } from '../../store/sceneStashStore'

vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'
import { PosesPanel } from '../PosesPanel'

async function renderPanel() {
  const utils = render(<PosesPanel />)
  await act(async () => {})
  return utils
}

function addFigureAndSelect(): string {
  const id = useFiguresStore.getState().addFigure()!
  useFiguresStore.getState().selectFigure(id)
  return id
}

function captureKeyframe(): string {
  return useFiguresStore.getState().addAnimationKeyframe(null, {
    position: [...DEFAULT_SCENE_CAMERA.position],
    target: [...DEFAULT_SCENE_CAMERA.target],
    up: [...DEFAULT_SCENE_CAMERA.up],
    focalMm: DEFAULT_SCENE_CAMERA.focalMm,
  })!
}

beforeEach(() => {
  vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  useFiguresStore.setState(useFiguresStore.getInitialState())
  useFiguresStore.temporal.getState().clear()
  usePosesShellStore.setState(usePosesShellStore.getInitialState())
  useAnimationStore.setState(useAnimationStore.getInitialState())
  useSceneStashStore.setState(useSceneStashStore.getInitialState())
})

describe('PosesPanel — abas', () => {
  it('nasce na aba Boneco (a primeira da ordem) e troca pelas abas', async () => {
    const user = userEvent.setup()
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Boneco' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Nenhum boneco na cena ainda.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Junta' }))
    expect(usePosesShellStore.getState().activeTab).toBe('joint')
  })
})

describe('aba Bonecos', () => {
  it('adiciona, escolhe explicitamente o boneco e ajusta a altura', async () => {
    const user = userEvent.setup()
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Adicionar boneco' }))
    expect(useFiguresStore.getState().figures).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Boneco 1/ }))
    const id = useFiguresStore.getState().figures[0].id
    expect(useFiguresStore.getState().selectedFigureId).toBe(id)

    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.85' } })
    expect(useFiguresStore.getState().figures[0].height).toBeCloseTo(1.85, 6)
  })

  it('aplica uma pose de partida ao boneco em edição (item 52)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Pose de partida' }), 'Sentado')
    await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))

    const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === id)!
    expect(figure.pose['hip.L'].x).toBeLessThan(0)
    expect(figure.pose['knee.L'].x).toBeGreaterThan(0)
  })

  it('sem boneco em edição, o bloco de pose de partida não aparece (item 52)', async () => {
    useFiguresStore.getState().addFigure()
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    expect(screen.queryByRole('combobox', { name: 'Pose de partida' })).not.toBeInTheDocument()
  })

  /**
   * "Apoiar no chão" existia só no desktop (item 33): depois de dobrar um
   * joelho o boneco flutua ou afunda, e no celular acertar isso à mão é pior
   * ainda. Mexe só na ALTURA — X/Z são encenação.
   */
  it('apoia o boneco no chão sem tirá-lo do lugar', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setPosition(id, [1, 0.8, -2])
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Apoiar no chão' }))

    const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === id)!
    expect(figure.position[1]).toBeCloseTo(0, 3)
    expect(figure.position[0]).toBe(1)
    expect(figure.position[2]).toBe(-2)
  })

  it('com a colocação ancorada, apoiar aparece desabilitado (item 62)', async () => {
    const id = addFigureAndSelect()
    useFiguresStore.getState().toggleJointPin(id, 'wrist.L')
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Apoiar no chão' })).toBeDisabled()
  })

  it('sem boneco em edição, o botão de apoiar não aparece', async () => {
    useFiguresStore.getState().addFigure()
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    expect(screen.queryByRole('button', { name: 'Apoiar no chão' })).not.toBeInTheDocument()
  })

  it('alterna "mostrar só o boneco em edição" (filtro de tela, não o visible do boneco)', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('figures')
    await renderPanel()

    await user.click(screen.getByLabelText('Mostrar só o boneco em edição'))
    expect(usePosesShellStore.getState().showOnlyEditing).toBe(true)
    // O visible do boneco (conteúdo, vai no keyframe) fica intacto.
    expect(useFiguresStore.getState().figures[0].visible).toBe(true)
  })
})

describe('aba Junta', () => {
  it('sem boneco selecionado, orienta a escolher um', async () => {
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()
    expect(screen.getByText('Escolha um boneco na aba Boneco.')).toBeInTheDocument()
  })

  it('o combo de juntas é o mesmo do desktop: raiz + grupos em optgroup, ligado ao selectJoint', async () => {
    addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    const select = screen.getByLabelText('Selecionar junta')
    expect(screen.getByRole('group', { name: 'Tronco' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Raiz (posição/rotação)' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'shoulder.L' } })
    expect(useFiguresStore.getState().selectedJointName).toBe('shoulder.L')
  })

  it('as setas empurram a junta no plano da vista ativa (o arrasto em passos)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('wrist.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    const before = JSON.stringify(useFiguresStore.getState().figures[0].pose)
    await user.click(screen.getByRole('button', { name: '▲' }))
    const after = JSON.stringify(useFiguresStore.getState().figures[0].pose)
    expect(after).not.toBe(before)
    // A vista de frente trava Z: a colocação do boneco não se move.
    expect(useFiguresStore.getState().figures[0].position).toEqual([0, 0, 0])
    expect(useFiguresStore.getState().selectedFigureId).toBe(id)
  })

  it('com a raiz selecionada, as setas transladam a colocação — e a vista de cima anda no chão', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('joint')
    usePosesShellStore.getState().setViewKey('top')
    await renderPanel()

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    await user.click(screen.getByRole('button', { name: '▲' }))

    const position = useFiguresStore.getState().figures[0].position
    expect(position[0]).toBeCloseTo(0, 6)
    expect(position[1]).toBeCloseTo(0, 6)
    expect(position[2]).toBeCloseTo(-0.02, 6)
  })

  it('na vista livre as setas do painel não existem: travada mostra o aviso do cadeado, destravada aponta o gizmo', async () => {
    addFigureAndSelect()
    useFiguresStore.getState().selectJoint('wrist.L')
    usePosesShellStore.getState().setActiveTab('joint')
    usePosesShellStore.getState().setViewKey('free')
    await renderPanel()

    expect(screen.getByText(/edição travada — destrave no cadeado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▲' })).not.toBeInTheDocument()

    act(() => usePosesShellStore.getState().toggleFreeEdit())
    expect(screen.getByText(/arraste a junta \(no plano da tela\) ou use as setas do gizmo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▲' })).not.toBeInTheDocument()
  })

  it('trava e destrava a junta selecionada; na raiz o botão geral dá lugar aos cadeados por eixo (item 64)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('wrist.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Travar junta' }))
    expect(useFiguresStore.getState().jointLocks[id]).toContain('wrist.L')
    await user.click(screen.getByRole('button', { name: 'Destravar junta' }))
    expect(useFiguresStore.getState().jointLocks[id] ?? []).not.toContain('wrist.L')

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    expect(screen.queryByRole('button', { name: 'Travar junta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Travar eixo Y' })).toBeInTheDocument()
  })

  it('ancora e solta a junta selecionada (item 62); a raiz não ancora', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('elbow.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Fixar posição' }))
    expect(useFiguresStore.getState().jointPins[id]).toEqual(['elbow.L'])
    expect(screen.getByText(/Âncora ativa: posição fixa/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Soltar âncora' }))
    expect(useFiguresStore.getState().jointPins[id]).toBeUndefined()

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    expect(screen.getByRole('button', { name: 'Fixar posição' })).toBeDisabled()
  })

  it('junta congelada pela âncora: sliders, ajuste fino e ⟲ desabilitam, com o porquê', async () => {
    const id = addFigureAndSelect()
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    useFiguresStore.getState().selectJoint('shoulder.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    expect(screen.getByText(/Congelada por uma âncora abaixo/)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Rotação X:/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rotação X +5°' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rotação X: voltar ao valor inicial' })).toBeDisabled()
  })

  it('com âncora no boneco, a raiz desabilita: sliders, ⟲ e setas — a colocação está congelada', async () => {
    const id = addFigureAndSelect()
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    useFiguresStore.getState().selectJoint('root')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    expect(screen.getByText(/Colocação congelada por âncora/)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Rotação Y:/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rotação Y: voltar ao valor inicial' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '▲' })).toBeDisabled()
  })

  it('a raiz gira nos três eixos por sliders livres (colocação, sem limite articular)', async () => {
    addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    expect(screen.getAllByRole('slider')).toHaveLength(3)

    fireEvent.change(screen.getByRole('slider', { name: /Rotação Y:/ }), { target: { value: '90' } })
    expect(useFiguresStore.getState().figures[0].rotation.y).toBe(90)
    fireEvent.change(screen.getByRole('slider', { name: /Rotação Z:/ }), { target: { value: '-30' } })
    expect(useFiguresStore.getState().figures[0].rotation.z).toBe(-30)
    // A pose das juntas fica intacta: girar a raiz é colocação, não pose.
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].y).toBeDefined()
  })

  it('na raiz cada eixo tem o próprio cadeado (item 64): trava o token e desabilita slider, fino e ⟲', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('root')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Travar eixo Y' }))

    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['root.y'])
    expect(screen.getByRole('button', { name: 'Destravar eixo Y' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: /Rotação Y:/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rotação Y +5°' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rotação Y: voltar ao valor inicial' })).toBeDisabled()
    // Os outros eixos continuam livres.
    expect(screen.getByRole('slider', { name: /Rotação X:/ })).toBeEnabled()
  })

  it('a raiz não mostra mais o botão geral de travar — os cadeados são por eixo (item 64)', async () => {
    addFigureAndSelect()
    useFiguresStore.getState().selectJoint('root')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    expect(screen.queryByRole('button', { name: 'Travar junta' })).not.toBeInTheDocument()
    // "Destravar todas" continua à mão — solta também os cadeados de eixo.
    expect(screen.getByRole('button', { name: 'Destravar todas' })).toBeInTheDocument()
  })

  it('os botões de ajuste fino somam ao slider, grampeados pelos limites (item 51)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('elbow.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    const before = useFiguresStore.getState().figures[0].pose['elbow.L'].y
    await user.click(screen.getByRole('button', { name: 'Rotação Y +5°' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].y).toBe(before + 5)
    await user.click(screen.getByRole('button', { name: 'Rotação Y -1°' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].y).toBe(before + 4)

    // Na raiz, os botões por eixo giram a colocação.
    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    await user.click(screen.getByRole('button', { name: 'Rotação Y +5°' }))
    expect(useFiguresStore.getState().figures[0].rotation.y).toBe(5)
    expect(useFiguresStore.getState().figures[0].id).toBe(id)
  })

  it('cada DOF da junta vira um slider por eixo — a torção era só o Y, o joelho só tem X (item 60)', async () => {
    const id = addFigureAndSelect()
    useFiguresStore.getState().selectJoint('elbow.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    // O cotovelo tem DOF em X (flexão) e Y (a antiga torção).
    fireEvent.change(screen.getByRole('slider', { name: /Rotação Y:/ }), { target: { value: '45' } })
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].y).toBe(45)
    fireEvent.change(screen.getByRole('slider', { name: /Rotação X:/ }), { target: { value: '-60' } })
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).toBe(-60)

    // O joelho (dobradiça) mostra um único slider, o de X — não há caso "sem controle".
    act(() => useFiguresStore.getState().selectJoint('knee.L'))
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    expect(screen.getByRole('slider', { name: /Rotação X:/ })).toBeInTheDocument()
    expect(useFiguresStore.getState().figures[0].id).toBe(id)
  })

  it('os rótulos dos sliders levam a cor do eixo — o mesmo padrão do gizmo (item 60)', async () => {
    addFigureAndSelect()
    useFiguresStore.getState().selectJoint('elbow.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    expect(screen.getByText(/Rotação X:/)).toHaveStyle({ color: '#e04040' })
    expect(screen.getByText(/Rotação Y:/)).toHaveStyle({ color: '#40a840' })
  })

  it('o ⟲ devolve SÓ aquele eixo ao inicial — o cotovelo volta a y=90, sem tocar no x (item 61)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -60, y: 30 })
    useFiguresStore.getState().selectJoint('elbow.L')
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    await user.click(
      screen.getByRole('button', { name: 'Rotação Y: voltar ao valor inicial' }),
    )
    const pose = useFiguresStore.getState().figures[0].pose['elbow.L']
    // A referência é a MESMA do reset da junta inteira: a pose "Em pé", não zero cru.
    expect(pose.y).toBe(90)
    expect(pose.x).toBe(-60)
  })

  it('na raiz o ⟲ zera o eixo; junta travada desabilita sliders e reset (item 61)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setRootRotation(id, { y: 90 })
    usePosesShellStore.getState().setActiveTab('joint')
    await renderPanel()

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'root' } })
    await user.click(
      screen.getByRole('button', { name: 'Rotação Y: voltar ao valor inicial' }),
    )
    expect(useFiguresStore.getState().figures[0].rotation.y).toBe(0)

    fireEvent.change(screen.getByLabelText('Selecionar junta'), { target: { value: 'elbow.L' } })
    act(() => useFiguresStore.getState().toggleJointLock(id, 'elbow.L'))
    expect(screen.getByRole('slider', { name: /Rotação Y:/ })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Rotação Y: voltar ao valor inicial' }),
    ).toBeDisabled()
  })
})

describe('aba Simetria', () => {
  it('copia um lado para o outro pelo caminho já existente do store', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -40 })
    usePosesShellStore.getState().setActiveTab('symmetry')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Copiar esq. → dir.' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.R'].x).toBe(-40)
  })

  it('com alcance "da junta selecionada", o espelho não sai do membro (item 59)', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -40 })
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: -50 })
    useFiguresStore.getState().selectJoint('shoulder.L')
    usePosesShellStore.getState().setActiveTab('symmetry')
    await renderPanel()

    const hipRBefore = useFiguresStore.getState().figures[0].pose['hip.R'].x
    fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'joint' } })
    await user.click(screen.getByRole('button', { name: 'Copiar esq. → dir.' }))

    const pose = useFiguresStore.getState().figures[0].pose
    expect(pose['elbow.R'].x).toBe(-40)
    // A perna fica intacta: o alcance era o braço esquerdo.
    expect(pose['hip.R'].x).toBe(hipRBefore)
  })

  it('sem junta com par selecionada, a opção de alcance por junta fica desabilitada', async () => {
    addFigureAndSelect()
    useFiguresStore.getState().selectJoint('head')
    usePosesShellStore.getState().setActiveTab('symmetry')
    await renderPanel()

    expect(
      screen.getByRole('option', { name: 'Da junta selecionada (nenhuma com par)' }),
    ).toBeDisabled()
  })
})

describe('aba Keyframes', () => {
  it('lista, regrava, reordena e remove — gestão completa da linha do tempo', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    captureKeyframe()
    const secondId = captureKeyframe()
    usePosesShellStore.getState().setActiveTab('keyframes')
    usePosesShellStore.getState().setCurrentKeyframeId(secondId)
    await renderPanel()

    expect(screen.getByText('Keyframe 1')).toBeInTheDocument()
    expect(screen.getByText('Keyframe 2')).toBeInTheDocument()

    // Mover o segundo para cima.
    await user.click(screen.getByRole('button', { name: 'Mover o keyframe 2 para cima' }))
    let working = findWorkingAnimation(useFiguresStore.getState().animations)!
    expect(working.keyframes[0].id).toBe(secondId)

    // Regravar preserva a câmera gravada (o módulo não tem câmera de cena).
    const cameraBefore = working.keyframes[0].camera
    await user.click(screen.getByRole('button', { name: 'Regravar o keyframe 1 com a pose atual' }))
    working = findWorkingAnimation(useFiguresStore.getState().animations)!
    expect(working.keyframes[0].camera).toEqual(cameraBefore)

    // Apagar passa pelo modal de confirmação (pedido do usuário, 2026-08-06).
    await user.click(screen.getByRole('button', { name: 'Remover o keyframe 2' }))
    await user.click(screen.getByRole('button', { name: 'Remover' }))
    working = findWorkingAnimation(useFiguresStore.getState().animations)!
    expect(working.keyframes).toHaveLength(1)
  })

  /** O ✕ é pequeno e o dedo erra: aqui a confirmação vale ainda mais. */
  it('cancelar a confirmação de apagar não tira o keyframe', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    captureKeyframe()
    captureKeyframe()
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Remover o keyframe 1' }))
    expect(findWorkingAnimation(useFiguresStore.getState().animations)!.keyframes).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(findWorkingAnimation(useFiguresStore.getState().animations)!.keyframes).toHaveLength(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"ir para" carrega o retrato na bancada e marca o keyframe corrente', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    captureKeyframe()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -90 })
    const secondId = captureKeyframe()
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Ir para o keyframe 1' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).not.toBe(-90)
    expect(usePosesShellStore.getState().currentKeyframeId).not.toBe(secondId)
  })

  /**
   * A mesma guarda temporária do painel de Animação (2026-08-06): o "Ir para"
   * da casca de toque também sobrescreve a bancada, e aqui não há Ctrl+Z ao
   * alcance do polegar.
   */
  it('"ir para" guarda a cena da tela, e o botão a recupera', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    const firstId = captureKeyframe()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -90 })
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Recuperar cena guardada' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ir para o keyframe 1' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).not.toBe(-90)

    await user.click(screen.getByRole('button', { name: 'Recuperar cena guardada' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).toBe(-90)
    // O keyframe escolhido segue marcado — é contra ele que o botão alterna.
    expect(usePosesShellStore.getState().currentKeyframeId).toBe(firstId)
  })

  /**
   * A proteção pedida pelo usuário: percorrer keyframes não pode apagar a cena
   * original — só se guarda o que mudou desde o último "Ir para".
   */
  it('percorrer keyframes não sobrescreve a cena guardada', async () => {
    const user = userEvent.setup()
    const id = addFigureAndSelect()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -90 })
    captureKeyframe()
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -30 })
    captureKeyframe()
    // A bancada é a cena original do usuário: cotovelo em -30.
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Ir para o keyframe 1' }))
    await user.click(screen.getByRole('button', { name: 'Ir para o keyframe 2' }))
    await user.click(screen.getByRole('button', { name: 'Ir para o keyframe 1' }))

    // A guarda continua com a cena de antes do primeiro "Ir para".
    expect(useSceneStashStore.getState().stash?.figures[0].pose['elbow.L'].x).toBe(-30)

    await user.click(screen.getByRole('button', { name: 'Recuperar cena guardada' }))
    expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).toBe(-30)
  })

  /**
   * A mesma escolha do painel de Animação, no mesmo `animationStore`: as duas
   * cascas contam a mesma história sobre o que o papel-cebola mostra.
   */
  it('escolhe de quais bonecos sai o fantasma', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    const segundo = useFiguresStore.getState().addFigure()!
    captureKeyframe()
    captureKeyframe()
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    // Só com o papel-cebola ligado — desligado, as caixas não têm o que dizer.
    expect(screen.queryByRole('group', { name: 'Fantasmas de' })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Anterior'))
    const caixas = within(screen.getByRole('group', { name: 'Fantasmas de' }))
    await user.click(caixas.getByLabelText('Figure 2'))

    expect(useAnimationStore.getState().onionSkinHiddenFigureIds).toEqual([segundo])
  })

  it('papel-cebola por dois checkboxes: o modo é inferido da combinação', async () => {
    const user = userEvent.setup()
    addFigureAndSelect()
    captureKeyframe()
    usePosesShellStore.getState().setActiveTab('keyframes')
    await renderPanel()

    // Só o anterior.
    await user.click(screen.getByLabelText('Anterior'))
    expect(useAnimationStore.getState().onionSkin).toBe(true)
    expect(useAnimationStore.getState().onionSkinMode).toBe('previous')

    // Os dois = ambos.
    await user.click(screen.getByLabelText('Posterior'))
    expect(useAnimationStore.getState().onionSkinMode).toBe('both')

    // Desmarcar o anterior = só o posterior.
    await user.click(screen.getByLabelText('Anterior'))
    expect(useAnimationStore.getState().onionSkin).toBe(true)
    expect(useAnimationStore.getState().onionSkinMode).toBe('next')

    // Nenhum = desligado.
    await user.click(screen.getByLabelText('Posterior'))
    expect(useAnimationStore.getState().onionSkin).toBe(false)
  })
})

describe('aba Arquivo', () => {
  it('exportar/compartilhar ficam desabilitados sem keyframes; abrir fica sempre disponível', async () => {
    usePosesShellStore.getState().setActiveTab('file')
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Abrir arquivo (substituir)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Anexar arquivo ao fim' })).toBeEnabled()
  })

  it('com keyframes, exportar habilita', async () => {
    addFigureAndSelect()
    captureKeyframe()
    usePosesShellStore.getState().setActiveTab('file')
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeEnabled()
  })

  /**
   * Carimbo de hora no nome do arquivo exportado (pedido do usuário,
   * 2026-08-07, ver `exportTimestamp.ts`). Aqui vale duplamente: no celular a
   * exportação cai na pasta de downloads, onde o navegador renomeia repetido
   * para `(1)`, `(2)` — nome nenhum diz de quando é.
   */
  it('o nome do arquivo exportado leva o carimbo de data e hora', async () => {
    addFigureAndSelect()
    captureKeyframe()
    usePosesShellStore.getState().setActiveTab('file')
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar JSON' }))

    await vi.waitFor(() => {
      expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    })
    const [, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(filename).toMatch(/_\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
  })

  it('traz a sessão do desktop após confirmação e zera o keyframe corrente (item 54)', async () => {
    localStorage.clear()
    useFiguresStore.getState().addFigure('Vindo do desktop')
    saveWorkspaceToLocalStorage(useFiguresStore.getState(), WORKSPACE_AUTOSAVE_KEY)
    useFiguresStore.setState(useFiguresStore.getInitialState())
    addFigureAndSelect()
    const keyframeId = captureKeyframe()
    usePosesShellStore.getState().setCurrentKeyframeId(keyframeId)
    usePosesShellStore.getState().setActiveTab('file')

    const user = userEvent.setup()
    await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Trazer sessão do desktop' }))
    // A confirmação é um <dialog> MODAL, como no painel de Cenas do desktop.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Isto substitui toda a sessão do módulo/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Substituir tudo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(useFiguresStore.getState().figures.map((figure) => figure.name)).toEqual(['Vindo do desktop'])
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
    // O keyframe corrente pertencia à sessão que saiu da tela.
    expect(usePosesShellStore.getState().currentKeyframeId).toBeNull()
  })

  it('avisa quando não há sessão do desktop salva neste aparelho', async () => {
    localStorage.clear()
    usePosesShellStore.getState().setActiveTab('file')

    const user = userEvent.setup()
    await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Trazer sessão do desktop' }))
    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não há sessão salva da aplicação completa neste aparelho.',
    )
  })

  it('aplica um JSON de pose avulsa ao boneco em edição (item 55)', async () => {
    const id = addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('file')

    // O leitor é o MESMO do "Pose em arquivo" do desktop (#81/#87): aceita a
    // família inteira de formatos — aqui, o arquivo de pose canônico.
    const poseJson = JSON.stringify({
      version: 1,
      figures: [
        {
          height: 1.8,
          position: [0, 0.3, 0],
          rotation: { x: 0, y: 45, z: 0 },
          pose: { 'elbow.L': { x: -30, y: 90, z: 0 } },
        },
      ],
    })
    vi.mocked(pickFile).mockResolvedValueOnce({
      file: new File([poseJson], 'pose.json'),
      data: new TextEncoder().encode(poseJson).buffer as ArrayBuffer,
    })

    const user = userEvent.setup()
    await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Aplicar pose do arquivo' }))

    const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === id)!
    expect(figure.height).toBeCloseTo(1.8, 6)
    expect(figure.position[1]).toBeCloseTo(0.3, 6)
    expect(figure.rotation.y).toBeCloseTo(45, 6)
    expect(figure.pose['elbow.L']).toEqual({ x: -30, y: 90, z: 0 })
  })

  it('sem boneco em edição, o "Aplicar pose do arquivo" fica desabilitado (item 55)', async () => {
    usePosesShellStore.getState().setActiveTab('file')
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Aplicar pose do arquivo' })).toBeDisabled()
  })

  it('avisa quando o JSON não tem pose aproveitável (item 55)', async () => {
    addFigureAndSelect()
    usePosesShellStore.getState().setActiveTab('file')

    const semPose = JSON.stringify({ qualquer: 'coisa' })
    vi.mocked(pickFile).mockResolvedValueOnce({
      file: new File([semPose], 'nada.json'),
      data: new TextEncoder().encode(semPose).buffer as ArrayBuffer,
    })

    const user = userEvent.setup()
    await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Aplicar pose do arquivo' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O arquivo foi lido, mas não tem nenhuma pose aproveitável',
    )
  })

  it('abre o leitor de QR e avisa quando a câmera não existe (item 65)', async () => {
    usePosesShellStore.getState().setActiveTab('file')

    const user = userEvent.setup()
    await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Receber sessão por QR code' }))

    const dialog = screen.getByRole('dialog')
    // jsdom não tem `navigator.mediaDevices`: o diálogo cai no aviso de câmera
    // — que é exatamente o caminho testável; a coleta em si é conferência
    // visual no navegador, como o arrasto de gizmo.
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível acessar a câmera deste aparelho.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
