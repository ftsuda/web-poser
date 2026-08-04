import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'
import { useAnimationStore } from '../../store/animationStore'
import { useCameraStore } from '../../store/cameraStore'
import { useDepthStore } from '../../store/depthStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'
import { useKeyframeThumbnailStore } from '../../store/keyframeThumbnailStore'
import { AnimationPanel } from '../AnimationPanel'
import type { CameraViewState } from '../../scene/cameraMove'
import { WORKING_ANIMATION_ID } from '../../animation/animation'

const camera: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

async function renderAnimationPanel() {
  const utils = render(<AnimationPanel />)
  await act(async () => {})
  return utils
}

/**
 * Um boneco em cena e `count` keyframes já capturados na animação DE TRABALHO
 * — que nasce da própria captura, sem ninguém criar nada antes (item 36).
 */
function comAnimacao(count: number): string {
  useFiguresStore.getState().addFigure()
  for (let i = 0; i < count; i += 1) useFiguresStore.getState().addAnimationKeyframe(null, camera)
  if (count > 0) useFiguresStore.getState().renameAnimation(WORKING_ANIMATION_ID, 'Corrida')
  return WORKING_ANIMATION_ID
}

/**
 * Painel aberto E as três seções recolhíveis abertas. Na tela o painel nasce
 * recolhido (é o único fora do fluxo de posar e capturar, e são sete colunas)
 * e as seções também — trechos prontos, vídeo e biblioteca são blocos que se
 * usam de vez em quando (`uiPreferences.ts`). Estes testes são sobre o
 * CONTEÚDO, então tudo começa aberto aqui.
 */
function abrirPainel() {
  useUIStore.setState((state) => ({
    collapsedPanels: { ...state.collapsedPanels, animation: false },
    collapsedSections: { ...state.collapsedSections, animationClips: false, animationVideo: false, animationLibrary: false },
    modalOpen: false,
  }))
}

describe('AnimationPanel', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useDepthStore.setState(useDepthStore.getInitialState())
    abrirPainel()
  })

  it('nasce recolhido: só o título aparece até alguém expandir', async () => {
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, animation: true } }))
    const user = userEvent.setup()
    await renderAnimationPanel()

    expect(screen.queryByRole('button', { name: 'Capturar keyframe' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir painel Animação' }))
    expect(screen.getByRole('button', { name: 'Capturar keyframe' })).toBeInTheDocument()
  })

  /**
   * Item 36: não existe mais "criar antes". Com boneco em cena, o botão de
   * capturar já está disponível sem animação nenhuma — é a captura que cria a
   * animação de trabalho.
   */
  it('com boneco e sem animação, capturar já está disponível e o painel diz por onde começar', async () => {
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()

    expect(screen.getByRole('heading', { name: 'Animação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capturar keyframe' })).toBeEnabled()
    expect(
      screen.getByText('Capture o primeiro keyframe — a animação de trabalho é criada sozinha.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar' })).not.toBeInTheDocument()
  })

  it('sem boneco em cena não dá para capturar — não há retrato de cena', async () => {
    await renderAnimationPanel()

    expect(screen.getByRole('button', { name: 'Capturar keyframe' })).toBeDisabled()
    expect(screen.getByText('Adicione ao menos um boneco à cena antes de capturar.')).toBeInTheDocument()
  })

  it('o nome da animação de trabalho só vale ao sair do campo', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    const campo = screen.getByLabelText('Nome da animação')
    expect(campo).toHaveValue('Corrida')

    await user.clear(campo)
    await user.type(campo, 'Salto')
    expect(useFiguresStore.getState().animations[0].name).toBe('Corrida')

    await user.tab()
    expect(useFiguresStore.getState().animations[0].name).toBe('Salto')
  })

  /** A câmera do keyframe é uma câmera em perspectiva (posição, alvo e lente). */
  it('em vista ortográfica a captura fica bloqueada, com o motivo à vista', async () => {
    comAnimacao(0)
    useCameraStore.setState({ projection: 'orthographic' })
    await renderAnimationPanel()

    expect(screen.getByRole('button', { name: 'Capturar keyframe' })).toBeDisabled()
    expect(screen.getByText(/câmera em perspectiva/)).toBeInTheDocument()
  })

  it('capturar pede o comando ao player — quem lê a câmera viva é ele', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Capturar keyframe' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'captureKeyframe' })
  })

  /**
   * O retrato é da CENA DE TRABALHO. Capturar com a animação na tela deixaria o
   * usuário vendo uma coisa e gravando outra.
   */
  it('capturar larga a pré-visualização e para a reprodução', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    useAnimationStore.setState({
      playing: true,
      preview: { figures: [], camera },
    })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Capturar keyframe' }))

    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().playing).toBe(false)
  })

  it('lista os keyframes com o instante de cada um na linha do tempo', async () => {
    comAnimacao(3)
    await renderAnimationPanel()

    // Padrão de 1000 ms por trecho, e o primeiro no instante zero.
    expect(screen.getByText('Keyframe 1 — 0.0s')).toBeInTheDocument()
    expect(screen.getByText('Keyframe 2 — 1.0s')).toBeInTheDocument()
    expect(screen.getByText('Keyframe 3 — 2.0s')).toBeInTheDocument()
  })

  it('a duração do primeiro keyframe é desabilitada — não há trecho antes dele', async () => {
    comAnimacao(2)
    await renderAnimationPanel()

    const duracoes = screen.getAllByLabelText('Duração (ms)')
    expect(duracoes[0]).toBeDisabled()
    expect(duracoes[1]).toBeEnabled()
  })

  it('a suavização do trecho (item 26) grava no keyframe de chegada; a do primeiro é desabilitada', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    const curvas = screen.getAllByLabelText('Suavização')
    expect(curvas[0]).toBeDisabled()

    await user.selectOptions(curvas[1], 'Suave (entrada e saída)')
    const animacao = () => useFiguresStore.getState().animations.find((a) => a.id === id)!
    expect(animacao().keyframes[1].easing).toBe('easeInOut')

    // Voltar ao linear limpa o campo — arquivo antigo e novo ficam iguais.
    await user.selectOptions(curvas[1], 'Linear')
    expect('easing' in animacao().keyframes[1]).toBe(false)
  })

  /**
   * Confirma ao SAIR do campo, não a cada tecla — grampear por tecla faria
   * "2500" virar "12500" (o primeiro dígito cairia no mínimo e os seguintes se
   * acumulariam em cima). Mesmo padrão da altura do boneco.
   */
  it('editar a duração só vale ao sair do campo, e aí muda o total da linha do tempo', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    const duracoes = screen.getAllByLabelText('Duração (ms)')
    await user.clear(duracoes[1])
    await user.type(duracoes[1], '2500')

    const animacao = () => useFiguresStore.getState().animations.find((a) => a.id === id)!
    expect(animacao().keyframes[1].durationMs).toBe(1000)

    await user.tab()
    expect(animacao().keyframes[1].durationMs).toBe(2500)
    expect(screen.getByText(/Vídeo final: 2\.5s/)).toBeInTheDocument()
  })

  it('a velocidade só vale ao sair do campo, e muda o comprimento do vídeo sem mexer na linha do tempo', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()
    const animacao = () => useFiguresStore.getState().animations.find((a) => a.id === id)!

    const campo = screen.getByLabelText('Velocidade (×)')
    expect(campo).toHaveValue(1)

    await user.clear(campo)
    await user.type(campo, '0.5')
    expect(animacao().speed).toBe(1)

    await user.tab()
    expect(animacao().speed).toBe(0.5)
    // A linha do tempo não se mexe — o que dobra é o vídeo.
    expect(animacao().keyframes[1].durationMs).toBe(1000)
    expect(screen.getByText(/Vídeo final: 2\.0s/)).toBeInTheDocument()
  })

  it('a velocidade digitada é grampeada à faixa e à grade de 0,05', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()
    const animacao = () => useFiguresStore.getState().animations.find((a) => a.id === id)!

    const campo = screen.getByLabelText('Velocidade (×)')
    await user.clear(campo)
    await user.type(campo, '1.13')
    await user.tab()
    expect(animacao().speed).toBe(1.15)
    expect(campo).toHaveValue(1.15)

    await user.clear(campo)
    await user.type(campo, '99')
    await user.tab()
    expect(animacao().speed).toBe(5)
  })

  it('sair do campo vazio devolve o valor que estava lá, em vez de virar o mínimo', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    const campo = screen.getByLabelText('Velocidade (×)')
    await user.clear(campo)
    await user.tab()

    expect(useFiguresStore.getState().animations.find((a) => a.id === id)!.speed).toBe(1)
    expect(campo).toHaveValue(1)
  })

  it('as setas reordenam, e nas pontas ficam desabilitadas', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    const subir = screen.getAllByRole('button', { name: 'Mover para cima' })
    expect(subir[0]).toBeDisabled()

    const antes = useFiguresStore.getState().animations.find((a) => a.id === id)!.keyframes.map((k) => k.id)
    await user.click(subir[1])
    const depois = useFiguresStore.getState().animations.find((a) => a.id === id)!.keyframes.map((k) => k.id)

    expect(depois).toEqual([antes[1], antes[0]])
  })

  it('remover um keyframe tira só ele da lista', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Remover keyframe' })[0])

    expect(useFiguresStore.getState().animations.find((a) => a.id === id)!.keyframes).toHaveLength(1)
  })

  it('copia a câmera do keyframe vizinho sem mexer na pose', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    // Segundo keyframe com outra câmera, para a cópia ter o que mudar.
    act(() => {
      useFiguresStore.getState().updateAnimationKeyframe(id, 'k2', {
        position: [9, 9, 9],
        target: [1, 1, 1],
        up: [0, 1, 0],
        focalMm: 85,
      })
    })
    await renderAnimationPanel()

    const antes = useFiguresStore.getState().animations.find((a) => a.id === id)!.keyframes[1]
    await user.click(screen.getAllByRole('button', { name: /Copiar a câmera do keyframe anterior/ })[1])

    const depois = useFiguresStore.getState().animations.find((a) => a.id === id)!.keyframes[1]
    expect(depois.camera).toEqual(camera)
    expect(depois.figures).toBe(antes.figures)
  })

  it('nas pontas não há vizinho de onde copiar a câmera', async () => {
    comAnimacao(2)
    await renderAnimationPanel()

    const anteriores = screen.getAllByRole('button', { name: /Copiar a câmera do keyframe anterior/ })
    const seguintes = screen.getAllByRole('button', { name: /Copiar a câmera do keyframe seguinte/ })
    expect(anteriores[0]).toBeDisabled()
    expect(anteriores[1]).toBeEnabled()
    expect(seguintes[0]).toBeEnabled()
    expect(seguintes[1]).toBeDisabled()
  })

  it('exportar só com keyframes, e o pedido vai como comando', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar MP4' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'exportVideo' })
    expect(useAnimationStore.getState().exportPhase).toBe('running')
  })

  it('durante a exportação mostra o progresso e oferece cancelar', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    useAnimationStore.setState({ exportPhase: 'running', exportedFrames: 42, exportTotalFrames: 300 })
    await renderAnimationPanel()

    expect(screen.getByText('Renderizando quadro 42 de 300…')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(useAnimationStore.getState().cancelRequested).toBe(true)
  })

  it('sem codificador de vídeo, a mensagem explica em vez de falhar calada', async () => {
    comAnimacao(2)
    useAnimationStore.setState({ exportPhase: 'error', exportErrorKey: 'panels.animation.errorNoCodec' })
    await renderAnimationPanel()

    expect(screen.getByText(/não consegue codificar vídeo/)).toBeInTheDocument()
  })

  it('limpar confirma em diálogo antes de esvaziar a bancada', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    useAnimationStore.setState({ timeMs: 700, playing: true })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Limpar' }))

    // Apagar a linha do tempo inteira sem pedir nada, enquanto regravar UM
    // keyframe confirmava, era a proteção invertida.
    const dialog = await screen.findByRole('dialog', { name: 'Limpar a animação de trabalho' })
    expect(within(dialog).getByText('Corrida — 2 keyframe(s) na bancada.')).toBeInTheDocument()
    expect(useFiguresStore.getState().animations).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: 'Limpar' }))

    expect(useFiguresStore.getState().animations).toEqual([])
    expect(useAnimationStore.getState().timeMs).toBe(0)
    expect(useAnimationStore.getState().playing).toBe(false)
  })
})

/** Item 36: a biblioteca guarda cópias nomeadas; abrir substitui a de trabalho. */
describe('AnimationPanel — biblioteca de animações', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  it('sem nada salvo, a biblioteca diz que está vazia e não oferece o combo', async () => {
    comAnimacao(2)
    await renderAnimationPanel()

    expect(screen.getByText('Nenhuma animação salva ainda.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Animação salva')).not.toBeInTheDocument()
  })

  it('salvar guarda uma cópia com o nome digitado, sem tirar nada da bancada', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.type(screen.getByLabelText('Nome para guardar'), 'Tomada 1')
    await user.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }))

    const { animations } = useFiguresStore.getState()
    expect(animations).toHaveLength(2)
    expect(animations[0].id).toBe(WORKING_ANIMATION_ID)
    expect(animations[1].name).toBe('Tomada 1')
    expect(animations[1].keyframes).toHaveLength(2)
    // A de trabalho continua na bancada, com os mesmos keyframes.
    expect(screen.getByText('Keyframe 2 — 1.0s')).toBeInTheDocument()
  })

  it('salvar fica indisponível enquanto a de trabalho estiver vazia', async () => {
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()

    expect(screen.getByRole('button', { name: 'Salvar na biblioteca' })).toBeDisabled()
  })

  it('abrir uma salva substitui a de trabalho e devolve a linha do tempo ao início', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.type(screen.getByLabelText('Nome para guardar'), 'Tomada 1')
    await user.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }))

    // A bancada muda depois de salvar: fica com um keyframe só.
    act(() => {
      useFiguresStore.getState().removeAnimationKeyframe(WORKING_ANIMATION_ID, 'k2')
      useFiguresStore.getState().removeAnimationKeyframe(WORKING_ANIMATION_ID, 'k3')
      useAnimationStore.getState().setTimeMs(500)
    })
    expect(useFiguresStore.getState().animations[0].keyframes).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    const working = useFiguresStore.getState().animations[0]
    expect(working.id).toBe(WORKING_ANIMATION_ID)
    expect(working.keyframes).toHaveLength(3)
    expect(working.name).toBe('Tomada 1')
    expect(useAnimationStore.getState().timeMs).toBe(0)
  })

  it('regravar atualiza a salva escolhida sem rebatizá-la', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.type(screen.getByLabelText('Nome para guardar'), 'Tomada 1')
    await user.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }))

    act(() => {
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    })
    await user.click(screen.getByRole('button', { name: 'Atualizar a salva' }))

    const salva = useFiguresStore.getState().animations[1]
    expect(salva.name).toBe('Tomada 1')
    expect(salva.keyframes).toHaveLength(3)
  })

  it('sobe/desce a salva escolhida na lista, com as bordas desabilitadas (item 19)', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    act(() => {
      useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')
      useFiguresStore.getState().saveAnimationToLibrary('Tomada 2')
    })
    await renderAnimationPanel()

    // O combo abre na primeira salva ("Tomada 1"): primeira não sobe.
    expect(screen.getByRole('button', { name: 'Subir na lista' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Animação salva'), 'Tomada 2')
    expect(screen.getByRole('button', { name: 'Descer na lista' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Subir na lista' }))
    const nomes = useFiguresStore
      .getState()
      .animations.filter((animation) => animation.id !== WORKING_ANIMATION_ID)
      .map((animation) => animation.name)
    expect(nomes).toEqual(['Tomada 2', 'Tomada 1'])
  })

  it('remover tira só a salva escolhida, deixando a de trabalho onde está', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.type(screen.getByLabelText('Nome para guardar'), 'Tomada 1')
    await user.click(screen.getByRole('button', { name: 'Salvar na biblioteca' }))
    await user.click(screen.getByRole('button', { name: 'Remover' }))

    const { animations } = useFiguresStore.getState()
    expect(animations).toHaveLength(1)
    expect(animations[0].id).toBe(WORKING_ANIMATION_ID)
    expect(screen.getByText('Nenhuma animação salva ainda.')).toBeInTheDocument()
  })
})

describe('AnimationPanel — trechos prontos', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  it('trecho individual pede o comando ao player com o boneco do papel A', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    const figureId = useFiguresStore.getState().figures[0].id
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'appendClip',
      clipKey: 'walking',
      // Item 37: lista, e não um boneco só. Item 38: já vai com o rótulo do
      // grupo, para o trecho nascer agrupado.
      figureAIds: [figureId],
      figureBId: undefined,
      label: 'Andando 1',
    })
  })

  it('cena em dupla com um boneco só fica bloqueada, com o motivo à vista', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'punch')

    expect(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' })).toBeDisabled()
    expect(screen.getByText('Cenas em dupla precisam de dois bonecos diferentes na cena.')).toBeInTheDocument()
  })

  it('cena em dupla: os combos escolhem os papéis e B não lista o boneco de A', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addFigure()
    const [primeiro, segundo, terceiro] = useFiguresStore.getState().figures
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'rearChokeStanding')

    // Padrão: A é o 1º boneco e B o primeiro diferente dele.
    const comboB = screen.getByLabelText('Boneco B') as HTMLSelectElement
    expect((screen.getByLabelText('Boneco A') as HTMLSelectElement).value).toBe(primeiro.id)
    expect(comboB.value).toBe(segundo.id)
    expect(Array.from(comboB.options).map((option) => option.value)).not.toContain(primeiro.id)

    await user.selectOptions(comboB, terceiro.id)
    await user.click(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'appendClip',
      clipKey: 'rearChokeStanding',
      figureAIds: [primeiro.id],
      figureBId: terceiro.id,
      label: 'Mata-leão em pé 1',
    })
  })

  it('o combo de papel B só aparece nas cenas em dupla', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()

    expect(screen.queryByLabelText('Boneco B')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'dance')
    expect(screen.getByLabelText('Boneco B')).toBeInTheDocument()
  })
})

/** Itens 27 e 28 — pausa, pose do vizinho e fechar o ciclo, pelo painel. */
describe('AnimationPanel — pausa, pose do vizinho e ciclo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  it('duplicar cria a cópia logo depois — dois retratos iguais são uma pausa', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Duplicar keyframe' })[0])

    const { keyframes } = useFiguresStore.getState().animations.find((a) => a.id === id)!
    expect(keyframes.map((k) => k.id)).toEqual(['k1', 'k3', 'k2'])
    expect(keyframes[1].figures).toBe(keyframes[0].figures)
  })

  it('copia a pose do vizinho sem mexer na câmera, e nas pontas desabilita', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    const figureId = useFiguresStore.getState().figures[0].id
    act(() => {
      useFiguresStore.getState().setPosition(figureId, [3, 0, 0])
      useFiguresStore.getState().updateAnimationKeyframe(id, 'k2', { ...camera, focalMm: 85 })
    })
    await renderAnimationPanel()

    const anteriores = screen.getAllByRole('button', { name: /Copiar a pose do keyframe anterior/ })
    expect(anteriores[0]).toBeDisabled()

    await user.click(anteriores[1])

    const { keyframes } = useFiguresStore.getState().animations.find((a) => a.id === id)!
    expect(keyframes[1].figures).toBe(keyframes[0].figures)
    expect(keyframes[1].camera.focalMm).toBe(85)
  })

  it('fechar o ciclo copia o primeiro keyframe para o fim, e precisa de dois', async () => {
    const user = userEvent.setup()
    const { unmount } = await renderAnimationPanel()
    comAnimacao(1)
    unmount()

    await renderAnimationPanel()
    expect(screen.getByRole('button', { name: 'Fechar o ciclo' })).toBeDisabled()

    act(() => {
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    })
    await user.click(screen.getByRole('button', { name: 'Fechar o ciclo' }))

    const { keyframes } = useFiguresStore.getState().animations[0]
    expect(keyframes).toHaveLength(3)
    expect(keyframes[2].figures).toBe(keyframes[0].figures)
  })
})

/** Itens 37 e 38 — checkboxes de bonecos e grupos rotulados, pelo painel. */
describe('AnimationPanel — bonecos do trecho e grupos', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  it('trecho individual: checkboxes, com o boneco selecionado já marcado', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    useFiguresStore.getState().addFigure()
    const [primeiro, segundo] = useFiguresStore.getState().figures
    act(() => {
      useFiguresStore.getState().selectFigure(segundo.id)
    })
    await renderAnimationPanel()

    expect(screen.queryByLabelText('Boneco A')).not.toBeInTheDocument()
    expect(screen.getByLabelText(segundo.name)).toBeChecked()
    expect(screen.getByLabelText(primeiro.name)).not.toBeChecked()

    await user.click(screen.getByLabelText(primeiro.name))
    await user.click(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'appendClip',
      clipKey: 'walking',
      figureAIds: [segundo.id, primeiro.id],
      figureBId: undefined,
      label: 'Andando 1',
    })
  })

  it('desmarcar todos bloqueia o botão, com o motivo à vista', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    const [boneco] = useFiguresStore.getState().figures
    await renderAnimationPanel()

    await user.click(screen.getByLabelText(boneco.name))

    expect(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' })).toBeDisabled()
    expect(screen.getByText('Marque ao menos um boneco.')).toBeInTheDocument()
  })

  it('em dupla volta o combo de papel A — os encaixes são medidos par a par', async () => {
    const user = userEvent.setup()
    comAnimacao(0)
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'punch')

    expect(screen.getByLabelText('Boneco A')).toBeInTheDocument()
    expect(screen.getByLabelText('Boneco B')).toBeInTheDocument()
  })

  it('mostra o cabeçalho do grupo e recolhe o bloco inteiro', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(3)
    act(() => {
      useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando 1')
      useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k2', 'Andando 1')
    })
    await renderAnimationPanel()

    const cabecalho = screen.getByRole('button', { name: /Andando 1/ })
    expect(screen.getByText('2 keyframes')).toBeInTheDocument()
    expect(screen.getByText('Keyframe 1 — 0.0s')).toBeInTheDocument()

    await user.click(cabecalho)

    // Recolhido, os keyframes do grupo somem — o de fora continua.
    expect(screen.queryByText('Keyframe 1 — 0.0s')).not.toBeInTheDocument()
    expect(screen.queryByText('Keyframe 2 — 1.0s')).not.toBeInTheDocument()
    expect(screen.getByText('Keyframe 3 — 2.0s')).toBeInTheDocument()
  })

  /** #117.1 — os botões do bloco moram numa LINHA própria, fora do título. */
  it('as setas do grupo ficam fora da linha do título', async () => {
    const id = comAnimacao(3)
    act(() => {
      for (const key of ['k1', 'k2']) {
        useFiguresStore.getState().setAnimationKeyframeLabel(id, key, 'Andando')
      }
    })
    await renderAnimationPanel()

    const cabecalho = screen.getByRole('button', { name: /Andando/ }).closest('li')!
    const titulo = cabecalho.querySelector('.animation-panel__group-title')!

    // Nome e contagem na primeira linha…
    expect(titulo).toContainElement(screen.getByText('2 keyframes'))
    // …e as setas fora dela, na sua própria.
    expect(titulo).not.toContainElement(screen.getByRole('button', { name: 'Subir o grupo' }))
    expect(cabecalho).toContainElement(screen.getByRole('button', { name: 'Subir o grupo' }))
  })

  /** #117 — o cabeçalho do grupo move o BLOCO, e ele pula o vizinho inteiro. */
  it('o cabeçalho do grupo move o bloco inteiro, pulando o vizinho inteiro', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(5)
    act(() => {
      for (const key of ['k1', 'k2', 'k3']) {
        useFiguresStore.getState().setAnimationKeyframeLabel(id, key, 'Andando')
      }
      for (const key of ['k4', 'k5']) {
        useFiguresStore.getState().setAnimationKeyframeLabel(id, key, 'Correndo')
      }
    })
    await renderAnimationPanel()

    const subir = screen.getAllByRole('button', { name: 'Subir o grupo' })
    const descer = screen.getAllByRole('button', { name: 'Descer o grupo' })
    // Primeiro grupo não sobe, último não desce.
    expect(subir[0]).toBeDisabled()
    expect(descer[1]).toBeDisabled()

    await user.click(subir[1])

    expect(useFiguresStore.getState().animations[0].keyframes.map((k) => k.id)).toEqual([
      'k4',
      'k5',
      'k1',
      'k2',
      'k3',
    ])
  })

  it('digitar um rótulo já usado em outro trecho devolve o nome com sufixo', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(3)
    act(() => {
      useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando')
    })
    await renderAnimationPanel()

    const campos = screen.getAllByLabelText('Grupo')
    await user.type(campos[2], 'Andando')
    await user.tab()

    expect(useFiguresStore.getState().animations[0].keyframes[2].label).toBe('Andando 2')
    expect(campos[2]).toHaveValue('Andando 2')
  })
})

/** Item 39 — salvar uma faixa como trecho e reaplicá-la. */
describe('AnimationPanel — biblioteca de trechos', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  it('salvar a faixa escolhida guarda o trecho e o oferece no mesmo combo', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Salvar do keyframe'), '0')
    await user.selectOptions(screen.getByLabelText('Salvar até o keyframe'), '2')
    await user.type(screen.getByLabelText('Nome do trecho'), 'Caminhada')
    await user.click(screen.getByRole('button', { name: 'Salvar trecho' }))

    const [clip] = useFiguresStore.getState().clipLibrary
    expect(clip.name).toBe('Caminhada')
    // A faixa é inclusive nas duas pontas: do keyframe 1 ao 3 são TRÊS passos.
    expect(clip.steps).toHaveLength(3)
    const combo = screen.getByLabelText('Trecho') as HTMLSelectElement
    expect(Array.from(combo.options).map((option) => option.text)).toContain('Caminhada')
  })

  it('faixa de um keyframe só deixa o botão desabilitado, com o motivo à vista', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Salvar do keyframe'), '1')
    await user.selectOptions(screen.getByLabelText('Salvar até o keyframe'), '1')

    expect(screen.getByRole('button', { name: 'Salvar trecho' })).toBeDisabled()
    expect(screen.getByText('A faixa precisa de pelo menos dois keyframes.')).toBeInTheDocument()
  })

  it('aplicar um trecho salvo pede o comando ao player, com o elenco escolhido', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    const [boneco] = useFiguresStore.getState().figures
    act(() => {
      useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Caminhada')
    })
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'saved:clip-1')
    await user.click(screen.getByRole('button', { name: 'Adicionar ao final da linha do tempo' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'appendSavedClip',
      clipId: 'clip-1',
      // Um papel só: cai nas checkboxes do item 37, um elenco por boneco.
      casts: [[boneco.id]],
      label: 'Caminhada 1',
    })
  })

  it('remover tira o trecho da biblioteca e do combo', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    act(() => {
      useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Caminhada')
    })
    await renderAnimationPanel()

    await user.selectOptions(screen.getByLabelText('Trecho'), 'saved:clip-1')
    await user.click(screen.getByRole('button', { name: 'Remover trecho' }))

    expect(useFiguresStore.getState().clipLibrary).toEqual([])
    const combo = screen.getByLabelText('Trecho') as HTMLSelectElement
    expect(Array.from(combo.options).map((option) => option.text)).not.toContain('Caminhada')
  })
})

/** Item 30 — miniatura por keyframe (cache em memória). */
describe('AnimationPanel — miniaturas', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useKeyframeThumbnailStore.setState({ thumbnails: {} })
    abrirPainel()
  })

  it('pede o comando ao player — quem renderiza é ele, no canvas vivo', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Gerar miniaturas' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'renderThumbnails' })
  })

  it('sem keyframes não há o que miniaturizar', async () => {
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()

    expect(screen.getByRole('button', { name: 'Gerar miniaturas' })).toBeDisabled()
  })

  it('mostra no card a miniatura que estiver em cache', async () => {
    comAnimacao(2)
    act(() => {
      useKeyframeThumbnailStore.getState().setThumbnail('k2', 'data:image/jpeg;base64,abc')
    })
    await renderAnimationPanel()

    expect(screen.queryByAltText('Miniatura do keyframe 1')).not.toBeInTheDocument()
    expect(screen.getByAltText('Miniatura do keyframe 2')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,abc',
    )
  })

  /** Ids de keyframe são únicos dentro de UMA animação. */
  it('abrir uma animação salva limpa o cache de miniaturas', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    act(() => {
      useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')
      useKeyframeThumbnailStore.getState().setThumbnail('k1', 'data:image/jpeg;base64,abc')
    })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    expect(useKeyframeThumbnailStore.getState().thumbnails).toEqual({})
  })

  /**
   * "Ir para" leva a cena de trabalho ao retrato do keyframe — e o playhead
   * junto. Sem isso a régua marcava 0,0s enquanto a cena mostrava outro
   * keyframe, e o papel-cebola (item 31) ancorava no instante errado.
   */
  it('leva o playhead para o instante do keyframe ao clicar em Ir para', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[2])

    expect(useAnimationStore.getState().timeMs).toBe(2000)
    expect(useAnimationStore.getState().pendingCommand).toMatchObject({
      type: 'goToKeyframe',
      keyframeId: 'k3',
    })

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[0])
    expect(useAnimationStore.getState().timeMs).toBe(0)
  })

  /**
   * Regravar em dois passos (pedido do usuário): substituir a pose e a câmera
   * guardadas por um clique indevido só se desfaz no Ctrl+Z.
   */
  it('regravar pede confirmação antes de mandar o comando', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[0])

    // Nada foi mandado ao player ainda — só a confirmação apareceu.
    expect(useAnimationStore.getState().pendingCommand).toBeNull()
    expect(screen.getByText(/Regravar substitui a pose e a câmera/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'updateKeyframe',
      keyframeId: 'k1',
    })
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('cancelar a confirmação não regrava nada', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[0])
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(useAnimationStore.getState().pendingCommand).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Regravar' })).toHaveLength(2)
  })

  /** Duas confirmações abertas seriam duas chances de clicar na errada. */
  it('abrir a confirmação de outro keyframe fecha a anterior', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[0])

    expect(screen.getAllByRole('button', { name: 'Confirmar' })).toHaveLength(1)
  })

  /** Item 31: papel-cebola. */
  it('liga e desliga o papel-cebola pela caixa do painel', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    const caixa = screen.getByLabelText('Papel-cebola')
    expect(caixa).not.toBeChecked()

    await user.click(caixa)
    expect(useAnimationStore.getState().onionSkin).toBe(true)
    expect(
      screen.getByText(/Mostra em fantasma os keyframes vizinhos do que está no playhead/),
    ).toBeInTheDocument()

    await user.click(caixa)
    expect(useAnimationStore.getState().onionSkin).toBe(false)
  })

  /**
   * Escolher o lado (pedido do usuário): os dois vizinhos, só o anterior ou só
   * o seguinte.
   */
  it('escolhe quais vizinhos o papel-cebola mostra', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    // Desligado, o combo não aparece: ocuparia a linha logo acima da lista de
    // keyframes sem fazer nada.
    expect(screen.queryByLabelText('Mostrar')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Papel-cebola'))

    const combo = screen.getByLabelText('Mostrar')
    expect(combo).toHaveValue('both')

    await user.selectOptions(combo, 'previous')
    expect(useAnimationStore.getState().onionSkinMode).toBe('previous')

    await user.selectOptions(combo, 'next')
    expect(useAnimationStore.getState().onionSkinMode).toBe('next')
  })

  /** O lado escolhido é preferência: desligar e religar não o perde. */
  it('desligar e religar mantém o lado escolhido', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    const caixa = screen.getByLabelText('Papel-cebola')
    await user.click(caixa)
    await user.selectOptions(screen.getByLabelText('Mostrar'), 'next')

    await user.click(caixa)
    await user.click(caixa)

    expect(screen.getByLabelText('Mostrar')).toHaveValue('next')
    expect(useAnimationStore.getState().onionSkinMode).toBe('next')
  })

  /** Com um keyframe só não há vizinho para virar fantasma. */
  it('não oferece papel-cebola com menos de dois keyframes', async () => {
    comAnimacao(1)
    await renderAnimationPanel()

    expect(screen.queryByLabelText('Papel-cebola')).not.toBeInTheDocument()
  })
})

/**
 * Item 40: depois de um "Ir para", o card do keyframe que ficou na cena de
 * trabalho aparece destacado — é nele que "Regravar" deve ser clicado, e antes
 * disso nada na tela dizia qual era.
 */
describe('AnimationPanel — keyframe na bancada', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  /** O `aria-current` é o gancho: "o item atual do conjunto". */
  const cards = () => Array.from(document.querySelectorAll('.animation-panel__keyframe'))
  const destacado = () => cards().findIndex((card) => card.getAttribute('aria-current') === 'true')

  it('sem "Ir para" nenhum card está destacado', async () => {
    comAnimacao(3)
    await renderAnimationPanel()

    expect(cards()).toHaveLength(3)
    expect(destacado()).toBe(-1)
  })

  it('"Ir para" destaca o card daquele keyframe, e só ele', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[1])

    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k2')
    expect(destacado()).toBe(1)

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[2])
    expect(destacado()).toBe(2)
  })

  /** Regravar reescreve o keyframe em que se está — e continua-se nele. */
  it('regravar não larga o destaque', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[1])
    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[1])
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k2')
    expect(destacado()).toBe(1)
  })

  /** O keyframe novo vai para o FIM: a bancada deixa de ser o marcado. */
  it('capturar um keyframe novo larga o destaque', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[0])
    await user.click(screen.getByRole('button', { name: 'Capturar keyframe' }))

    expect(useAnimationStore.getState().visitedKeyframeId).toBeNull()
    expect(destacado()).toBe(-1)
  })

  /** Ids são únicos DENTRO de uma animação: o `k1` de outra não é o mesmo. */
  it('abrir uma animação da biblioteca larga o destaque', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    act(() => {
      useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')
    })
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[0])
    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    expect(useAnimationStore.getState().visitedKeyframeId).toBeNull()
    expect(destacado()).toBe(-1)
  })

  /**
   * Marca do PLAYHEAD (pedido do usuário): saber em qual keyframe o ⏮/⏭ da
   * barra parou. A barra põe o instante exato do keyframe em `timeMs` (travado
   * nos testes da `TimelineBar`); o que se confere aqui é a leitura desse
   * instante — que vale igual para arrastar a régua e para as setas de quadro.
   */
  const comPlayhead = () =>
    Array.from(document.querySelectorAll('.animation-panel__keyframe')).findIndex((card) =>
      card.classList.contains('animation-panel__keyframe--playhead'),
    )

  it('marca o card em que a linha do tempo parou', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ timeMs: 1000 })
    await renderAnimationPanel()

    expect(comPlayhead()).toBe(1)
    expect(screen.getByTitle('A linha do tempo parou neste keyframe')).toBeInTheDocument()

    act(() => {
      useAnimationStore.getState().setTimeMs(2000)
    })
    expect(comPlayhead()).toBe(2)
  })

  /** No meio de um trecho não há keyframe sob o playhead. */
  it('entre dois keyframes, nenhum card fica marcado pelo playhead', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ timeMs: 1500 })
    await renderAnimationPanel()

    expect(comPlayhead()).toBe(-1)
    expect(screen.queryByTitle('A linha do tempo parou neste keyframe')).not.toBeInTheDocument()
  })

  /**
   * As duas marcas são coisas diferentes e convivem: o playhead só mexe na
   * pré-visualização, enquanto quem diz o que "Regravar" reescreve é a bancada.
   */
  it('playhead e bancada são marcas independentes', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    // "Ir para" põe as duas no mesmo card — ele leva o playhead junto.
    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[1])
    expect(destacado()).toBe(1)
    expect(comPlayhead()).toBe(1)

    // Andar pela régua move só a do playhead; a bancada continua no keyframe 2.
    act(() => {
      useAnimationStore.getState().setTimeMs(2000)
    })
    expect(comPlayhead()).toBe(2)
    expect(destacado()).toBe(1)
  })

  /**
   * O destaque casa por id: reordenar leva a marca junto e remover faz a marca
   * sumir sozinha — nenhuma escrituração extra.
   */
  it('mover o keyframe leva o destaque junto; remover faz o destaque sumir', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(3)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Ir para' })[2])
    expect(destacado()).toBe(2)

    act(() => {
      useFiguresStore.getState().moveAnimationKeyframe(id, 'k3', -1)
    })
    expect(destacado()).toBe(1)

    act(() => {
      useFiguresStore.getState().removeAnimationKeyframe(id, 'k3')
    })
    expect(destacado()).toBe(-1)
  })
})

/**
 * Arquivo avulso da animação (fase 12): exportar leva a de trabalho inteira, e
 * importar abre o diálogo que decide se ela substitui a bancada ou emenda no
 * fim dela — e quem executa os keyframes, os bonecos da cena ou os gravados.
 */
describe('AnimationPanel — exportar e importar JSON', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    abrirPainel()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  })

  /** Um arquivo escolhido no seletor, com o conteúdo JSON dado. */
  function arquivoEscolhido(json: unknown) {
    const data = new TextEncoder().encode(JSON.stringify(json)).buffer as ArrayBuffer
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'anim.json'), data })
  }

  /** O JSON de uma animação de um keyframe, gravada por um boneco chamado `figureName`. */
  function arquivoDeAnimacao(figureName = 'Gravado', figures = 1) {
    return {
      version: 1,
      animations: [
        {
          id: 'animation-1',
          name: 'Importada',
          speed: 1,
          keyframes: [
            {
              id: 'k1',
              durationMs: 500,
              figures: Array.from({ length: figures }, (_, index) => ({
                id: `figure-${index + 1}`,
                name: `${figureName} ${index + 1}`,
                color: '#123456',
                visible: true,
                height: 1.7,
                position: [index, 0, 0],
                rotation: { x: 0, y: 0, z: 0 },
                pose: {},
              })),
              camera,
            },
          ],
        },
      ],
    }
  }

  it('exportar fica desabilitado sem keyframes e grava o JSON com o nome da animação', async () => {
    const user = userEvent.setup()
    await renderAnimationPanel()
    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeDisabled()

    act(() => {
      comAnimacao(2)
    })
    await user.click(screen.getByRole('button', { name: 'Exportar JSON' }))

    const [, filename, blob] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(filename).toBe('Corrida.json')
    expect((blob as Blob).type).toBe('application/json')
  })

  it('importar abre o diálogo com o resumo do arquivo, e Substituir traz a animação', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))

    const dialog = await screen.findByRole('dialog', { name: 'Importar animação' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/Importada — 1 keyframes/)).toBeInTheDocument()
    // Enquanto o diálogo está aberto, os atalhos globais ficam suspensos.
    expect(useUIStore.getState().modalOpen).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Substituir' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useUIStore.getState().modalOpen).toBe(false)
    const working = useFiguresStore.getState().animations.find((a) => a.id === WORKING_ANIMATION_ID)!
    expect(working.name).toBe('Importada')
    expect(working.keyframes).toHaveLength(1)
  })

  it('remapeia por padrão: o boneco da cena executa a animação importada', async () => {
    const user = userEvent.setup()
    const figureId = useFiguresStore.getState().addFigure()!
    useFiguresStore.getState().renameFigure(figureId, 'Ana')
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })
    expect(screen.getByLabelText('Papel 1 (Gravado 1)')).toHaveValue(figureId)

    await user.click(screen.getByRole('button', { name: 'Substituir' }))

    const working = useFiguresStore.getState().animations.find((a) => a.id === WORKING_ANIMATION_ID)!
    expect(working.keyframes[0].figures[0].name).toBe('Ana')
  })

  it('cena com menos bonecos do que a animação: só resta recriar os gravados', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    arquivoEscolhido(arquivoDeAnimacao('Gravado', 2))
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })

    expect(
      screen.getByText('A animação usa 2 boneco(s) e a cena tem 1 — só dá para recriar os bonecos gravados.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Remapear para os bonecos da cena' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Recriar os bonecos gravados' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Substituir' }))

    const working = useFiguresStore.getState().animations.find((a) => a.id === WORKING_ANIMATION_ID)!
    expect(working.keyframes[0].figures.map((figure) => figure.name)).toEqual(['Gravado 1', 'Gravado 2'])
  })

  it('anexar fica indisponível com a bancada vazia', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })

    expect(screen.getByRole('button', { name: 'Anexar ao final' })).toBeDisabled()
    expect(
      screen.getByText('A animação de trabalho está vazia — não há onde anexar.'),
    ).toBeInTheDocument()
  })

  it('cancelar fecha o diálogo sem importar nada', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useFiguresStore.getState().animations).toEqual([])
    expect(useUIStore.getState().modalOpen).toBe(false)
  })

  it('arquivo sem animação nenhuma vira mensagem, e nenhum diálogo', async () => {
    const user = userEvent.setup()
    arquivoEscolhido({ version: 1, animations: [] })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo foi lido, mas não tem nenhuma animação aproveitável',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Enxertar a partir de um keyframe (pedido do usuário, 2026-07-31)
  // -------------------------------------------------------------------------

  it('com a bancada vazia não há o que enxertar: a seção nem aparece', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })

    expect(screen.queryByLabelText('A partir do keyframe')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Substituir a partir do/ })).not.toBeInTheDocument()
  })

  it('enxerta a partir do keyframe escolhido, mantendo os anteriores', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()
    const antes = useFiguresStore.getState().animations[0].keyframes[0]

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })
    await user.selectOptions(screen.getByLabelText('A partir do keyframe'), '1')

    await user.click(screen.getByRole('button', { name: 'Substituir a partir do 2' }))

    const working = useFiguresStore.getState().animations.find((a) => a.id === WORKING_ANIMATION_ID)!
    // A linha do tempo continua sendo a da bancada — nome, tamanho e o keyframe
    // anterior ao enxerto, todos intactos.
    expect(working.name).toBe('Corrida')
    expect(working.keyframes).toHaveLength(3)
    expect(working.keyframes[0]).toEqual(antes)
    // Quem executa é o boneco da CENA, com o nome dele — e não o gravado.
    expect(working.keyframes[1].figures[0].name).toBe('Figure 1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sem remapeamento não dá para enxertar — é o mapa que diz quem entra no lugar de quem', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })
    await user.click(screen.getByRole('radio', { name: 'Recriar os bonecos gravados' }))

    expect(screen.getByRole('button', { name: 'Substituir a partir do 1' })).toBeDisabled()
    expect(screen.getByText(/precisa do remapeamento/)).toBeInTheDocument()
  })

  it('avisa quanto o arquivo passa do fim da linha do tempo', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    arquivoEscolhido(arquivoDeAnimacao())
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Importar JSON' }))
    await screen.findByRole('dialog', { name: 'Importar animação' })
    // Um arquivo de um keyframe começando no último: nada sobra.
    expect(screen.queryByText(/entram no fim da linha do tempo/)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('A partir do keyframe'), '1')
    await user.click(screen.getByRole('button', { name: 'Substituir a partir do 2' }))

    expect(useFiguresStore.getState().animations[0].keyframes).toHaveLength(2)
  })
})

/**
 * Carimbar a câmera atual numa faixa de keyframes (pedido do usuário,
 * 2026-07-31) e a confirmação de "Regravar" em `<dialog>` — as duas caixas
 * modais do painel.
 */
describe('AnimationPanel — diálogos de câmera e de regravar', () => {
  const outraCamera: CameraViewState = {
    position: [-4, 2, 8],
    target: [0, 1, 0],
    up: [0, 1, 0],
    focalMm: 135,
  }

  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    abrirPainel()
  })

  const camerasDaAnimacao = () =>
    useFiguresStore.getState().animations[0].keyframes.map((keyframe) => keyframe.camera)

  it('a faixa nasce na animação inteira, e aplicar carimba a câmera de cena em todos', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    act(() => {
      useFiguresStore.getState().setSceneCamera(outraCamera)
    })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' }))

    const dialog = await screen.findByRole('dialog', { name: 'Aplicar a câmera atual' })
    expect(useUIStore.getState().modalOpen).toBe(true)
    expect(within(dialog).getByLabelText('Aplicar do keyframe')).toHaveValue('0')
    expect(within(dialog).getByLabelText('Aplicar até o keyframe')).toHaveValue('2')
    expect(
      within(dialog).getByText('Isto substitui a câmera de 3 keyframe(s). Só o Ctrl+Z desfaz.'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }))

    expect(camerasDaAnimacao()).toEqual([outraCamera, outraCamera, outraCamera])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useUIStore.getState().modalOpen).toBe(false)
  })

  it('a faixa escolhida limita o carimbo, e cancelar não muda nada', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    act(() => {
      useFiguresStore.getState().setSceneCamera(outraCamera)
    })
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(camerasDaAnimacao()).toEqual([camera, camera, camera])

    await user.click(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar a câmera atual' })
    await user.selectOptions(within(dialog).getByLabelText('Aplicar do keyframe'), '1')
    await user.selectOptions(within(dialog).getByLabelText('Aplicar até o keyframe'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }))

    expect(camerasDaAnimacao()).toEqual([camera, outraCamera, camera])
  })

  it('sem keyframes, e tocando, o botão fica indisponível', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    await renderAnimationPanel()
    expect(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' })).toBeDisabled()

    act(() => {
      comAnimacao(2)
      useAnimationStore.getState().play()
    })

    expect(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' })).toBeDisabled()
    // Tocando, o que está na tela é o enquadramento da animação, não o da
    // bancada — e o motivo fica à vista.
    expect(screen.getByText(/Pare a reprodução para aplicar a câmera/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Capturar keyframe' }))
  })

  /**
   * A confirmação de "Regravar" saiu do card para um modal: dentro da lista ela
   * ficava colada nos botões dos keyframes vizinhos, que seguiam clicáveis.
   */
  it('regravar confirma num diálogo modal, dizendo qual keyframe será reescrito', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[1])

    const dialog = await screen.findByRole('dialog', { name: 'Regravar keyframe' })
    expect(useUIStore.getState().modalOpen).toBe(true)
    expect(within(dialog).getByText('Keyframe 2 — 1.0s')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(useAnimationStore.getState().pendingCommand).toEqual({
      type: 'updateKeyframe',
      keyframeId: 'k2',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useUIStore.getState().modalOpen).toBe(false)
  })

  it('keyframe removido enquanto o diálogo esperava fecha a confirmação', async () => {
    const user = userEvent.setup()
    const id = comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getAllByRole('button', { name: 'Regravar' })[1])
    await screen.findByRole('dialog', { name: 'Regravar keyframe' })

    act(() => {
      useFiguresStore.getState().removeAnimationKeyframe(id, 'k2')
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useAnimationStore.getState().pendingCommand).toBeNull()
  })
})

/**
 * Reorganização do painel (pedido do usuário, 2026-07-31): o que se usa o tempo
 * todo — capturar e a lista de keyframes — fica à vista, e os três blocos de
 * uso ocasional nascem recolhidos. Sem isso, ~25 linhas de trechos prontos,
 * vídeo e biblioteca empurravam a lista para fora da tela.
 */
describe('AnimationPanel — seções recolhíveis', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    // Só o PAINEL aberto: as seções ficam no estado de fábrica, que é o que
    // estes testes medem.
    useUIStore.setState((state) => ({
      collapsedPanels: { ...state.collapsedPanels, animation: false },
      collapsedSections: useUIStore.getInitialState().collapsedSections,
      modalOpen: false,
    }))
  })

  it('o painel abre mostrando capturar e a lista, com os três blocos recolhidos', async () => {
    comAnimacao(2)
    await renderAnimationPanel()

    expect(screen.getByRole('button', { name: 'Capturar keyframe' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Duração (ms)')).toHaveLength(2)
    // Ações da linha do tempo ficam junto da lista, sempre à vista.
    expect(screen.getByRole('button', { name: 'Fechar o ciclo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar a câmera atual aos keyframes' })).toBeInTheDocument()

    // E os três blocos de uso ocasional não ocupam espaço nenhum.
    for (const titulo of ['Trechos prontos', 'Vídeo', 'Biblioteca e arquivos']) {
      expect(screen.getByRole('button', { name: titulo })).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByLabelText('Trecho')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar MP4' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da animação')).not.toBeInTheDocument()
  })

  it('abrir uma seção mostra o conteúdo dela e grava a escolha', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderAnimationPanel()

    await user.click(screen.getByRole('button', { name: 'Vídeo' }))

    expect(screen.getByRole('button', { name: 'Exportar MP4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vídeo' })).toHaveAttribute('aria-expanded', 'true')
    // Persistida como o recolhimento dos painéis: abrir "Vídeo" a cada sessão
    // seria pior do que o problema que a seção resolve.
    expect(useUIStore.getState().collapsedSections.animationVideo).toBe(false)
    expect(useUIStore.getState().collapsedSections.animationClips).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Vídeo' }))
    expect(screen.queryByRole('button', { name: 'Exportar MP4' })).not.toBeInTheDocument()
  })
})

/**
 * Fase 13 — o MP4 em profundidade. Fica na seção de vídeo, junto do fps e da
 * resolução: é escolha de SAÍDA, feita na hora de exportar.
 */
describe('AnimationPanel — saída em profundidade', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useDepthStore.setState(useDepthStore.getInitialState())
    abrirPainel()
  })

  it('escolhe exportar o MP4 em profundidade, desligado por padrão', async () => {
    comAnimacao(2)
    const user = userEvent.setup()
    await renderAnimationPanel()

    const checkbox = screen.getByLabelText('Exportar o MP4 em profundidade')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(useDepthStore.getState().videoDepth).toBe(true)
    // A escolha do PNG e a vista da tela seguem intocadas.
    expect(useDepthStore.getState().snapshotDepth).toBe(false)
    expect(useDepthStore.getState().previewEnabled).toBe(false)
  })
})
