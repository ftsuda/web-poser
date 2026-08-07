import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useSceneStashStore } from '../../store/sceneStashStore'
import { useUIStore } from '../../store/uiStore'
import { TimelineBar } from '../TimelineBar'
import { WORKING_ANIMATION_ID } from '../../animation/animation'
import type { CameraViewState } from '../../scene/cameraMove'

const camera: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

async function renderTimelineBar() {
  const utils = render(<TimelineBar />)
  await act(async () => {})
  return utils
}

/** Um boneco e `count` keyframes na animação de trabalho, 1000 ms cada trecho. */
function comAnimacao(count: number) {
  useFiguresStore.getState().addFigure()
  for (let i = 0; i < count; i += 1) useFiguresStore.getState().addAnimationKeyframe(null, camera)
}

describe('TimelineBar', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
    // A barra NASCE RECOLHIDA (como o painel de Animação): estes testes são
    // sobre o conteúdo, então ela começa aberta aqui.
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, timeline: false } }))
  })

  it('nasce recolhida: só o cabeçalho aparece até alguém expandir', async () => {
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, timeline: true } }))
    const user = userEvent.setup()
    comAnimacao(2)
    await renderTimelineBar()

    expect(screen.queryByRole('slider')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir painel Linha do tempo' }))
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('mostra o instante atual e o total, no cabeçalho', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ timeMs: 1500 })
    await renderTimelineBar()

    expect(screen.getByText('1.5s de 2.0s')).toBeInTheDocument()
  })

  it('arrastar a régua pede ao player para mostrar aquele instante', async () => {
    comAnimacao(2)
    useAnimationStore.setState({ playing: true })
    await renderTimelineBar()

    await act(async () => {
      fireEvent.change(screen.getByRole('slider'), { target: { value: '400' } })
    })

    expect(useAnimationStore.getState().timeMs).toBe(400)
    expect(useAnimationStore.getState().playing).toBe(false)
    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'seek' })
  })

  it('a régua marca onde estão os keyframes', async () => {
    comAnimacao(3)
    const { container } = await renderTimelineBar()

    const marcas = Array.from(container.querySelectorAll('datalist option')).map((option) =>
      option.getAttribute('value'),
    )
    expect(marcas).toEqual(['0', '1000', '2000'])
  })

  it('tocar só fica disponível quando há trecho para percorrer', async () => {
    comAnimacao(1)
    const { unmount } = await renderTimelineBar()
    expect(screen.getByRole('button', { name: 'Tocar' })).toBeDisabled()
    unmount()

    act(() => {
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    })
    await renderTimelineBar()
    expect(screen.getByRole('button', { name: 'Tocar' })).toBeEnabled()
  })

  it('parar volta ao início e larga a pré-visualização', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    useAnimationStore.setState({ timeMs: 700, playing: true, preview: { figures: [], camera } })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: 'Parar' }))

    expect(useAnimationStore.getState().timeMs).toBe(0)
    expect(useAnimationStore.getState().playing).toBe(false)
    expect(useAnimationStore.getState().preview).toBeNull()
  })

  /** Item 27: o laço vale só na tela — o arquivo continua com uma passada. */
  it('a caixa de repetir liga o laço da reprodução', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    await renderTimelineBar()

    const caixa = screen.getByLabelText('Repetir')
    expect(caixa).not.toBeChecked()

    await user.click(caixa)
    expect(useAnimationStore.getState().repeat).toBe(true)
  })

  it('pular keyframe anda de marca em marca, e nas pontas desabilita', async () => {
    const user = userEvent.setup()
    comAnimacao(3)
    useAnimationStore.setState({ timeMs: 1500 })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: 'Keyframe anterior' }))
    expect(useAnimationStore.getState().timeMs).toBe(1000)

    await user.click(screen.getByRole('button', { name: 'Próximo keyframe' }))
    expect(useAnimationStore.getState().timeMs).toBe(2000)

    // No último keyframe não há para onde avançar.
    expect(screen.getByRole('button', { name: 'Próximo keyframe' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keyframe anterior' })).toBeEnabled()
  })

  it('as setas de quadro andam exatamente 1/fps', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    // 480 ms é o quadro 12 a 25 fps — em cima da grade, os dois sentidos andam
    // exatamente um quadro (40 ms).
    useAnimationStore.setState({ timeMs: 480, fps: 25 })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: /Um quadro para frente/ }))
    expect(useAnimationStore.getState().timeMs).toBe(520)

    await user.click(screen.getByRole('button', { name: /Um quadro para trás/ }))
    expect(useAnimationStore.getState().timeMs).toBe(480)
  })

  /**
   * As setas levam o quadro para a BANCADA, e não para a pré-visualização
   * (decisão do usuário, 2026-08-06; DECISOES.md #133). A pré-visualização é o
   * que "travava a edição no quadro desejado": ela é desenhada NO LUGAR da cena
   * de trabalho, então tudo o que se editava acontecia invisível atrás dela.
   *
   * A regra é a que separa PROCURAR de PARAR: a régua e o ⏮/⏭ continuam só
   * mostrando; as setas de quadro põem a cena para trabalhar.
   */
  it('a seta de quadro põe a pose do instante na cena de trabalho, sem pré-visualização', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 20 })
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0 })
    useAnimationStore.setState({ timeMs: 480, fps: 25, preview: { figures: [], camera } })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: /Um quadro para frente/ }))

    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().pendingCommand).toBeNull()
    // 520 de 1000: 52% do caminho entre 0 e 20 graus.
    expect(useFiguresStore.getState().figures[0].pose['hip.L'].x).toBeCloseTo(10.4)
  })

  /** Andar não é editar: a cena que se estava montando fica na guarda (#127). */
  it('a primeira seta de quadro guarda a cena que estava na bancada', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: 25 })
    useAnimationStore.setState({ timeMs: 480, fps: 25 })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: /Um quadro para frente/ }))

    expect(useSceneStashStore.getState().stash?.figures[0].pose['shoulder.L'].x).toBeCloseTo(25)
  })

  /**
   * Arrastar a régua é PROCURAR: enquanto o dedo está nela, a pré-visualização
   * mostra o instante e a bancada fica intocada — o arrasto emite dezenas de
   * instantes por segundo, e escrever a cena a cada um seria absurdo.
   */
  it('arrastar a régua só mostra: a bancada não se move', async () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 20 })
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const bancadaAntes = useFiguresStore.getState().figures
    await renderTimelineBar()

    await act(async () => {
      fireEvent.change(screen.getByRole('slider'), { target: { value: '400' } })
    })

    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'seek' })
    expect(useFiguresStore.getState().figures).toBe(bancadaAntes)
  })

  /**
   * E SOLTAR é parar: o instante em que a régua ficou vai para a bancada. Sem
   * isto a pré-visualização sobrevivia ao arrasto, e daí em diante toda edição
   * de pose acontecia invisível atrás dela (DECISOES.md #134).
   */
  it('soltar a régua leva o instante para a bancada', async () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 20 })
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0 })
    await renderTimelineBar()

    const regua = screen.getByRole('slider')
    await act(async () => {
      fireEvent.change(regua, { target: { value: '500' } })
    })
    await act(async () => {
      fireEvent.pointerUp(regua)
    })

    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useFiguresStore.getState().figures[0].pose['hip.L'].x).toBeCloseTo(10)
  })

  /** A régua também anda pelo teclado, com o foco nela: mesmo gesto, sem ponteiro. */
  it('soltar a tecla na régua também leva o instante para a bancada', async () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    await renderTimelineBar()

    const regua = screen.getByRole('slider')
    await act(async () => {
      fireEvent.change(regua, { target: { value: '700' } })
    })
    await act(async () => {
      fireEvent.keyUp(regua, { key: 'ArrowRight' })
    })

    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().timeMs).toBe(700)
  })

  /**
   * O ⏮/⏭ fica na MESMA fileira das setas de quadro. Dois botões vizinhos com
   * efeitos opostos sobre a cena — um deixando editar, o outro não — era
   * exatamente o que fazia a bancada "travar" sem explicação.
   */
  it('o ⏭ leva o keyframe para a bancada, como as setas de quadro', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 20 })
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useAnimationStore.setState({ preview: { figures: [], camera } })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: 'Próximo keyframe' }))

    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().timeMs).toBe(1000)
    // Em cima de um keyframe, a bancada É o retrato dele: a marca do item 40
    // acende, e o "Regravar" passa a dizer a verdade.
    const segundo = useFiguresStore.getState().animations[0].keyframes[1].id
    expect(useAnimationStore.getState().visitedKeyframeId).toBe(segundo)
  })

  /**
   * Pausar no meio é parar NAQUELE quadro para trabalhar nele. Antes, o último
   * quadro tocado ficava na tela como pré-visualização e a cena só voltava a
   * responder no "Parar", que zera a régua.
   */
  it('pausar deixa o quadro em que parou na bancada', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useAnimationStore.setState({ playing: true, timeMs: 640, preview: { figures: [], camera } })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: 'Pausar' }))

    expect(useAnimationStore.getState().playing).toBe(false)
    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().timeMs).toBe(640)
  })

  it('no começo e no fim da linha do tempo as setas de quadro desabilitam', async () => {
    comAnimacao(2)
    const { unmount } = await renderTimelineBar()
    expect(screen.getByRole('button', { name: /Um quadro para trás/ })).toBeDisabled()
    unmount()

    useAnimationStore.setState({ timeMs: 1000 })
    await renderTimelineBar()
    expect(screen.getByRole('button', { name: /Um quadro para frente/ })).toBeDisabled()
  })

  it('sem animação nenhuma, a barra aparece vazia e sem controles ativos', async () => {
    await renderTimelineBar()

    expect(screen.getByText('0.0s de 0.0s')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tocar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Parar' })).toBeDisabled()
  })

  it('a régua segue a animação de trabalho, não uma salva', async () => {
    comAnimacao(2)
    act(() => {
      useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    })
    await renderTimelineBar()

    expect(useFiguresStore.getState().animations[0].id).toBe(WORKING_ANIMATION_ID)
    expect(screen.getByText('0.0s de 2.0s')).toBeInTheDocument()
  })
})

/**
 * "Inserir keyframe aqui" veio do painel de Animação (pedido do usuário): ele
 * corta o trecho no instante do playhead, e o playhead mora nesta barra.
 */
describe('TimelineBar — inserir keyframe', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, timeline: false } }))
  })

  it('corta o trecho no instante da linha do tempo', async () => {
    const user = userEvent.setup()
    comAnimacao(2)
    useAnimationStore.setState({ timeMs: 600 })
    await renderTimelineBar()

    await user.click(screen.getByRole('button', { name: 'Inserir keyframe aqui' }))

    const { keyframes } = useFiguresStore.getState().animations.find((a) => a.id === WORKING_ANIMATION_ID)!
    expect(keyframes).toHaveLength(3)
    // As duas metades somam o trecho de 1000 ms: a animação não ficou mais longa.
    expect(keyframes[1].durationMs).toBe(600)
    expect(keyframes[2].durationMs).toBe(400)
    // E a bancada passa a ser o keyframe recém-criado, que é o que se vai
    // ajustar — com a marca do item 40 nele (DECISOES.md #134).
    expect(useAnimationStore.getState().timeMs).toBe(600)
    expect(useAnimationStore.getState().preview).toBeNull()
    // O keyframe novo é o do MEIO: ele começa em 600, e o antigo segundo
    // continua em 1000.
    expect(useAnimationStore.getState().visitedKeyframeId).toBe(keyframes[1].id)
  })

  it('avisa quando o trecho sob o playhead tem suavização — inserir devolve as metades ao linear (item 26)', async () => {
    comAnimacao(2)
    const id = useFiguresStore.getState().animations[0].keyframes[1].id
    useFiguresStore.getState().setAnimationKeyframeEasing(WORKING_ANIMATION_ID, id, 'easeInOut')
    useAnimationStore.setState({ timeMs: 600 })
    await renderTimelineBar()

    expect(
      screen.getByText('Este trecho tem suavização: ao inserir, as duas metades voltam a ser lineares.'),
    ).toBeInTheDocument()

    // Sem suavização no trecho, nada de aviso.
    act(() => {
      useFiguresStore.getState().setAnimationKeyframeEasing(WORKING_ANIMATION_ID, id, 'linear')
    })
    expect(
      screen.queryByText('Este trecho tem suavização: ao inserir, as duas metades voltam a ser lineares.'),
    ).not.toBeInTheDocument()
  })

  it('fica indisponível em cima de um keyframe e nas pontas', async () => {
    comAnimacao(3)
    await renderTimelineBar()

    const botao = () => screen.getByRole('button', { name: 'Inserir keyframe aqui' })
    // 0, 1000 e 2000 são os instantes dos três keyframes: não há trecho a cortar.
    for (const instante of [0, 1000, 2000]) {
      act(() => {
        useAnimationStore.getState().setTimeMs(instante)
      })
      expect(botao()).toBeDisabled()
    }

    act(() => {
      useAnimationStore.getState().setTimeMs(1500)
    })
    expect(botao()).toBeEnabled()
  })

  it('fica indisponível enquanto a animação toca', async () => {
    comAnimacao(2)
    useAnimationStore.setState({ timeMs: 500, playing: true })
    await renderTimelineBar()

    // Tocando, o instante mudaria entre ver o botão e clicá-lo.
    expect(screen.getByRole('button', { name: 'Inserir keyframe aqui' })).toBeDisabled()
  })
})

/**
 * A régua numerada abaixo do slider (pedido do usuário, 2026-07-31) e, dentro
 * dela, o destaque do keyframe que o painel marca (item 41) — para a barra e o
 * painel contarem a mesma história.
 */
describe('TimelineBar — régua numerada dos keyframes', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, timeline: false } }))
  })

  const marcas = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.timeline-bar__mark'))
  const destaque = (container: HTMLElement) =>
    container.querySelector('.timeline-bar__mark--visited')

  it('numera cada keyframe e o põe no instante dele', async () => {
    comAnimacao(3)
    const { container } = await renderTimelineBar()

    // 3 keyframes de 1000 ms: o total é 2000 ms, o k2 cai na metade e o k3 no fim.
    expect(marcas(container).map((marca) => marca.textContent)).toEqual(['1', '2', '3'])
    expect(marcas(container).map((marca) => (marca as HTMLElement).style.left)).toEqual([
      '0%',
      '50%',
      '100%',
    ])
  })

  /** O número sozinho não diz quando: o título completa com o instante. */
  it('cada marca diz o número e o instante', async () => {
    comAnimacao(3)
    const { container } = await renderTimelineBar()

    expect(marcas(container)[1]).toHaveAttribute('title', 'Keyframe 2 — 1.0s')
  })

  it('sem "Ir para" nenhuma marca fica em destaque', async () => {
    comAnimacao(3)
    const { container } = await renderTimelineBar()

    expect(marcas(container)).toHaveLength(3)
    expect(destaque(container)).toBeNull()
  })

  it('destaca a marca do keyframe que está na cena de trabalho', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ visitedKeyframeId: 'k2' })
    const { container } = await renderTimelineBar()

    const traco = destaque(container)
    expect(traco).toHaveStyle({ left: '50%' })
    expect(traco).toHaveAttribute('title', 'Keyframe 2 está na cena de trabalho')
  })

  /** O destaque é leitura: some sozinho quando o keyframe deixa de existir. */
  it('remover o keyframe destacado apaga o destaque, e a marca some com ele', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ visitedKeyframeId: 'k3' })
    const { container } = await renderTimelineBar()
    expect(destaque(container)).not.toBeNull()

    act(() => {
      useFiguresStore.getState().removeAnimationKeyframe(WORKING_ANIMATION_ID, 'k3')
    })

    expect(destaque(container)).toBeNull()
    expect(marcas(container)).toHaveLength(2)
  })

  /** Recolhida, o corpo da barra nem é renderizado — não há régua nenhuma. */
  it('recolhida, não desenha régua', async () => {
    comAnimacao(3)
    useAnimationStore.setState({ visitedKeyframeId: 'k2' })
    useUIStore.setState((state) => ({ collapsedPanels: { ...state.collapsedPanels, timeline: true } }))
    const { container } = await renderTimelineBar()

    expect(marcas(container)).toHaveLength(0)
  })
})
