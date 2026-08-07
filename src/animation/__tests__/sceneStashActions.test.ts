import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyEstimatedPoseToWorkbench,
  markWorkbenchRecorded,
  applyKeyframeToWorkbench,
  goToFrameWithStash,
  goToKeyframeFigures,
  goToKeyframeWithStash,
  restoreStash,
  stashWorkbench,
} from '../sceneStashActions'
import { useAnimationStore } from '../../store/animationStore'
import { useCameraStore } from '../../store/cameraStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useSceneStashStore } from '../../store/sceneStashStore'
import type { CameraViewState } from '../../scene/cameraMove'

const camera = (focalMm: number): CameraViewState => ({
  position: [0, 1.6, 4],
  target: [0, 1, 0],
  up: [0, 1, 0],
  focalMm,
})

const bancada = () => useFiguresStore.getState().figures
const guarda = () => useSceneStashStore.getState().stash

/**
 * A guarda temporária da bancada (pedido do usuário, 2026-08-06): clicar "Ir
 * para" num keyframe sobrescreve a cena que se estava montando, e antes disso
 * a única saída era o Ctrl+Z. Aqui está quem enche a guarda e quem a recupera —
 * a caixa em si é o `sceneStashStore`.
 */
describe('guarda temporária da bancada', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  it('guarda os bonecos E a câmera de cena', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'running')
    useFiguresStore.getState().setSceneCamera(camera(85))

    stashWorkbench()

    expect(guarda()?.figures).toHaveLength(1)
    expect(guarda()?.figures[0].pose['hip.L']).toEqual(bancada()[0].pose['hip.L'])
    expect(guarda()?.camera.focalMm).toBe(85)
  })

  /** A guarda é um RETRATO: mexer na bancada depois não a altera. */
  it('a guarda não acompanha a bancada', () => {
    const id = useFiguresStore.getState().addFigure() as string
    stashWorkbench()
    const antes = guarda()?.figures[0].pose['hip.L']

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    expect(guarda()?.figures[0].pose['hip.L']).toEqual(antes)
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  it('sem guarda, recuperar não faz nada', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    expect(restoreStash()).toBe(false)
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  it('recuperar devolve os bonecos e a câmera guardados', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setSceneCamera(camera(85))
    stashWorkbench()

    // O "Ir para" de um keyframe: outra pose, outro enquadramento.
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })
    useFiguresStore.getState().setSceneCamera(camera(24))

    expect(restoreStash()).toBe(true)
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0)
    expect(useFiguresStore.getState().sceneCamera.focalMm).toBe(85)
    // A lente do painel de Câmera anda junto, como no próprio "Ir para".
    expect(useCameraStore.getState().focalMm).toBe(85)
  })

  /**
   * Recuperar TROCA (decisão do usuário): o botão alterna entre a cena que se
   * estava montando e o keyframe que se foi ver.
   */
  it('recuperar duas vezes volta ao keyframe', () => {
    const id = useFiguresStore.getState().addFigure() as string
    stashWorkbench()
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    restoreStash()
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0)

    restoreStash()
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  /**
   * O destaque do keyframe (item 40) NÃO se larga: o keyframe visitado continua
   * marcado no painel e na régua, e é justamente contra ele que o botão
   * alterna (pedido do usuário, 2026-08-06).
   */
  it('recuperar não larga o destaque do keyframe visitado', () => {
    useFiguresStore.getState().addFigure()
    stashWorkbench()
    useAnimationStore.setState({ visitedKeyframeId: 'k2' })

    restoreStash()

    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k2')
  })

  /** A bancada volta a ser o que se vê: nem pré-visualização, nem reprodução. */
  it('recuperar para a reprodução e larga a pré-visualização', () => {
    useFiguresStore.getState().addFigure()
    stashWorkbench()
    useAnimationStore.setState({ playing: true, preview: { figures: [], camera: camera(35) } })

    restoreStash()

    expect(useAnimationStore.getState().playing).toBe(false)
    expect(useAnimationStore.getState().preview).toBeNull()
  })

  /** Um passo de undo desfaz a recuperação inteira, como o próprio "Ir para". */
  it('recuperar é um passo de undo só', () => {
    const id = useFiguresStore.getState().addFigure() as string
    stashWorkbench()
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })
    restoreStash()

    useFiguresStore.temporal.getState().undo()

    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  it('"Ir para" guarda a bancada e despacha o comando', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().setSceneCamera(camera(85))

    goToKeyframeWithStash('k2', 1500)

    expect(guarda()?.camera.focalMm).toBe(85)
    expect(useAnimationStore.getState().pendingCommand).toEqual({ type: 'goToKeyframe', keyframeId: 'k2' })
    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k2')
    expect(useAnimationStore.getState().timeMs).toBe(1500)
  })
})

/**
 * A proteção pedida pelo usuário em 2026-08-06, logo depois da primeira
 * entrega: a bancada só é guardada se MUDOU desde o último "Ir para". Sem ela,
 * clicar "Ir para" em três keyframes seguidos guardava o terceiro retrato por
 * cima da cena original — justamente a cena que a guarda existe para salvar.
 */
describe('guarda só o que mudou', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  /** O retrato de um keyframe: os bonecos como estão agora, com outra câmera. */
  const retrato = (figures = bancada()) => ({ figures: [...figures], camera: camera(24) })

  it('a bancada intocada desde o "Ir para" não é guardada por cima', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })
    const original = retrato()

    // Primeiro "Ir para": a cena original vai para a guarda.
    stashWorkbench()
    applyKeyframeToWorkbench(retrato([]))
    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.5)

    // Segundo e terceiro, sem mexer em nada: a guarda não se move.
    stashWorkbench()
    applyKeyframeToWorkbench(original)
    stashWorkbench()
    applyKeyframeToWorkbench(retrato([]))

    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  /** Navegar move a câmera de cena (o ⏮/⏭ da régua) — e isso não é mudança de cena. */
  it('mexer só na câmera não conta como mudança', () => {
    useFiguresStore.getState().addFigure()
    stashWorkbench()
    applyKeyframeToWorkbench(retrato())
    const guardadaAntes = guarda()

    useFiguresStore.getState().setSceneCamera(camera(135))
    stashWorkbench()

    expect(guarda()).toBe(guardadaAntes)
  })

  it('mexer na pose depois do "Ir para" volta a guardar', () => {
    const id = useFiguresStore.getState().addFigure() as string
    stashWorkbench()
    applyKeyframeToWorkbench(retrato())

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.7 })
    stashWorkbench()

    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.7)
  })

  /**
   * O caso mais fundo: recuperar duas vezes devolve à bancada o retrato do
   * keyframe, intocado. O "Ir para" seguinte não pode guardá-lo por cima da
   * cena original, que a essa altura voltou para a guarda.
   */
  it('recuperar duas vezes devolve a bancada ao estado intocado', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    stashWorkbench()
    applyKeyframeToWorkbench(retrato([]))

    restoreStash() // volta à cena original
    restoreStash() // e de novo ao retrato do keyframe

    stashWorkbench()

    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  /** A recuperação em si é mudança: a cena que volta é trabalho a proteger. */
  it('recuperar uma vez deixa a bancada guardável de novo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    stashWorkbench()
    applyKeyframeToWorkbench(retrato([]))
    restoreStash()

    // Agora a guarda tem o retrato do keyframe (zero bonecos) e a bancada, a
    // cena original — que o "Ir para" seguinte tem de proteger.
    stashWorkbench()

    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.5)
  })

  /** A casca de toque tem o caminho próprio, e a mesma proteção. */
  it('o "Ir para" do módulo de poses também só guarda o que mudou', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0.5 })

    goToKeyframeFigures([])
    expect(guarda()?.figures[0].pose['hip.L'].x).toBeCloseTo(0.5)

    goToKeyframeFigures([...bancada()])
    expect(guarda()?.figures).toHaveLength(1)
  })

  it('"Ir para" com a bancada intocada não mexe na guarda, mas anda mesmo assim', () => {
    useFiguresStore.getState().addFigure()
    stashWorkbench()
    applyKeyframeToWorkbench(retrato())
    const guardadaAntes = guarda()

    goToKeyframeWithStash('k3', 900)

    expect(guarda()).toBe(guardadaAntes)
    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k3')
  })
})

/**
 * As setas de quadro (◀ ▶ da régua) levam o instante para a BANCADA — decisão do
 * usuário em 2026-08-06, depois do relato de que elas "travavam a edição no
 * quadro desejado".
 *
 * O que travava era a pré-visualização: navegar publicava a amostra do instante
 * e o `SceneFigures` passava a desenhar ELA no lugar da bancada, então tudo o
 * que se editasse continuava acontecendo — invisível. E a única saída era
 * "Parar", que joga a régua de volta ao zero.
 */
describe('andar de quadro em quadro leva o quadro para a bancada', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  /**
   * Um boneco e dois keyframes de 1000 ms, com poses diferentes em cada ponta —
   * 20 graus está dentro do limite da junta (30), então nada é grampeado no
   * caminho e a conta da metade fecha.
   */
  function comAnimacao(): string {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().addAnimationKeyframe(null, camera(35))
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 20 })
    useFiguresStore.getState().addAnimationKeyframe(null, camera(85))
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 0 })
    return id
  }

  it('a cena de trabalho passa a ser a pose daquele instante, sem pré-visualização', () => {
    const id = comAnimacao()

    expect(goToFrameWithStash(500)).toBe(true)

    // Metade do trecho: metade do caminho entre 0 e 20 graus.
    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(10)
    expect(useFiguresStore.getState().figures[0].id).toBe(id)
    expect(useAnimationStore.getState().preview).toBeNull()
    expect(useAnimationStore.getState().playing).toBe(false)
    expect(useAnimationStore.getState().timeMs).toBe(500)
  })

  /** O enquadramento anda junto, como no "Ir para" — inclusive a lente do painel. */
  it('a câmera de cena vai para a do instante', () => {
    comAnimacao()

    goToFrameWithStash(1000)

    expect(useFiguresStore.getState().sceneCamera.focalMm).toBe(85)
    expect(useCameraStore.getState().focalMm).toBe(85)
  })

  /** A cena que se estava montando não se perde: é o que a guarda (#127) existe para fazer. */
  it('guarda a bancada antes de sobrescrevê-la, e só na primeira vez', () => {
    const id = comAnimacao()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: 33 })

    goToFrameWithStash(500)
    expect(guarda()?.figures[0].pose['shoulder.L'].x).toBeCloseTo(33)

    // Andando mais quadros, a guarda NÃO é sobrescrita pelos próprios quadros.
    goToFrameWithStash(600)
    goToFrameWithStash(700)
    expect(guarda()?.figures[0].pose['shoulder.L'].x).toBeCloseTo(33)
  })

  /**
   * Editar é o ponto do pedido: com a pré-visualização fora do caminho, mexer
   * numa junta muda o que se vê — e a bancada deixa de ser retrato intocado, o
   * que faz a guarda voltar a valer.
   */
  it('editar depois de andar mexe na cena que está à vista', () => {
    const id = comAnimacao()
    goToFrameWithStash(500)

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 25 })

    expect(bancada()[0].pose['hip.L'].x).toBeCloseTo(25)
    expect(useAnimationStore.getState().preview).toBeNull()
  })

  /**
   * Navegar NÃO é editar (PLANO.md > "Interação de pose", item 5): sessenta
   * cliques na seta não podem empurrar o trabalho de verdade para fora do teto
   * de `UNDO_LIMIT` passos. Quem devolve a cena original é a guarda.
   */
  it('andar não empilha passo de undo', () => {
    const id = comAnimacao()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: 33 })
    const passosAntes = useFiguresStore.temporal.getState().pastStates.length

    goToFrameWithStash(300)
    goToFrameWithStash(400)
    goToFrameWithStash(500)

    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(passosAntes)
    // E o rastreio volta ligado: a edição seguinte entra no histórico normal.
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: 44 })
    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(passosAntes + 1)
  })

  /**
   * A marca de "está na bancada" (item 40) é o que o "Regravar" reescreve, então
   * ela só pode acender quando a bancada é MESMO o retrato de um keyframe. Caindo
   * em cima de um, acende nele; no meio de um trecho, apaga.
   */
  it('a marca da bancada acende só quando o quadro é um keyframe', () => {
    comAnimacao()
    const ids = useFiguresStore.getState().animations[0].keyframes.map((keyframe) => keyframe.id)

    goToFrameWithStash(1000)
    expect(useAnimationStore.getState().visitedKeyframeId).toBe(ids[1])

    goToFrameWithStash(1500)
    expect(useAnimationStore.getState().visitedKeyframeId).toBeNull()
  })

  it('sem animação de trabalho, não faz nada', () => {
    useFiguresStore.getState().addFigure()

    expect(goToFrameWithStash(500)).toBe(false)
    expect(guarda()).toBeNull()
    expect(useAnimationStore.getState().timeMs).toBe(0)
  })
})

/**
 * A pose estimada do card (pedido do usuário, 2026-08-07). Decisão do usuário
 * entre as duas leituras possíveis: a estimativa vai para a BANCADA, para ser
 * conferida em 3D e ajustada — o keyframe só muda se o "Regravar" mandar. É a
 * mesma mecânica do "Ir para", com duas diferenças que importam.
 */
describe('applyEstimatedPoseToWorkbench', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  /** Um boneco na bancada, e a estimativa que se quer pôr no lugar dele. */
  function comBancada() {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -90 })
    return id
  }

  it('a estimativa entra na bancada e a cena que estava lá vai para a guarda', () => {
    const id = comBancada()
    const estimada = [{ ...bancada()[0], position: [3, 0, 3] as [number, number, number] }]

    applyEstimatedPoseToWorkbench('k2', estimada, camera(50))

    expect(bancada()[0].position).toEqual([3, 0, 3])
    expect(guarda()?.figures[0].id).toBe(id)
    expect(guarda()?.figures[0].position).toEqual([0, 0, 0])
  })

  /** O enquadramento é o do keyframe, como no "Ir para" — a média não mexe em câmera. */
  it('a câmera de cena passa a ser a do keyframe estimado', () => {
    comBancada()

    applyEstimatedPoseToWorkbench('k2', bancada(), camera(50))

    expect(useFiguresStore.getState().sceneCamera.focalMm).toBe(50)
    expect(useCameraStore.getState().focalMm).toBe(50)
  })

  /**
   * A diferença que importa em relação ao "Ir para": a bancada **NÃO** fica
   * intocada. Ela não é o retrato do keyframe — é uma proposta que ainda não
   * está gravada em lugar nenhum. Marcá-la como intocada faria o "Ir para"
   * seguinte engolir a estimativa sem guardá-la, e deixaria o destaque do
   * "Regravar" apagado justamente quando há mais o que gravar.
   */
  it('a bancada NÃO fica marcada como intocada — a estimativa não está gravada', () => {
    comBancada()

    applyEstimatedPoseToWorkbench('k2', bancada(), camera(50))

    expect(useSceneStashStore.getState().pristineFigures).toBeNull()
  })

  it('o keyframe estimado passa a ser o da bancada (marca do item 40)', () => {
    comBancada()

    applyEstimatedPoseToWorkbench('k2', bancada(), camera(50))

    expect(useAnimationStore.getState().visitedKeyframeId).toBe('k2')
  })

  /** Com a pré-visualização na frente, a estimativa aconteceria invisível (#134). */
  it('tira a pré-visualização da frente', () => {
    comBancada()
    useAnimationStore.getState().setPreview({ figures: [], camera: camera(35) })

    applyEstimatedPoseToWorkbench('k2', bancada(), camera(50))

    expect(useAnimationStore.getState().preview).toBeNull()
  })

  it('"Recuperar cena guardada" devolve a cena que estava na tela antes da estimativa', () => {
    comBancada()
    const antes = bancada()[0].pose['elbow.L']
    const estimada = [
      { ...bancada()[0], pose: { ...bancada()[0].pose, 'elbow.L': { ...antes, x: -45 } } },
    ]

    applyEstimatedPoseToWorkbench('k2', estimada, camera(50))
    expect(bancada()[0].pose['elbow.L'].x).toBe(-45)

    restoreStash()

    expect(bancada()[0].pose['elbow.L']).toEqual(antes)
  })
})

/**
 * Regravar sincroniza a bancada com o keyframe (pedido do usuário, 2026-08-07):
 * o que acabou de ser gravado é EXATAMENTE o que está na tela, então a bancada
 * volta a ser um retrato intocado — e o destaque do "Regravar", que lê essa
 * marca, se apaga sozinho.
 *
 * Sem isto o botão continuava piscando depois de gravar, dizendo que havia algo
 * por gravar quando já não havia.
 */
describe('markWorkbenchRecorded', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useAnimationStore.setState(useAnimationStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  it('a bancada passa a valer como retrato intocado', () => {
    useFiguresStore.getState().addFigure()

    markWorkbenchRecorded()

    expect(useSceneStashStore.getState().pristineFigures).toBe(bancada())
  })

  it('editar depois de gravar desfaz a marca — há algo novo por gravar', () => {
    const id = useFiguresStore.getState().addFigure() as string
    markWorkbenchRecorded()

    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -30 })

    expect(useSceneStashStore.getState().pristineFigures).not.toBe(bancada())
  })

  /** A guarda não é assunto de gravar: o que estava nela continua lá. */
  it('não mexe na cena guardada', () => {
    useFiguresStore.getState().addFigure()
    stashWorkbench()
    const guardada = guarda()

    markWorkbenchRecorded()

    expect(guarda()).toBe(guardada)
  })
})
