import { useAnimationStore } from '../store/animationStore'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore, type Figure } from '../store/figuresStore'
import { useSceneStashStore, type StashedScene } from '../store/sceneStashStore'
import { withoutUndo } from '../store/undoBatch'
import { findWorkingAnimation, keyframeIndexAtTimeMs } from './animation'
import { sampleAnimation } from './animationSampler'
import type { CameraViewState } from '../scene/cameraMove'

/**
 * Quem enche e quem esvazia a guarda temporária da bancada (`sceneStashStore`).
 * Mesmo papel do `figure/lookAtActions.ts` para o solver de mirada: o estado
 * puro de um lado, a ligação com as lojas do outro.
 *
 * O gesto que isto resolve, na fala do usuário: clicar "Ir para" num keyframe
 * sobrescreve a cena que estava na tela, e recuperá-la exigia lembrar do
 * Ctrl+Z. Agora todo "Ir para" guarda o retrato da bancada, e um botão o traz
 * de volta.
 */

/** O par que o "Ir para" põe na bancada — é o mínimo que um keyframe precisa ter. */
interface WorkbenchSnapshot {
  figures: readonly Figure[]
  camera: CameraViewState
}

/**
 * A bancada ainda é o retrato que o último "Ir para" pôs nela, sem ninguém ter
 * mexido? Comparação por REFERÊNCIA do array de bonecos: toda ação do store faz
 * atualização imutável, então qualquer edição — junta, colocação, altura,
 * boneco a mais ou a menos — troca o array (a mesma premissa do `undoEquality`).
 *
 * **A câmera de cena não entra na conta**, de propósito: navegar pela linha do
 * tempo (o ⏮/⏭ da régua, o fim de uma reprodução) escreve nela sem que a cena
 * tenha mudado, e o usuário pediu explicitamente que percorrer os keyframes não
 * conte como mudança.
 */
function benchIsPristine(): boolean {
  const { pristineFigures } = useSceneStashStore.getState()
  return pristineFigures !== null && pristineFigures === useFiguresStore.getState().figures
}

/** O retrato da bancada AGORA — exatamente o que o "Ir para" sobrescreve. */
export function readWorkbenchScene(): StashedScene {
  const state = useFiguresStore.getState()
  // Cópia rasa da LISTA: os bonecos do store são imutáveis (toda ação cria
  // objeto novo), então guardar as referências basta para o retrato não andar
  // junto com a bancada.
  return { figures: [...state.figures], camera: state.sceneCamera, pristine: benchIsPristine() }
}

/**
 * Guarda a bancada antes de sobrescrevê-la. Chamado por todo "Ir para".
 *
 * **Só guarda o que MUDOU** (pedido do usuário, 2026-08-06): com a bancada
 * ainda no retrato que o último "Ir para" pôs nela, não há trabalho a proteger
 * — e guardá-la apagaria a cena original, que é justamente o que a guarda
 * existe para salvar. Sem isso, percorrer três keyframes seguidos deixava na
 * guarda o retrato do terceiro.
 */
export function stashWorkbench(): void {
  if (benchIsPristine()) return
  useSceneStashStore.getState().stashScene(readWorkbenchScene())
}

/**
 * Põe o retrato de um keyframe na bancada — a aplicação em si do "Ir para",
 * executada pelo `AnimationPlayer` — e marca a bancada como intocada.
 *
 * Mora aqui, e não dentro do player, porque nada disto depende do canvas: o
 * player não tem teste automatizado (WebGL não existe em jsdom), e a proteção
 * de "só guarda o que mudou" ficaria descoberta justamente no caminho principal.
 */
export function applyKeyframeToWorkbench(keyframe: WorkbenchSnapshot): void {
  const figuresState = useFiguresStore.getState()
  // A câmera do keyframe vira a câmera de cena DE VERDADE (store, não só o
  // objeto vivo): ir para um keyframe é para poder ajustá-lo, e o ajuste parte
  // do que está gravado.
  figuresState.setSceneCamera(keyframe.camera)
  useCameraStore.getState().setFocalLengthQuietly(keyframe.camera.focalMm)
  // A cena de trabalho passa a ser aquele retrato de verdade, e a
  // pré-visualização sai da frente.
  useAnimationStore.getState().setPreview(null)
  figuresState.loadFiguresFromKeyframe(keyframe.figures)
  markWorkbenchPristine()
}

/** A bancada acabou de receber um retrato de keyframe: nada aí é trabalho a guardar. */
function markWorkbenchPristine(): void {
  useSceneStashStore.getState().markPristine(useFiguresStore.getState().figures)
}

/**
 * Acabou de se GRAVAR a bancada num keyframe ("Regravar"): o que o keyframe
 * guarda agora é exatamente o que está na tela, então a bancada volta a valer
 * como retrato intocado — e o destaque do "Regravar" (`updateHighlight.ts`),
 * que lê essa marca, se apaga sozinho.
 *
 * Sem isto o botão continuava piscando depois de gravar (relato do usuário,
 * 2026-08-07), dizendo que havia algo por gravar quando já não havia.
 *
 * A guarda em si não é assunto de gravar: o que estava nela continua lá.
 */
export function markWorkbenchRecorded(): void {
  markWorkbenchPristine()
}

/**
 * A pose estimada de um keyframe do meio vai para a BANCADA (decisão do
 * usuário, 2026-08-07): dá para conferir em 3D, ajustar, e só então "Regravar"
 * a grava no keyframe. O caminho é o do "Ir para", com a cena que estava na tela
 * indo para a guarda — "Recuperar cena guardada" desfaz sem ter tocado no
 * keyframe.
 *
 * **Duas diferenças em relação ao "Ir para", e as duas importam:**
 *
 * - a bancada **não** fica marcada como intocada. Ela não é o retrato de
 *   keyframe nenhum: é uma proposta que ainda não está gravada. Marcá-la faria
 *   o "Ir para" seguinte engoli-la sem guardar (a guarda só segura o que mudou)
 *   e deixaria o destaque do "Regravar" apagado justamente quando há mais o que
 *   gravar;
 * - a marca do item 40 é escrita aqui, e não por `requestGoToKeyframe`: a
 *   estimativa não passa pelo `AnimationPlayer` — nada nela depende do canvas.
 */
export function applyEstimatedPoseToWorkbench(
  keyframeId: string,
  figures: readonly Figure[],
  camera: CameraViewState,
): void {
  stashWorkbench()
  applyKeyframeToWorkbench({ figures, camera })
  useSceneStashStore.getState().markPristine(null)
  useAnimationStore.setState({ visitedKeyframeId: keyframeId })
}

/**
 * Recupera a cena guardada, pondo no lugar dela a que estava na tela — a troca
 * decidida com o usuário, que faz o botão alternar entre as duas. Devolve
 * `false` quando não havia nada guardado.
 *
 * **O destaque do keyframe visitado (item 40) fica onde está**, por pedido do
 * usuário: é contra ele que o botão alterna, e no painel e na régua a marca
 * continua dizendo qual keyframe está em jogo.
 */
export function restoreStash(): boolean {
  const restored = useSceneStashStore.getState().swapScene(readWorkbenchScene())
  if (!restored) return false

  const figuresState = useFiguresStore.getState()
  // A câmera de cena está FORA do undo (ver `undoPartialize`), então a
  // recuperação inteira cabe num passo só — o mesmo contrato do "Ir para".
  figuresState.setSceneCamera(restored.camera)
  useCameraStore.getState().setFocalLengthQuietly(restored.camera.focalMm)
  // A bancada volta a ser o que se vê: com a pré-visualização na frente, o
  // usuário estaria olhando o retrato da animação e editando outra coisa.
  const animationState = useAnimationStore.getState()
  animationState.pause()
  animationState.setPreview(null)
  figuresState.loadFiguresFromKeyframe(restored.figures)
  // A bancada volta ao estado em que este retrato saiu dela: um keyframe
  // intocado continua intocado. É o que impede o "Ir para" seguinte de guardá-lo
  // por cima da cena original depois de duas recuperações seguidas.
  if (restored.pristine) markWorkbenchPristine()
  else useSceneStashStore.getState().markPristine(null)
  return true
}

/**
 * O "Ir para" do painel de Animação: guarda a bancada e só então manda o
 * `AnimationPlayer` carregar o retrato do keyframe. Os dois passos moram juntos
 * para não haver caminho que sobrescreva a cena sem guardá-la antes.
 */
export function goToKeyframeWithStash(keyframeId: string, timeMs: number): void {
  stashWorkbench()
  useAnimationStore.getState().requestGoToKeyframe(keyframeId, timeMs)
}

/**
 * As setas de quadro da régua (◀ ▶): levam o instante inteiro — pose e câmera —
 * para a BANCADA, em vez de publicar uma pré-visualização (decisão do usuário,
 * 2026-08-06; DECISOES.md #133).
 *
 * O relato foi que as setas "travavam a edição no quadro desejado". O que
 * travava era a pré-visualização: o `SceneFigures` desenha `preview` no lugar da
 * bancada quando ela existe, então quem editava uma junta continuava editando a
 * cena de verdade — invisível, atrás do retrato da animação. E a única saída era
 * "Parar", que devolve a régua ao zero.
 *
 * Levando o quadro para a bancada, o que se vê é o que se edita. As três
 * proteções que o "Ir para" já tinha valem igual: a guarda (#127) segura a cena
 * que se estava montando, a marca de "intocado" impede que o quadro seguinte
 * guarde o anterior por cima dela, e a escrita fica **fora do undo** — navegar
 * não é editar, e um clique de seta não pode empurrar o trabalho para fora do
 * histórico.
 *
 * Nada disto depende do canvas: diferente do comando `seek`, que ia ao
 * `AnimationPlayer`, aqui a amostragem é pura e o teste alcança o caminho todo.
 *
 * Devolve `false` quando não há animação de trabalho (ou ela está vazia) — e aí
 * nem a régua anda.
 */
export function goToFrameWithStash(timeMs: number): boolean {
  const animation = findWorkingAnimation(useFiguresStore.getState().animations)
  if (!animation) return false

  const instant = Math.max(0, timeMs)
  const sample = sampleAnimation(animation, instant)
  if (!sample) return false

  stashWorkbench()
  const animationState = useAnimationStore.getState()
  animationState.pause()
  animationState.setTimeMs(instant)
  // A marca de "está na bancada" (item 40) é o que o "Regravar" reescreve, então
  // ela só pode acender quando a bancada é MESMO o retrato de um keyframe. Um
  // quadro no meio de um trecho é uma pose intermediária: apaga.
  const index = keyframeIndexAtTimeMs(animation, instant)
  useAnimationStore.setState({
    visitedKeyframeId: index >= 0 ? animation.keyframes[index].id : null,
  })
  withoutUndo(() => applyKeyframeToWorkbench(sample))
  return true
}

/**
 * O "Ir para" da casca de toque (aba Keyframes do módulo de poses), que carrega
 * o retrato na hora e não tem câmera de cena a aplicar — o módulo não oferece
 * uma (PLANO.md, item 44).
 */
export function goToKeyframeFigures(figures: readonly Figure[]): void {
  stashWorkbench()
  useFiguresStore.getState().loadFiguresFromKeyframe(figures)
  markWorkbenchPristine()
}
