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
import {
  clearFigureLocks,
  copyFigureLocks,
  getLockedJoints,
  isJointLocked,
  mergeLockedJoints,
  pruneJointLocks,
  toggleJointLock as toggleLockInMap,
  type JointLockMap,
} from '../figure/jointLocks'
import {
  clampAnimationSpeed,
  clampKeyframeDuration,
  freeKeyframeLabel,
  createWorkingAnimation,
  findWorkingAnimation,
  planKeyframeSplit,
  uniqueKeyframeLabel,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_KEYFRAME_DURATION_MS,
  WORKING_ANIMATION_ID,
  type Animation,
  type AnimationKeyframe,
} from '../animation/animation'
import { sampleAnimation, splitCameraView } from '../animation/animationSampler'
import { remapImportedKeyframes, substituteImportedKeyframes } from '../animation/animationRemap'
import type { ImportedAnimation } from '../persistence/animationsFile'
import {
  ANIMATION_CLIPS,
  resolveClipFigure,
  type AnimationClipKey,
  type ResolvedClipFigure,
} from '../animation/animationClips'
import { DEFAULT_SCENE_CAMERA, type CameraViewState } from '../scene/cameraMove'
import { blendPoses, type BlendablePose } from '../figure/poseBlend'
import { captureFigurePose, type SavedPose } from '../figure/poseLibrary'
import {
  buildKeyframesFromClip,
  captureClipFromAnimation,
  clipRoleCount,
  type SavedClip,
} from '../animation/clipLibrary'
import { seatOnGround } from '../figure/poseGround'
import {
  getMirroredJointName,
  mirrorPoseFull,
  mirrorPoseSide,
  mirrorRotation,
  swapPoseSides,
  type Side,
} from '../figure/poseMirror'
import { JOINT_GROUPS, type JointGroupKey } from '../figure/jointGroups'
import { resolvePosePreset, resolvePosePresetPlacement, type PosePresetKey } from '../figure/posePresets'
import {
  getPosePairing,
  resolvePairedOffset,
  resolvePairedRotation,
  type PosePairing,
} from '../figure/posePairs'
import { resolveRandomPose } from '../figure/randomPose'
import { loadWorkspaceFromLocalStorage } from '../persistence/autosave'
import { normalizeHexColor } from '../scene/hexColor'
import { controlPointCount, controlPointPosition, propGroundOffset } from '../props/propGeometry'
import {
  DEFAULT_PROP_COLOR,
  DEFAULT_PROP_SIZE,
  MAX_PROPS,
  clampPropSize,
  clampVertexOffset,
  normalizePropColor,
  withVertexOffset,
  type PropShape,
  type SceneProp,
  type Vec3,
} from '../props/sceneProp'

export const MAX_FIGURES = 5

/**
 * O que fazer com a animação lida de um arquivo (fase 12): trocar a da bancada
 * por ela, emendá-la no fim do que já está lá, ou ENXERTÁ-LA a partir de um
 * keyframe, trocando só as poses dos bonecos escolhidos (e, se quiserem, as
 * câmeras) — pedido do usuário, 2026-07-31, ver `substituteImportedKeyframes`.
 */
export type AnimationImportMode = 'replace' | 'append' | 'substitute'

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
  /**
   * Topo da tela, para o bookmark guardar também a INCLINAÇÃO da câmera
   * (ângulo holandês, DECISOES.md #46). Opcional: bookmark gravado antes
   * disso não tem o campo, e a câmera volta em pé — que é como ele foi
   * salvo.
   */
  up?: readonly [number, number, number]
}

/**
 * Cores PADRÃO dos bonecos — 5 tons de alto contraste (vermelho, azul, verde,
 * laranja, roxo), atribuídas em rodízio a cada boneco novo para que dois
 * bonecos não nasçam da mesma cor.
 *
 * Desde DECISOES.md #39 esta lista NÃO é mais o conjunto de cores permitidas:
 * o usuário escolhe qualquer cor pelo seletor do painel, e `setColor` valida
 * só o FORMATO. Duas consequências que valem lembrar: dois bonecos podem ter
 * a mesma cor (é escolha de quem monta a cena), e acrescentar um boneco não
 * depende mais de sobrar cor na paleta.
 */
export const COLOR_PALETTE: readonly string[] = [
  '#e04040',
  '#4060e0',
  '#40a840',
  '#e08020',
  '#8040c0',
]

/** Cor usada quando um arquivo traz uma cor ilegível (ver `sceneSerialization.ts`). */
export const DEFAULT_FIGURE_COLOR = COLOR_PALETTE[0]

/**
 * Cor livre do boneco: valida o FORMATO, não uma lista de valores (DECISOES.md
 * #39). A regra em si mora em `scene/hexColor.ts` desde os objetos de cena, que
 * precisam da mesma validação sem poder importar este store (seria ciclo).
 */
export const normalizeFigureColor = normalizeHexColor

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
 * câmera/contador de instantâneo) — o "catálogo de cenas" do workspace (ver
 * PLANO.md > "Workspace: catálogo de cenas" e DECISOES.md #11). Cada
 * snapshot é exatamente o que vira um `.json` ao exportar aquela cena.
 */
export interface SceneSnapshotData {
  figures: Figure[]
  nextFigureSeq: number
  /**
   * Objetos de cena (item 42) — cenário, e portanto conteúdo da CENA: cada
   * snapshot guarda os seus, como guarda os bonecos e o enquadramento.
   */
  props: SceneProp[]
  nextPropSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  nextSnapshotNumber: number
  /** A câmera de cena faz parte do retrato: cada cena guarda o próprio enquadramento. */
  sceneCamera: CameraViewState
}

export interface SceneSnapshot {
  id: string
  name: string
  data: SceneSnapshotData
}

export interface ApplyPosePresetOptions {
  /**
   * Montar o par automaticamente numa pose em dupla (DECISOES.md #41).
   * Padrão `true` — o comportamento que o usuário pediu lá. A caixa do painel
   * de Propriedades é que passa `false`, para quem prefere montar o encontro à
   * mão sem que o segundo boneco seja reposicionado.
   */
  pairPartner?: boolean
}

export interface FiguresState {
  figures: Figure[]
  /**
   * Objetos de cena (item 42): cubo, cilindro, esfera, cone, plano e rampa,
   * com tamanho em metros e vértices arrastáveis (`props/sceneProp.ts`).
   *
   * Vivem NESTE store, e não num próprio, pela mesma razão dos bookmarks de
   * câmera e do catálogo de cenas: o `zundo` mantém uma pilha de undo por
   * store, e só um store único dá uma linha do tempo cronológica combinada
   * (DECISOES.md #8). Mover um objeto e mover um boneco têm de desfazer na
   * ordem em que foram feitos.
   */
  props: SceneProp[]
  nextPropSeq: number
  selectedFigureId: string | null
  /**
   * Objeto de cena selecionado. Exclusivo com `selectedFigureId` e com a
   * seleção da câmera de cena (`cameraStore`) — quem garante isso é
   * `store/selection.ts`, o ponto único por onde toda seleção passa.
   */
  selectedPropId: string | null
  selectedJointName: string | null
  /** Eixo com foco para os atalhos de teclado (setas) quando uma junta com mais de um DOF está selecionada. */
  activeAxis: Axis | null
  nextFigureSeq: number
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  environment: EnvironmentSettings
  /**
   * A CÂMERA DE CENA (fase 11): um elemento da cena, separado da navegação do
   * viewport. É dela que saem os keyframes, o PNG e o MP4 — o viewport passa a
   * ser só a bancada de trabalho. Persistida com a cena (autosave, snapshots e
   * arquivo da cena), mas FORA do histórico de undo, como a navegação: mover a câmera é
   * enquadrar, não editar conteúdo (decidido com o usuário — DECISOES.md).
   */
  sceneCamera: CameraViewState
  sceneName: string
  /** Próximo número de sequência de instantâneo (`snap001`, `snap002`…). Não entra no histórico de undo — ver `consumeSnapshotNumber`. */
  nextSnapshotNumber: number
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
  /**
   * Biblioteca de poses do usuário (DECISOES.md #42) — do WORKSPACE, não de
   * uma cena: é o que permite montar uma pose numa cena e reaplicá-la em
   * qualquer boneco de qualquer outra.
   */
  poseLibrary: SavedPose[]
  nextPoseSeq: number
  /**
   * Biblioteca de TRECHOS do usuário (item 39) — faixas de keyframes salvas
   * com nome, reaplicáveis em qualquer animação de qualquer cena. Do
   * WORKSPACE, como a biblioteca de poses e as animações: vai para um
   * `clips.json` da pasta, e não para o arquivo da cena.
   */
  clipLibrary: SavedClip[]
  nextClipSeq: number
  /**
   * Animações do usuário (DECISOES.md #52) — também do WORKSPACE, e pela mesma
   * razão da biblioteca de poses: cada keyframe carrega um retrato completo da
   * cena, então uma animação é autossuficiente e vale a partir de qualquer
   * cena. Não viaja no arquivo da cena: ele continua sendo só a cena, sem
   * linha do tempo dentro dele.
   */
  animations: Animation[]
  nextAnimationSeq: number
  /**
   * Juntas travadas por boneco (DECISOES.md #42). Estado de TRABALHO, decisão
   * do usuário: vive na sessão e no autosave, não entra no arquivo da cena nem no
   * histórico de undo.
   */
  jointLocks: JointLockMap
  /**
   * Espelhar edições ao vivo: cada ajuste numa junta pareada escreve a
   * reflexão sagital na junta do outro lado. Como as travas (#42), é MODO DE
   * TRABALHO — fica fora do `partialize`, e por isso fora do histórico de
   * undo. Diferente delas, não sobrevive a recarregar a página: um modo que
   * reescreve o outro lado a cada edição não pode voltar ligado sem ninguém
   * ter pedido.
   */
  liveMirrorEnabled: boolean
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
   * Versão em lote de `setJointRotation` — mesmas regras (clamp, trava,
   * espelho ao vivo) num único `set`, e portanto num único passo de undo.
   * Existe para o arrasto de junta (`dragSolver.ts`), que escreve a cadeia
   * inteira de ancestrais a cada evento de mouse — uma chamada por junta
   * empilharia até 5 passos de undo por pixel arrastado.
   */
  setJointRotations: (id: string, rotations: Record<string, Partial<JointRotation>>) => void
  /** Liga/desliga o espelho ao vivo (ver `liveMirrorEnabled`). */
  toggleLiveMirror: () => void
  /**
   * Baixa ou levanta o boneco até a pose encostar no chão, sem tocar na pose
   * nem no lugar dele — o cálculo de `poseGround.ts`, que antes era feito à
   * mão a cada pose nova.
   */
  seatFigureOnGround: (id: string) => void
  /**
   * Devolve UMA junta à pose de referência (fase 9, item 6). A referência é a
   * pose "Em pé" (`posePresets.ts`), não zero cru — há eixos cujo neutro do
   * modelo não é zero, como a torção do antebraço `elbow.*.y` (DECISOES.md
   * #25). Para o `root`, zera só a rotação de colocação (a posição fica).
   */
  resetJointRotation: (id: string, jointName: string) => void
  /**
   * Devolve um grupo inteiro de juntas à pose neutra — braço, perna, tronco ou
   * cabeça (`JOINT_GROUPS`). Mesma regra do reset por junta: o destino é a
   * pose EM PÉ, não zeros literais, e junta travada não se mexe.
   */
  resetJointGroup: (id: string, group: JointGroupKey) => void
  addCameraBookmark: (bookmark: Omit<CameraBookmark, 'id'>) => string
  removeCameraBookmark: (id: string) => void
  /** Move a câmera de cena — chamado pelo gizmo, pelos comandos do painel e pelo animador. */
  setSceneCamera: (view: CameraViewState) => void
  setBackground: (background: BackgroundTone) => void
  toggleGrid: () => void
  renameScene: (name: string) => void
  /** Consome (lê e avança) o próximo número de instantâneo — ver PLANO.md > "Exportação de imagem". */
  consumeSnapshotNumber: () => number
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
  /**
   * Renomeia um snapshot do catálogo. **Sem botão no painel de Cenas** — a
   * ação existe, é testada, e renomear uma cena salva continua sendo feito
   * salvando por cima com outro nome. Mesmo caso do `renameSavedPose`, que em
   * 2026-07-31 ganhou o botão que faltava; este continua na fila.
   */
  renameSceneSnapshot: (id: string, name: string) => void
  removeSceneSnapshot: (id: string) => void
  /** Substitui a cena de trabalho por dados lidos de um `.json` importado — não é um snapshot salvo do catálogo. */
  loadSceneWorkingState: (data: SceneSnapshotData & { name: string }) => void
  /**
   * Aplica uma pose lida de um arquivo de pose avulsa (`figurePoseFile.ts`,
   * DECISOES.md #81) — o formato que faz a ponte com o celular, e desde o #87 o
   * único caminho de boneco em arquivo.
   *
   * Pelo contrato daquele arquivo: a inclinação do boneco (`rotation`) também
   * vem da pose, e a colocação recebe o Y do arquivo mantendo X/Z onde estão
   * (agachar e pular são pose; andar para o lado é composição). Identidade, cor
   * e visibilidade continuam sendo do boneco de destino.
   *
   * Substituiu o `applyImportedPose` do exportar/importar boneco (#87), de quem
   * era um superconjunto estrito — aquele aplicava só altura e pose.
   */
  applyImportedFigurePose: (
    id: string,
    imported: {
      height: number
      positionY: number
      rotation: JointRotation
      pose: Record<string, JointRotation>
    },
  ) => void
  /** Adiciona bookmarks importados aos já existentes (nunca substitui); nomes duplicados recebem um sufixo automático. */
  importCameraBookmarks: (bookmarks: readonly Omit<CameraBookmark, 'id'>[]) => void
  /** Substitui o catálogo de cenas por um workspace lido de uma pasta; carrega a cena ativa na cena de trabalho, se houver. */
  loadWorkspaceCatalog: (
    scenes: SceneSnapshot[],
    activeSceneId: string | null,
    jointLimits?: JointLimitOverrides,
    poses?: readonly SavedPose[],
    animations?: readonly Animation[],
    clips?: readonly SavedClip[],
  ) => void
  /**
   * Guarda a pose do boneco na biblioteca, com nome. Junto com as juntas vai o
   * ASSENTAMENTO (inclinação e altura do quadril), para que uma pose deitada
   * volte deitada — ver `poseLibrary.ts`. Retorna o id gerado, ou `null` se o
   * boneco não existir.
   */
  saveFigurePose: (id: string, name?: string) => string | null
  /**
   * Copia a pose de um boneco para outro. Vai o ASSENTAMENTO junto (juntas,
   * inclinação do corpo e altura do quadril, escalada para a altura de quem
   * recebe); não vão o lugar no chão, a altura, a cor nem o nome — isso é
   * identidade e encenação de cada boneco. Mesma regra da biblioteca de poses
   * (DECISOES.md #42), e as juntas travadas do destino continuam intactas.
   */
  /**
   * Copia a pose de um boneco para outro. Sem `group`, é a pose inteira, com o
   * assentamento (mesmo caminho da biblioteca de poses). Com `group`, só
   * aquelas juntas — e aí a colocação de quem recebe NÃO é tocada: o
   * assentamento é da pose inteira, e aplicá-lo por causa de um membro tiraria
   * o boneco do chão onde ele estava.
   */
  copyFigurePose: (fromId: string, toId: string, group?: JointGroupKey) => void
  /** Aplica uma pose da biblioteca a um boneco — mesmas regras de `applyPosePreset` (X/Z preservados, juntas travadas intactas). */
  applySavedPose: (figureId: string, poseId: string) => void
  /**
   * Aplica uma pose que veio DE FORA da biblioteca — hoje, da área de
   * transferência (`poseClipboardStore`), que vive só em memória e por isso não
   * pode guardar nada aqui dentro. As regras de aplicação são exatamente as de
   * `applySavedPose`: é o mesmo `withPose`, com as mesmas juntas travadas e a
   * mesma reescala do assentamento.
   */
  pasteFigurePose: (figureId: string, pose: SavedPose) => void
  /**
   * Mistura entre duas poses (DECISOES.md #43): `amount` de 0 a 1 entre a
   * pose-base e a pose alvo, as duas já resolvidas para este boneco pelo
   * chamador (`poseBlend.ts`). A base é capturada UMA vez, no começo do
   * arrasto, e não a cada evento — senão cada passo partiria do resultado
   * anterior e o slider nunca voltaria à pose original.
   *
   * Não é animação: o que fica é a pose estática resultante, como qualquer
   * outra edição (undo normal, juntas travadas preservadas).
   */
  blendPose: (figureId: string, base: BlendablePose, target: BlendablePose, amount: number) => void
  renameSavedPose: (poseId: string, name: string) => void
  removeSavedPose: (poseId: string) => void
  /**
   * Substitui a biblioteca pela lida de um workspace (já sanitizada). Como
   * `loadClipLibrary` e `loadAnimationLibrary`, só os testes chamam: no app o
   * autosave entra pelo estado INICIAL do store e a pasta de workspace entra
   * por `loadWorkspaceCatalog`, que traz tudo num passo só.
   */
  loadPoseLibrary: (poses: readonly SavedPose[]) => void
  /**
   * Cria uma animação vazia e devolve o id gerado.
   *
   * **Nenhum botão chama isto** desde o item 36: o gesto "criar animação antes
   * de capturar" deixou de existir, e quem cria a de trabalho é a própria
   * captura (`withTargetAnimation`). Continua aqui porque é como os testes
   * montam uma animação de BIBLIOTECA para exercitar as ações por id — pela UI
   * isso exige capturar e depois `saveAnimationToLibrary`.
   *
   * Não ligue de volta a um botão sem reabrir o item 36: era ele que obrigava a
   * batizar uma animação antes de poder capturar o primeiro keyframe.
   */
  createAnimation: (name?: string) => string
  renameAnimation: (id: string, name: string) => void
  removeAnimation: (id: string) => void
  /**
   * Guarda uma cópia da animação de trabalho na biblioteca, com nome, para
   * reabrir depois (item 36). Devolve o id da cópia, ou `null` se não houver
   * animação de trabalho com keyframes — salvar o vazio não guarda trabalho
   * nenhum.
   */
  saveAnimationToLibrary: (name?: string) => string | null
  /**
   * Abre uma animação da biblioteca: o conteúdo dela (keyframes, velocidade e
   * nome) **substitui** o da animação de trabalho, num único passo de undo —
   * mesmo contrato de carregar um snapshot de cena (DECISOES.md #11). A salva
   * fica intacta: o que se edita daqui em diante é a de trabalho.
   */
  openAnimationFromLibrary: (savedId: string) => boolean
  /** Regrava uma animação salva com o conteúdo atual da de trabalho, mantendo o nome dela. */
  overwriteSavedAnimation: (savedId: string) => boolean
  /**
   * Captura um keyframe: o retrato da cena inteira (todos os bonecos) mais a
   * câmera viva, que só o `CameraRig` sabe ler. Devolve o id do keyframe, ou
   * `null` se não houver boneco nenhum em cena — um retrato vazio não é
   * animação, é engano.
   *
   * Com `animationId` nulo (ou apontando para uma animação que não existe
   * mais), a captura **cria a animação de trabalho** e põe o keyframe nela, no
   * mesmo passo de undo (item 36): ninguém precisa batizar uma animação antes
   * de começar, e um Ctrl+Z não deixa uma animação vazia para trás.
   */
  addAnimationKeyframe: (animationId: string | null, camera: CameraViewState) => string | null
  /**
   * Insere um keyframe no instante `timeMs` da linha do tempo, com o retrato
   * que a animação já mostrava ali, repartindo o trecho cortado entre as duas
   * metades — a animação continua a mesma, e o keyframe novo é só um ponto de
   * ajuste. Devolve o id, ou `null` quando não há trecho para cortar (em cima
   * de um keyframe, fora da linha do tempo, ou com menos de dois keyframes).
   */
  insertAnimationKeyframeAt: (animationId: string, timeMs: number) => string | null
  /**
   * Copia para este keyframe a câmera do vizinho — `-1` o anterior, `1` o
   * posterior —, sem tocar na pose nem na duração. Nas pontas não faz nada.
   */
  copyAnimationKeyframeCamera: (animationId: string, keyframeId: string, offset: -1 | 1) => void
  /**
   * O simétrico do anterior (item 28): copia para este keyframe o RETRATO DOS
   * BONECOS do vizinho, sem tocar na câmera nem na duração — é o gesto de
   * segurar a pose e deixar só a câmera se mover. Nas pontas não faz nada.
   */
  copyAnimationKeyframeFigures: (animationId: string, keyframeId: string, offset: -1 | 1) => void
  /**
   * Carimba a câmera de cena ATUAL numa faixa de keyframes, de `fromIndex` a
   * `toIndex` inclusive (pedido do usuário, 2026-07-31). É o gesto de "achei o
   * enquadramento certo, quero ele na animação inteira" — sem ele, a única
   * saída era regravar keyframe a keyframe, e regravar troca a pose junto.
   *
   * A faixa é normalizada (invertida se vier ao contrário) e grampeada à lista;
   * a padrão, no painel, é a animação toda. Poses e durações não são tocadas.
   * Devolve `false` sem mexer em nada quando a animação não existe ou está
   * vazia.
   */
  applySceneCameraToKeyframes: (animationId: string, fromIndex: number, toIndex: number) => boolean
  /**
   * Duplica um keyframe logo depois dele (item 28). Dois retratos iguais em
   * sequência são uma PAUSA — a única forma de fazer uma hoje é recapturar a
   * cena. A cópia herda duração e câmera, e devolve o id novo (ou `null` se o
   * keyframe não existir).
   */
  duplicateAnimationKeyframe: (animationId: string, keyframeId: string) => string | null
  /**
   * "Fechar o ciclo" (item 27): copia o PRIMEIRO keyframe para o fim da linha
   * do tempo, para que a última transição volte ao ponto de partida — sem isso
   * nenhum ciclo de caminhada emenda. A cópia chega com a duração do último
   * trecho, que é a cadência em vigor no fim. Devolve o id novo, ou `null` com
   * menos de dois keyframes (não há ciclo a fechar).
   */
  closeAnimationCycle: (animationId: string) => string | null
  /** Regrava um keyframe existente com o estado atual da cena e da câmera. */
  updateAnimationKeyframe: (animationId: string, keyframeId: string, camera: CameraViewState) => void
  removeAnimationKeyframe: (animationId: string, keyframeId: string) => void
  /** Move o keyframe `delta` posições na lista; nas pontas, não faz nada. */
  moveAnimationKeyframe: (animationId: string, keyframeId: string, delta: number) => void
  setAnimationKeyframeDuration: (animationId: string, keyframeId: string, durationMs: number) => void
  /**
   * Rótulo do grupo do keyframe (item 38). Texto vazio tira o keyframe do
   * grupo; um rótulo que já existe em OUTRO trecho ganha sufixo numérico, para
   * não haver dois blocos com o mesmo título (ver `uniqueKeyframeLabel`).
   */
  setAnimationKeyframeLabel: (animationId: string, keyframeId: string, label: string) => void
  /**
   * Redutor/acelerador de toda a linha do tempo — 0,5 é metade da velocidade,
   * 1,15 é 15% mais rápido. Vale para a reprodução na tela E para o vídeo
   * exportado, e é propriedade da ANIMAÇÃO: entra no undo e viaja no
   * `animations.json`, para que a mesma animação renda o mesmo vídeo amanhã.
   */
  setAnimationSpeed: (animationId: string, speed: number) => void
  /**
   * Acrescenta um trecho predefinido (`animationClips.ts`) ao FINAL da linha
   * do tempo, um keyframe por passo, todos com a MESMA câmera recebida (a
   * viva no momento — decidido com o usuário; o enquadramento durante o
   * trecho é de quem monta). O trecho é ancorado no boneco do papel A: parte
   * da posição dele e "para a frente" é o heading dele. A cena de trabalho
   * NÃO é tocada — só a animação muda, numa única edição de undo. Devolve
   * `false` sem mexer em nada se faltar animação, boneco, ou se uma cena em
   * dupla vier sem dois bonecos DISTINTOS.
   */
  appendAnimationClip: (
    animationId: string | null,
    clipKey: AnimationClipKey,
    camera: CameraViewState,
    /**
     * Quem faz o papel A. Nos trechos INDIVIDUAIS aceita vários bonecos (item
     * 37): todos executam o trecho ao mesmo tempo, cada um ancorado no próprio
     * lugar e no próprio heading. Em dupla vale um só.
     */
    figureAIds: string | readonly string[],
    figureBId?: string,
    /** Rótulo do grupo que os keyframes do trecho recebem (item 38). */
    label?: string,
  ) => boolean
  /**
   * Fecha o ciclo entre o "Movimento A→B" do painel de câmera e o animador
   * (item 34): dois keyframes com a CENA ATUAL e as duas câmeras do movimento,
   * acrescentados ao final da linha do tempo numa única edição de undo. O
   * segundo keyframe é o de chegada, e é ele que carrega a duração do trecho.
   *
   * Não é preciso animação nenhuma: como a captura, isto cria a de trabalho
   * (item 36). Devolve `false` sem mexer em nada se não houver boneco em cena.
   */
  appendCameraMoveKeyframes: (
    animationId: string | null,
    from: CameraViewState,
    to: CameraViewState,
    durationMs?: number,
  ) => boolean
  /**
   * Guarda uma faixa de keyframes da animação de trabalho como TRECHO
   * reutilizável (item 39), com nome. Guarda os keyframes literais **sem a
   * câmera**; ao inserir, o trecho congela a câmera viva, como os de fábrica.
   * Devolve o id, ou `null` se a faixa não der um trecho (menos de dois
   * keyframes).
   */
  saveClipFromRange: (animationId: string, fromIndex: number, toIndex: number, name?: string) => string | null
  renameSavedClip: (clipId: string, name: string) => void
  removeSavedClip: (clipId: string) => void
  /**
   * Acrescenta um trecho salvo ao FINAL da linha do tempo, reancorado nos
   * bonecos escolhidos (item 39). `casts` é uma lista de elencos: um trecho de
   * um papel só pode ser aplicado a vários bonecos de uma vez, e aí cada um o
   * executa a partir de onde está (mesma regra do item 37).
   */
  appendSavedClip: (
    animationId: string | null,
    clipId: string,
    camera: CameraViewState,
    casts: readonly (readonly string[])[],
    label?: string,
  ) => boolean
  /**
   * Substitui a biblioteca de trechos pela lida de um workspace (já
   * sanitizada). Como `loadAnimationLibrary`, só os testes chamam: no app, o
   * autosave entra pelo estado INICIAL do store e a pasta de workspace entra
   * por `loadWorkspaceCatalog`, que traz cenas, poses, trechos e animações num
   * passo só. São o caminho de granularidade fina do mesmo carregamento.
   */
  loadClipLibrary: (clips: readonly SavedClip[]) => void
  /** Substitui as animações pelas lidas de um workspace (já sanitizadas) — ver `loadClipLibrary`. */
  loadAnimationLibrary: (animations: readonly Animation[]) => void
  /**
   * Traz para a bancada a animação lida de um arquivo JSON (fase 12). A
   * biblioteca não entra na história: o arquivo SUBSTITUI a animação de
   * trabalho ou é ANEXADO ao final dela — decisão de quem importa, no diálogo.
   *
   * Com `assignment`, a animação é remapeada para os bonecos da cena
   * (`animationRemap.ts`): os keyframes passam a ser executados pelo elenco que
   * já está ali, e não pelos bonecos gravados. Sem ele, os keyframes entram
   * literais, com os bonecos do arquivo — o modo "recriar", que é o único fiel
   * a nomes, cores e alturas de origem e a única saída quando a cena não tem
   * bonecos suficientes.
   *
   * No modo `substitute` (pedido do usuário, 2026-07-31) o arquivo não escreve
   * a linha do tempo: ele é ENXERTADO nela a partir de `startIndex`, trocando
   * as poses dos bonecos que receberam papel — e as câmeras, se
   * `replaceCamera`. Tudo o mais fica como estava. Esse modo exige `assignment`
   * (é ele que diz quem sai e quem entra) e uma bancada com keyframes.
   *
   * Tudo num `set` só: importar é UM passo de undo, como abrir uma animação da
   * biblioteca. Devolve `false` sem mexer em nada quando não há o que importar
   * (arquivo sem keyframes, ou remapeamento sem nenhum papel com boneco).
   */
  importAnimation: (
    imported: ImportedAnimation,
    options: {
      mode: AnimationImportMode
      assignment?: readonly string[] | null
      /**
       * Só no modo `substitute`: índice do keyframe da bancada onde o arquivo
       * começa a entrar, e se as câmeras gravadas entram junto com as poses.
       */
      startIndex?: number
      replaceCamera?: boolean
    },
  ) => boolean
  /**
   * Põe a cena de trabalho no retrato de um keyframe — é o "ir para" do
   * animador, que existe para poder AJUSTAR aquele keyframe. Edição de
   * conteúdo normal: entra no undo, como carregar um snapshot de cena.
   */
  loadFiguresFromKeyframe: (figures: readonly Figure[]) => void
  /**
   * Trava/destrava uma junta do boneco (DECISOES.md #42). Junta travada não
   * muda por nada automático: slider, gizmo, teclado, IK, sorteio, espelho e
   * aplicar pose. A `root` não pode ser travada (é colocação, não pose).
   */
  toggleJointLock: (figureId: string, jointName: string) => void
  /** Destrava todas as juntas do boneco. */
  clearJointLocks: (figureId: string) => void
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
   *
   * Exceção: se a pose for de dupla (`posePairs.ts`) e houver EXATAMENTE dois
   * bonecos em cena, o outro recebe a pose correspondente e é posicionado à
   * distância certa — as duas metades numa única edição, e um só Ctrl+Z
   * desfaz o par inteiro.
   */
  /**
   * Aplica uma pose de fábrica. `pairPartner: false` desliga a montagem
   * automática do par (DECISOES.md #41) — quem recebeu a pose muda, e o outro
   * boneco fica intocado. Omitido, o par continua sendo montado.
   */
  applyPosePreset: (id: string, key: PosePresetKey, options?: ApplyPosePresetOptions) => void
  /** Aplica uma pose de mão a UM lado, preservando punho, braço e a outra mão. */
  applyHandPreset: (id: string, side: Side, key: HandPresetKey) => void
  /**
   * Sorteia uma pose inteira dentro dos limites das juntas (DECISOES.md #35).
   * Só o corpo entra no sorteio: mãos ficam abertas, e onde o boneco está e
   * para onde encara não mudam.
   */
  applyRandomPose: (id: string) => void
  /**
   * Copia o lado indicado, espelhado, para o outro — só juntas `.L`/`.R`.
   * `scopeJoint` restringe a operação àquela junta e seus descendentes (ex.:
   * `shoulder.R` mexe só no braço); sem ele, vale o boneco inteiro.
   */
  mirrorSide: (id: string, from: Side, scopeJoint?: string | null) => void
  /** Troca as poses dos dois lados, cada uma espelhada — mesmo `scopeJoint` de `mirrorSide`. */
  swapSides: (id: string, scopeJoint?: string | null) => void
  /**
   * Espelho COMPLETO do boneco (pedido do usuário): troca os membros de lado e
   * reflete também as juntas SEM par (tronco, pescoço, cabeça).
   *
   * Sem `scopeJoint` de propósito, ao contrário das duas de cima: "o boneco
   * todo" é o que a operação promete, e restringi-la à junta selecionada faria
   * o botão mentir. A colocação (`position`/`rotation`) não é tocada — ver
   * `mirrorPoseFull`.
   */
  mirrorWholeFigure: (id: string) => void

  // -------------------------------------------------------------------------
  // Objetos de cena (item 42)
  // -------------------------------------------------------------------------

  /** Cria um objeto da forma pedida, no tamanho padrão dela, já apoiado no chão. `null` no limite de `MAX_PROPS`. */
  addProp: (shape: PropShape, name?: string) => string | null
  removeProp: (id: string) => void
  duplicateProp: (id: string) => string | null
  renameProp: (id: string, name: string) => void
  /**
   * Troca a forma do objeto. **Os vértices arrastados são perdidos**, e não há
   * como não perdê-los: o desvio é indexado por ponto de controle, e o ponto 3
   * de um cubo não é o ponto 3 de uma esfera. O tamanho, esse, é preservado —
   * é medida em metros, igual para todas as formas.
   */
  setPropShape: (id: string, shape: PropShape) => void
  setPropColor: (id: string, color: string) => void
  setPropPosition: (id: string, position: Vec3) => void
  setPropRotation: (id: string, rotation: Partial<JointRotation>) => void
  /** Tamanho em METROS por eixo (o gizmo de escala converte antes de chamar aqui). */
  setPropSize: (id: string, size: Vec3) => void
  /** Conteúdo: desligado, o objeto some inclusive do PNG e do MP4. */
  togglePropVisible: (id: string) => void
  /** Some só da bancada, continuando a sair na captura (ver `SceneProp.hiddenInEditor`). */
  togglePropHiddenInEditor: (id: string) => void
  /** Travar/destravar: travado, o objeto não pega clique no viewport nem aceita edição. */
  togglePropLocked: (id: string) => void
  /** Oculta (ou revela) TODOS os objetos na bancada de uma vez — o gesto de limpar a mesa para posar. */
  setAllPropsHiddenInEditor: (hidden: boolean) => void
  /**
   * Move um vértice (ponto de controle) para uma posição no espaço LOCAL do
   * objeto; o store guarda o desvio em relação à primitiva. Objeto travado não
   * se mexe, mesma regra das juntas travadas (DECISOES.md #42).
   */
  setPropVertex: (id: string, index: number, localPosition: Vec3) => void
  /** Devolve o objeto à primitiva exata, jogando fora todos os vértices arrastados. */
  clearPropVertices: (id: string) => void
  /** Baixa/levanta o objeto até a geometria (já girada e deformada) encostar no chão. */
  seatPropOnGround: (id: string) => void
  selectProp: (id: string | null) => void
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

/**
 * Cor padrão do próximo boneco: a primeira da paleta que ainda não esteja em
 * uso e, se todas estiverem, a próxima no rodízio. NUNCA devolve `null` — o
 * limite de bonecos é `MAX_FIGURES`, e não o tamanho da paleta. Antes de
 * DECISOES.md #39 devolvia `null` com a paleta cheia, o que só não travava o
 * app porque as duas listas tinham o mesmo tamanho E as cores eram únicas;
 * com cor livre, dois bonecos da mesma cor deixariam sobrar paleta e impediriam
 * acrescentar o terceiro.
 */
function nextDefaultColor(figures: readonly Figure[]): string {
  const used = new Set(figures.map((figure) => figure.color))
  return COLOR_PALETTE.find((color) => !used.has(color)) ?? COLOR_PALETTE[figures.length % COLOR_PALETTE.length]
}

function updateFigure(
  figures: Figure[],
  id: string,
  update: (figure: Figure) => Figure,
): Figure[] {
  return figures.map((figure) => (figure.id === id ? update(figure) : figure))
}

/** Espaçamento em X entre objetos de cena recém-criados, para não nascerem um dentro do outro. */
const PROP_SPACING_M = 0.8

/**
 * Como o `updateFigure`, com uma diferença que importa para o undo: devolve o
 * array ORIGINAL quando o `update` não mudou nada. É o que faz uma edição
 * barrada pela trava do objeto não empilhar um passo de histórico que não
 * desfaz coisa alguma (a `equality` do `zundo` compara por referência).
 */
function updateProp(
  props: SceneProp[],
  id: string,
  update: (prop: SceneProp) => SceneProp,
): SceneProp[] {
  let changed = false
  const next = props.map((prop) => {
    if (prop.id !== id) return prop
    const updated = update(prop)
    if (updated !== prop) changed = true
    return updated
  })
  return changed ? next : props
}

/**
 * Como uma pose assenta o boneco no mundo. Mesmos três campos de
 * `PosePresetPlacement` (poses de fábrica) e de `SavedPose` (biblioteca do
 * usuário) — é o que permite as duas passarem pelo MESMO caminho de aplicação.
 */
interface AppliedPlacement {
  rotation: JointRotation
  groundOffsetM: number
  preservesHeading: boolean
}

/**
 * Aplica uma pose a UM boneco: as juntas, a rotação e a altura que a pose
 * pede. X/Z — onde ele está no chão — ficam onde o usuário os deixou, e as
 * juntas TRAVADAS ficam como estavam (DECISOES.md #42).
 */
function withPose(
  figure: Figure,
  pose: Record<string, JointRotation>,
  placement: AppliedPlacement,
  locked: readonly string[],
): Figure {
  return {
    ...figure,
    pose: mergeLockedJoints(figure.pose, pose, locked),
    rotation: placement.preservesHeading
      ? { ...placement.rotation, y: figure.rotation.y }
      : placement.rotation,
    // O deslocamento vertical acompanha a escala do boneco, para que um de
    // 1,50 m deite tão colado ao chão quanto um de 1,90 m.
    position: [figure.position[0], placement.groundOffsetM * getHeightScale(figure.height), figure.position[2]],
  }
}

function withPosePreset(figure: Figure, key: PosePresetKey, locked: readonly string[]): Figure {
  return withPose(figure, resolvePosePreset(key), resolvePosePresetPlacement(key), locked)
}

/**
 * Aplica ao PARCEIRO a outra metade de uma pose em dupla, montando o par: a
 * pose correspondente, o giro (180° quando um encara o outro) e a distância
 * medida da tabela de `posePairs.ts`. Diferente de `withPosePreset`, aqui o
 * X/Z é calculado — é justamente o que o usuário tinha de acertar a olho.
 *
 * O par inteiro é rígido: a montagem canônica (origem olhando para +Z) é
 * girada pelo giro de encenação de quem recebeu a pose, e o mesmo giro vale
 * para o deslocamento e para a rotação do parceiro. Nas poses que impõem
 * rotação própria (deitado) não existe "para onde ele encara", então a
 * montagem canônica é a única — daí o `preservesHeading` mandar no `heading`.
 */
function withPairedPreset(
  partner: Figure,
  anchor: Figure,
  anchorKey: PosePresetKey,
  pairing: PosePairing,
  locked: readonly string[],
): Figure {
  const posed = withPosePreset(partner, pairing.counterpart, locked)
  const heading = resolvePosePresetPlacement(anchorKey).preservesHeading ? anchor.rotation.y : 0
  // A distância foi medida com os dois na altura de referência; com alturas
  // diferentes ela é parte alcance de um e parte alvo do outro, e a média das
  // duas escalas é a repartição neutra entre eles.
  const scale = (getHeightScale(anchor.height) + getHeightScale(partner.height)) / 2
  const [dx, dz] = resolvePairedOffset(pairing.gapM, heading, scale)

  return {
    ...posed,
    position: [anchor.position[0] + dx, posed.position[1], anchor.position[2] + dz],
    rotation: resolvePairedRotation(pairing.counterpart, heading, pairing.facing),
  }
}

/** Próximo número da sequência de trechos salvos, acima de tudo o que veio de fora. */
function nextClipSeqFor(clips: readonly SavedClip[]): number {
  const maxSeq = clips.reduce((max, clip) => {
    const match = /^clip-(\d+)$/.exec(clip.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return maxSeq + 1
}

/**
 * Próximo número da sequência de poses salvas: acima de tudo o que veio de
 * fora, para que salvar uma pose nova não colida com um id lido do arquivo.
 */
function nextPoseSeqFor(poses: readonly SavedPose[]): number {
  const maxSeq = poses.reduce((max, pose) => {
    const match = /^pose-(\d+)$/.exec(pose.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return maxSeq + 1
}

function nextFigureSeqFor(figures: readonly Figure[]): number {
  const maxSeq = figures.reduce((max, figure) => {
    const match = /^figure-(\d+)$/.exec(figure.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return maxSeq + 1
}

function nextAnimationSeqFor(animations: readonly Animation[]): number {
  const maxSeq = animations.reduce((max, animation) => {
    const match = /^animation-(\d+)$/.exec(animation.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return maxSeq + 1
}

/** Maior sequência de id de keyframe já usada na animação (0 quando não há nenhum no padrão `k<n>`). */
function maxKeyframeSeq(animation: Animation): number {
  return animation.keyframes.reduce((max, keyframe) => {
    const match = /^k(\d+)$/.exec(keyframe.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
}

/**
 * Próximo id de keyframe DENTRO da animação — máximo já usado + 1, e não
 * "quantidade + 1": remover um keyframe do meio não pode fazer o próximo
 * reaproveitar um id que ainda está na lista.
 */
function nextKeyframeIdFor(animation: Animation): string {
  return `k${maxKeyframeSeq(animation) + 1}`
}

/** Os mesmos keyframes com ids em sequência a partir de `baseSeq` — id de keyframe é único DENTRO da animação. */
function renumberKeyframes(keyframes: readonly AnimationKeyframe[], baseSeq: number): AnimationKeyframe[] {
  return keyframes.map((keyframe, index) => ({ ...keyframe, id: `k${baseSeq + index + 1}` }))
}

/**
 * Desconflita os rótulos de grupo (item 38) de keyframes que estão ENTRANDO
 * numa linha do tempo: cada bloco de rótulo igual vira um grupo, e um rótulo já
 * usado ganha sufixo numérico — "Andando" importado sobre uma animação que já
 * tem "Andando" vira "Andando 2", dois grupos, e não um bloco emendado.
 *
 * A conta é feita bloco a bloco contra o que já está lá MAIS o que já entrou:
 * dois blocos "Andando" no mesmo arquivo têm de sair com rótulos diferentes.
 */
function withFreeGroupLabels(
  existing: readonly AnimationKeyframe[],
  incoming: readonly AnimationKeyframe[],
): AnimationKeyframe[] {
  const pool: AnimationKeyframe[] = [...existing]
  let sourceLabel: string | null = null
  let freeLabel = ''

  return incoming.map((keyframe) => {
    const label = keyframe.label?.trim() ?? ''
    if (label === '') {
      sourceLabel = null
      pool.push(keyframe)
      return keyframe
    }

    if (label !== sourceLabel) {
      sourceLabel = label
      freeLabel = freeKeyframeLabel(pool, label)
    }

    const renamed = freeLabel === label ? keyframe : { ...keyframe, label: freeLabel }
    pool.push(renamed)
    return renamed
  })
}

/**
 * A animação onde a edição vai cair, criando a de trabalho se for preciso
 * (item 36). Devolve a lista já com ela dentro, para que criar e editar caibam
 * num único `set` — e portanto num único passo de undo.
 */
function withTargetAnimation(
  animations: readonly Animation[],
  animationId: string | null,
): { animations: Animation[]; target: Animation } {
  const asked = animationId === null ? null : (animations.find((a) => a.id === animationId) ?? null)
  if (asked) return { animations: [...animations], target: asked }

  const working = findWorkingAnimation(animations)
  if (working) return { animations: [...animations], target: working }

  const created = createWorkingAnimation()
  // A de trabalho fica na frente: é a que está na bancada, e a lista aparece
  // nessa ordem no autosave e no `animations.json`.
  return { animations: [created, ...animations], target: created }
}

function updateAnimation(
  animations: readonly Animation[],
  id: string,
  update: (animation: Animation) => Animation,
): Animation[] {
  return animations.map((animation) => (animation.id === id ? update(animation) : animation))
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
      props: restoredWorkspace?.workingScene.props ?? [],
      nextPropSeq: restoredWorkspace?.workingScene.nextPropSeq ?? 1,
      selectedFigureId: null,
      selectedPropId: null,
      selectedJointName: null,
      activeAxis: null,
      nextFigureSeq: restoredWorkspace?.workingScene.nextFigureSeq ?? 1,
      cameraBookmarks: restoredWorkspace?.workingScene.cameraBookmarks ?? [],
      nextCameraBookmarkSeq: restoredWorkspace?.workingScene.nextCameraBookmarkSeq ?? 1,
      environment: restoredWorkspace?.workingScene.environment ?? INITIAL_ENVIRONMENT,
      sceneCamera: restoredWorkspace?.workingScene.sceneCamera ?? DEFAULT_SCENE_CAMERA,
      sceneName: restoredWorkspace?.workingScene.name ?? 'Cena 1',
      nextSnapshotNumber: restoredWorkspace?.workingScene.nextSnapshotNumber ?? 1,
      scenes: restoredWorkspace?.scenes ?? [],
      nextSceneSnapshotSeq: restoredWorkspace?.nextSceneSnapshotSeq ?? 1,
      activeSceneId: restoredWorkspace?.activeSceneId ?? null,
      // O autosave já aplicou esses limites ao `skeleton.ts` ao restaurar (as
      // poses acima foram lidas com eles valendo); aqui é só o espelho.
      jointLimits: restoredWorkspace?.jointLimits ?? {},
      poseLibrary: restoredWorkspace?.poseLibrary ?? [],
      nextPoseSeq: restoredWorkspace?.nextPoseSeq ?? 1,
      clipLibrary: restoredWorkspace?.clipLibrary ?? [],
      nextClipSeq: restoredWorkspace?.nextClipSeq ?? 1,
      animations: restoredWorkspace?.animations ?? [],
      nextAnimationSeq: restoredWorkspace?.nextAnimationSeq ?? 1,
      jointLocks: restoredWorkspace?.jointLocks ?? {},
      liveMirrorEnabled: false,

      addFigure: (name) => {
        const { figures, nextFigureSeq } = get()
        if (figures.length >= MAX_FIGURES) return null

        const color = nextDefaultColor(figures)

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
          // Travas são por boneco: sem o boneco, elas ficariam órfãs esperando
          // um id que volta a ser usado.
          jointLocks: clearFigureLocks(state.jointLocks, id),
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

        const color = nextDefaultColor(figures)

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

        set((state) => ({
          figures: [...figures, duplicate],
          nextFigureSeq: nextFigureSeq + 1,
          // A cópia nasce com a mesma pose: as travas vêm junto, senão a cópia
          // seria justamente a versão desprotegida do trabalho já feito.
          jointLocks: copyFigureLocks(state.jointLocks, id, newId),
        }))
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
        // mover/girar (ver PLANO.md > "Interação de pose", passo 1). E limpa a
        // seleção de objeto: só uma coisa por vez fica com gizmo na tela.
        set({
          selectedFigureId: id,
          selectedPropId: null,
          selectedJointName: id ? ROOT_JOINT_NAME : null,
          activeAxis: null,
        })
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

      // Cor LIVRE (DECISOES.md #39): valida o formato, não uma lista. Também
      // não exige mais que a cor seja única entre os bonecos — dois bonecos da
      // mesma cor é escolha de quem monta a cena, e recusar em silêncio uma cor
      // escolhida num seletor de cor seria só um botão que não funciona.
      setColor: (id, color) => {
        const normalized = normalizeFigureColor(color)
        if (!normalized) return

        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) =>
            figure.color === normalized ? figure : { ...figure, color: normalized },
          ),
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
        set((state) => {
          // Junta travada não muda por nada automático (DECISOES.md #42) — e
          // este é o caminho de TODA edição de junta: slider, gizmo, teclado e
          // o resultado do IK.
          if (isJointLocked(state.jointLocks, id, jointName)) return {}

          // Espelho ao vivo: o par recebe a REFLEXÃO SAGITAL da rotação
          // inteira, não uma cópia. As juntas pareadas são espelhadas só em
          // posição, então o mesmo valor numérico em Y/Z faz o movimento
          // anatômico oposto nos dois lados (DECISOES.md #14) — copiar cru
          // erraria até 0,95 m. A regra `(x, −y, −z)` é a mesma do "copiar
          // direito → esquerdo" (#30), e reusar `mirrorRotation` é o que
          // garante que as duas nunca divirjam.
          const mirroredName = state.liveMirrorEnabled ? getMirroredJointName(jointName) : null
          const mirrorTarget =
            mirroredName && !isJointLocked(state.jointLocks, id, mirroredName) ? mirroredName : null

          return {
            figures: updateFigure(state.figures, id, (figure) => {
              const updated = clampJointRotation(jointName, {
                ...figure.pose[jointName],
                ...rotation,
              })

              return {
                ...figure,
                pose: {
                  ...figure.pose,
                  [jointName]: updated,
                  ...(mirrorTarget
                    ? { [mirrorTarget]: clampJointRotation(mirrorTarget, mirrorRotation(updated)) }
                    : {}),
                },
              }
            }),
          }
        })
      },

      setJointRotations: (id, rotations) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => {
            const pose = { ...figure.pose }
            for (const [jointName, rotation] of Object.entries(rotations)) {
              // Mesmas regras da escrita unitária: junta travada não muda
              // (DECISOES.md #42) e o espelho ao vivo recebe a reflexão
              // sagital, nunca uma cópia crua (#14/#30).
              if (isJointLocked(state.jointLocks, id, jointName)) continue

              const updated = clampJointRotation(jointName, { ...pose[jointName], ...rotation })
              pose[jointName] = updated

              const mirroredName = state.liveMirrorEnabled ? getMirroredJointName(jointName) : null
              if (mirroredName && !isJointLocked(state.jointLocks, id, mirroredName)) {
                pose[mirroredName] = clampJointRotation(mirroredName, mirrorRotation(updated))
              }
            }
            return { ...figure, pose }
          }),
        }))
      },

      toggleLiveMirror: () => set((state) => ({ liveMirrorEnabled: !state.liveMirrorEnabled })),

      seatFigureOnGround: (id) => {
        set((state) => ({
          figures: updateFigure(state.figures, id, (figure) => ({
            ...figure,
            // Só a altura: onde o boneco está no chão é encenação de quem monta
            // a cena, e a pose não é tocada.
            position: [
              figure.position[0],
              seatOnGround(figure.pose, figure.rotation, figure.height),
              figure.position[2],
            ],
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
        set((state) => {
          if (isJointLocked(state.jointLocks, id, jointName)) return {}

          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: { ...figure.pose, [jointName]: clampJointRotation(jointName, neutral) },
            })),
          }
        })
      },

      resetJointGroup: (id, group) => {
        const joints = JOINT_GROUPS.find((candidate) => candidate.key === group)?.joints
        if (!joints) return

        const neutral = resolvePosePreset('standing')
        set((state) => {
          const locked = new Set(getLockedJoints(state.jointLocks, id))
          const reset: Record<string, JointRotation> = {}
          for (const jointName of joints) {
            if (locked.has(jointName)) continue
            reset[jointName] = clampJointRotation(jointName, neutral[jointName] ?? ZERO_ROTATION)
          }

          // Grupo inteiro travado: devolver o mesmo estado evita empilhar um
          // passo de undo que não desfaz nada.
          if (Object.keys(reset).length === 0) return {}

          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: { ...figure.pose, ...reset },
            })),
          }
        })
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

      setSceneCamera: (view) => set({ sceneCamera: view }),

      setBackground: (background) =>
        set((state) => ({ environment: { ...state.environment, background } })),

      toggleGrid: () =>
        set((state) => ({ environment: { ...state.environment, grid: !state.environment.grid } })),

      renameScene: (name) => set({ sceneName: name }),

      consumeSnapshotNumber: () => {
        const { nextSnapshotNumber } = get()
        set({ nextSnapshotNumber: nextSnapshotNumber + 1 })
        return nextSnapshotNumber
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
            props: state.props,
            nextPropSeq: state.nextPropSeq,
            environment: state.environment,
            cameraBookmarks: state.cameraBookmarks,
            nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
            nextSnapshotNumber: state.nextSnapshotNumber,
            sceneCamera: state.sceneCamera,
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
          props: state.props,
          nextPropSeq: state.nextPropSeq,
          environment: state.environment,
          cameraBookmarks: state.cameraBookmarks,
          nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
          nextSnapshotNumber: state.nextSnapshotNumber,
          sceneCamera: state.sceneCamera,
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

        set((state) => ({
          ...snapshot.data,
          sceneName: snapshot.name,
          activeSceneId: id,
          selectedFigureId: null,
          selectedPropId: null,
          selectedJointName: null,
          activeAxis: null,
          // Os ids de boneco vêm da cena carregada: travas de bonecos que não
          // estão mais em cena iriam recair sobre bonecos diferentes com o
          // mesmo id. A biblioteca de poses, essa sim, atravessa as cenas.
          jointLocks: pruneJointLocks(state.jointLocks, snapshot.data.figures.map((figure) => figure.id)),
        }))
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
        set((state) => ({
          figures: data.figures,
          jointLocks: pruneJointLocks(state.jointLocks, data.figures.map((figure) => figure.id)),
          nextFigureSeq: data.nextFigureSeq,
          props: data.props,
          nextPropSeq: data.nextPropSeq,
          environment: data.environment,
          cameraBookmarks: data.cameraBookmarks,
          nextCameraBookmarkSeq: data.nextCameraBookmarkSeq,
          nextSnapshotNumber: data.nextSnapshotNumber,
          sceneCamera: data.sceneCamera,
          sceneName: data.name,
          activeSceneId: null,
          selectedFigureId: null,
          selectedPropId: null,
          selectedJointName: null,
          activeAxis: null,
        }))
      },

      applyImportedFigurePose: (id, imported) => {
        const height = clampHeight(imported.height)
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              height,
              // O Y entra CRU, sem a escala por altura que `withPose` aplica ao
              // `groundOffsetM` de uma pose salva: aqui a altura do boneco vem do
              // mesmo arquivo, então o boneco fica do tamanho em que aquele Y foi
              // medido e a medida absoluta já é a certa.
              position: [figure.position[0], imported.positionY, figure.position[2]],
              rotation: { ...imported.rotation },
              pose: mergeLockedJoints(figure.pose, imported.pose, locked),
            })),
          }
        })
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

      loadWorkspaceCatalog: (scenes, activeSceneId, jointLimits, poses, animations, clips) => {
        // Quem carrega a pasta já instalou os limites no `skeleton.ts` antes de
        // reconstruir as cenas (ordem exigida pelo clamp das poses — ver
        // `workspaceFolder.ts`); o padrão aqui é só espelhar o que está valendo.
        const limits = jointLimits ?? getJointLimitOverrides()
        const active = activeSceneId ? scenes.find((scene) => scene.id === activeSceneId) : undefined
        // A biblioteca de poses vem do workspace aberto e SUBSTITUI a que
        // estava em memória — junto com o catálogo de cenas, é o que a pasta
        // define. Sem arquivo de poses, a biblioteca fica vazia (é o que
        // `loadWorkspaceFromDirectory` devolve). Vai no MESMO `set` do resto:
        // abrir um workspace é uma edição só, e num `set` à parte um Ctrl+Z
        // deixaria a biblioteca da pasta com o catálogo anterior.
        const library = poses ? { poseLibrary: [...poses], nextPoseSeq: nextPoseSeqFor(poses) } : {}
        // Animações seguem a mesma regra da biblioteca de poses: são do
        // workspace aberto e substituem as que estavam em memória.
        const reel = animations
          ? { animations: [...animations], nextAnimationSeq: nextAnimationSeqFor(animations) }
          : {}
        // Trechos salvos seguem as duas bibliotecas acima (item 39).
        const cuts = clips ? { clipLibrary: [...clips], nextClipSeq: nextClipSeqFor(clips) } : {}

        if (active) {
          set((state) => ({
            scenes,
            activeSceneId,
            ...active.data,
            ...library,
            ...reel,
            ...cuts,
            jointLimits: limits,
            sceneName: active.name,
            selectedFigureId: null,
            selectedPropId: null,
            selectedJointName: null,
            activeAxis: null,
            jointLocks: pruneJointLocks(state.jointLocks, active.data.figures.map((figure) => figure.id)),
          }))
        } else {
          // Sem cena ativa a cena de trabalho atual continua na tela, e ela não
          // passou pela leitura do arquivo de cena — precisa ser reajustada aqui.
          set((state) => ({
            scenes,
            activeSceneId,
            ...library,
            ...reel,
            ...cuts,
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
          props: [],
          nextPropSeq: 1,
          selectedFigureId: null,
          selectedPropId: null,
          selectedJointName: null,
          activeAxis: null,
          nextFigureSeq: 1,
          cameraBookmarks: [],
          nextCameraBookmarkSeq: 1,
          environment: { ...INITIAL_ENVIRONMENT },
          sceneCamera: DEFAULT_SCENE_CAMERA,
          sceneName: 'Cena 1',
          nextSnapshotNumber: 1,
          scenes: [],
          nextSceneSnapshotSeq: 1,
          activeSceneId: null,
          jointLimits: {},
          // "Novo workspace" limpa TUDO — a biblioteca de poses é do
          // workspace, e as travas não sobrevivem aos bonecos que protegiam.
          poseLibrary: [],
          nextPoseSeq: 1,
          clipLibrary: [],
          nextClipSeq: 1,
          animations: [],
          nextAnimationSeq: 1,
          jointLocks: {},
        })
        // Depois do `set`: limpar o workspace não é desfazível (o próprio
        // histórico faz parte do que é resetado). Se fosse antes, este `set`
        // empilharia uma entrada nova e um Ctrl+Z traria tudo de volta.
        useFiguresStore.temporal.getState().clear()
      },

      applyPosePreset: (id, key, options) => {
        set((state) => {
          const anchor = state.figures.find((figure) => figure.id === id)
          if (!anchor) return {}

          const posed = withPosePreset(anchor, key, getLockedJoints(state.jointLocks, id))
          const pairing = options?.pairPartner === false ? null : getPosePairing(key)
          // Pose em dupla com DOIS bonecos em cena: o outro recebe a metade
          // correspondente, já posicionada. Com três ou mais não há como saber
          // qual é o parceiro, e desmontar a pose do boneco errado seria pior
          // do que não fazer nada — aí a montagem continua manual, guiada pela
          // distância que a dica da pose informa.
          const partnerId =
            pairing && state.figures.length === 2
              ? (state.figures.find((figure) => figure.id !== id)?.id ?? null)
              : null

          return {
            figures: state.figures.map((figure) => {
              if (figure.id === id) return posed
              if (figure.id === partnerId) {
                return withPairedPreset(figure, posed, key, pairing!, getLockedJoints(state.jointLocks, figure.id))
              }
              return figure
            }),
          }
        })
      },

      applyHandPreset: (id, side, key) => {
        const hand = resolveHandPreset(key, side)
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, { ...figure.pose, ...hand }, locked),
            })),
          }
        })
      },

      applyRandomPose: (id) => {
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, resolveRandomPose(), locked),
            })),
          }
        })
      },

      mirrorSide: (id, from, scopeJoint) => {
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, mirrorPoseSide(figure.pose, from, scopeJoint), locked),
            })),
          }
        })
      },

      mirrorWholeFigure: (id) => {
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, mirrorPoseFull(figure.pose), locked),
            })),
          }
        })
      },

      swapSides: (id, scopeJoint) => {
        set((state) => {
          const locked = getLockedJoints(state.jointLocks, id)
          return {
            figures: updateFigure(state.figures, id, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, swapPoseSides(figure.pose, scopeJoint), locked),
            })),
          }
        })
      },

      saveFigurePose: (id, name) => {
        const state = get()
        const figure = state.figures.find((candidate) => candidate.id === id)
        if (!figure) return null

        const poseId = `pose-${state.nextPoseSeq}`
        const saved = captureFigurePose(figure, poseId, name?.trim() || `Pose ${state.nextPoseSeq}`)

        set({ poseLibrary: [...state.poseLibrary, saved], nextPoseSeq: state.nextPoseSeq + 1 })
        return poseId
      },

      copyFigurePose: (fromId, toId, group) => {
        set((state) => {
          if (fromId === toId) return {}
          const source = state.figures.find((figure) => figure.id === fromId)
          const target = state.figures.find((figure) => figure.id === toId)
          if (!source || !target) return {}

          // Um membro só: copiam-se ÂNGULOS, que não dependem da altura do
          // boneco, e nada mais. Sem captura e sem assentamento — quem recebe
          // continua exatamente onde e como estava.
          if (group) {
            const joints = JOINT_GROUPS.find((candidate) => candidate.key === group)?.joints
            if (!joints) return {}

            const locked = new Set(getLockedJoints(state.jointLocks, toId))
            const copied: Record<string, JointRotation> = {}
            for (const jointName of joints) {
              if (locked.has(jointName)) continue
              copied[jointName] = clampJointRotation(jointName, source.pose[jointName] ?? ZERO_ROTATION)
            }
            if (Object.keys(copied).length === 0) return {}

            return {
              figures: updateFigure(state.figures, toId, (figure) => ({
                ...figure,
                pose: { ...figure.pose, ...copied },
              })),
            }
          }

          // Passa pelo MESMO caminho da biblioteca de poses (#42): capturar
          // desfaz a escala do boneco de origem e aplicar refaz na escala de
          // quem recebe, então a mesma pose assenta igual num boneco de 1,50 m
          // e num de 1,90 m. Reusar isto é o que garante que copiar e
          // "salvar + aplicar" dêem exatamente o mesmo resultado.
          const captured = captureFigurePose(source, `${fromId}->${toId}`, source.name)

          return {
            figures: updateFigure(state.figures, toId, (figure) =>
              withPose(figure, captured.pose, captured, getLockedJoints(state.jointLocks, toId)),
            ),
          }
        })
      },

      applySavedPose: (figureId, poseId) => {
        set((state) => {
          const saved = state.poseLibrary.find((pose) => pose.id === poseId)
          if (!saved) return {}

          return {
            figures: updateFigure(state.figures, figureId, (figure) =>
              withPose(figure, saved.pose, saved, getLockedJoints(state.jointLocks, figureId)),
            ),
          }
        })
      },

      pasteFigurePose: (figureId, pose) => {
        set((state) => ({
          figures: updateFigure(state.figures, figureId, (figure) =>
            withPose(figure, pose.pose, pose, getLockedJoints(state.jointLocks, figureId)),
          ),
        }))
      },

      blendPose: (figureId, base, target, amount) => {
        set((state) => {
          const figure = state.figures.find((candidate) => candidate.id === figureId)
          if (!figure) return {}

          const blended = blendPoses(base, target, amount, figure.height)
          const locked = getLockedJoints(state.jointLocks, figureId)

          return {
            figures: updateFigure(state.figures, figureId, (figure) => ({
              ...figure,
              pose: mergeLockedJoints(figure.pose, blended.pose, locked),
              // As duas pontas já vêm resolvidas no mundo (heading e escala
              // embutidos), então aqui a rotação e a altura entram literais —
              // é o que faz 100% coincidir com aplicar a pose.
              rotation: blended.rotation,
              position: [figure.position[0], blended.positionY, figure.position[2]],
            })),
          }
        })
      },

      renameSavedPose: (poseId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          poseLibrary: state.poseLibrary.map((pose) => (pose.id === poseId ? { ...pose, name: trimmed } : pose)),
        }))
      },

      removeSavedPose: (poseId) => {
        set((state) => ({ poseLibrary: state.poseLibrary.filter((pose) => pose.id !== poseId) }))
      },

      loadPoseLibrary: (poses) => {
        set({ poseLibrary: [...poses], nextPoseSeq: nextPoseSeqFor(poses) })
      },

      // ----------------------------------------------------------------
      // Animações (fase 10) — ver `src/animation/animation.ts`
      // ----------------------------------------------------------------

      createAnimation: (name) => {
        const { animations, nextAnimationSeq } = get()
        const id = `animation-${nextAnimationSeq}`
        set({
          animations: [
            ...animations,
            {
              id,
              name: name?.trim() || `Animation ${nextAnimationSeq}`,
              speed: DEFAULT_ANIMATION_SPEED,
              keyframes: [],
            },
          ],
          nextAnimationSeq: nextAnimationSeq + 1,
        })
        return id
      },

      renameAnimation: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          animations: state.animations.map((animation) =>
            animation.id === id ? { ...animation, name: trimmed } : animation,
          ),
        }))
      },

      removeAnimation: (id) => {
        set((state) => ({ animations: state.animations.filter((animation) => animation.id !== id) }))
      },

      saveAnimationToLibrary: (name) => {
        const { animations, nextAnimationSeq } = get()
        const working = findWorkingAnimation(animations)
        // Salvar o vazio não guardaria trabalho nenhum — só sujaria a lista.
        if (!working || working.keyframes.length === 0) return null

        const id = `animation-${nextAnimationSeq}`
        set({
          animations: [
            ...animations,
            {
              id,
              name: name?.trim() || working.name,
              speed: working.speed,
              // Os keyframes entram por referência, como em toda parte deste
              // store: cada edição cria objetos novos, então a cópia guardada
              // nunca muda por baixo quando a de trabalho continua a ser
              // editada.
              keyframes: working.keyframes,
            },
          ],
          nextAnimationSeq: nextAnimationSeq + 1,
        })
        return id
      },

      openAnimationFromLibrary: (savedId) => {
        const state = get()
        const saved = state.animations.find((candidate) => candidate.id === savedId)
        if (!saved || saved.id === WORKING_ANIMATION_ID) return false

        const { animations, target } = withTargetAnimation(state.animations, WORKING_ANIMATION_ID)
        set({
          animations: updateAnimation(animations, target.id, (working) => ({
            ...working,
            name: saved.name,
            speed: saved.speed,
            keyframes: saved.keyframes,
          })),
        })
        return true
      },

      overwriteSavedAnimation: (savedId) => {
        const state = get()
        const working = findWorkingAnimation(state.animations)
        const saved = state.animations.find((candidate) => candidate.id === savedId)
        if (!working || !saved || saved.id === WORKING_ANIMATION_ID) return false

        set({
          animations: updateAnimation(state.animations, savedId, (current) => ({
            ...current,
            // O NOME da salva fica: regravar é atualizar aquela entrada da
            // biblioteca, não rebatizá-la com o nome da bancada.
            speed: working.speed,
            keyframes: working.keyframes,
          })),
        })
        return true
      },

      addAnimationKeyframe: (animationId, camera) => {
        const state = get()
        if (state.figures.length === 0) return null

        // Sem animação ativa, a captura cria a de trabalho aqui dentro — no
        // mesmo `set`, e portanto no mesmo passo de undo (item 36).
        const { animations, target: animation } = withTargetAnimation(state.animations, animationId)

        const keyframeId = nextKeyframeIdFor(animation)
        // Os bonecos entram por referência de propósito: toda edição do store
        // cria objetos novos, então o retrato nunca muda por baixo, e vários
        // keyframes de um boneco parado compartilham a mesma pose em memória.
        const keyframe: AnimationKeyframe = {
          id: keyframeId,
          durationMs: DEFAULT_KEYFRAME_DURATION_MS,
          figures: [...state.figures],
          camera,
        }

        set({
          animations: updateAnimation(animations, animation.id, (candidate) => ({
            ...candidate,
            keyframes: [...candidate.keyframes, keyframe],
          })),
        })
        return keyframeId
      },

      insertAnimationKeyframeAt: (animationId, timeMs) => {
        const animation = get().animations.find((candidate) => candidate.id === animationId)
        if (!animation) return null

        const split = planKeyframeSplit(animation, timeMs)
        if (!split) return null

        // O retrato é o que a animação JÁ mostrava naquele instante — é o que
        // torna a inserção invisível: nada muda até o usuário editar o
        // keyframe novo.
        const sample = sampleAnimation(animation, split.timeMs)
        if (!sample) return null

        // A câmera vem do `splitCameraView`, e não da amostra: a única
        // diferença é o topo da tela guardado sem reendireitar, que é o que
        // mantém a inclinação lateral idêntica nas duas metades.
        const from = animation.keyframes[split.index - 1]
        const to = animation.keyframes[split.index]
        const camera = splitCameraView(
          from.camera,
          to.camera,
          split.durationMs / (split.durationMs + split.nextDurationMs),
        )

        const keyframeId = nextKeyframeIdFor(animation)
        const inserted: AnimationKeyframe = {
          id: keyframeId,
          durationMs: split.durationMs,
          figures: sample.figures,
          camera,
          // Herda o grupo do keyframe ANTERIOR (item 38): sem isso, cortar um
          // trecho no meio de "Andando" partiria o grupo em dois — e a
          // inserção promete não mudar nada.
          ...(from.label ? { label: from.label } : {}),
        }

        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (current) => ({
            ...current,
            keyframes: [
              ...current.keyframes.slice(0, split.index),
              inserted,
              // O resto do trecho cortado fica com o keyframe seguinte: o total
              // da animação e o instante de todos os outros não se mexem.
              { ...current.keyframes[split.index], durationMs: split.nextDurationMs },
              ...current.keyframes.slice(split.index + 1),
            ],
          })),
        }))
        return keyframeId
      },

      copyAnimationKeyframeCamera: (animationId, keyframeId, offset) => {
        set((state) => {
          const animation = state.animations.find((candidate) => candidate.id === animationId)
          if (!animation) return {}

          const index = animation.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
          const source = animation.keyframes[index + offset]
          // Nas pontas não há vizinho de onde copiar — e `index === -1` cai
          // aqui também, sem precisar de teste próprio.
          if (index < 0 || !source) return {}

          return {
            animations: updateAnimation(state.animations, animationId, (current) => ({
              ...current,
              keyframes: current.keyframes.map((keyframe, position) =>
                // Só a câmera: o retrato dos bonecos e a duração do trecho
                // ficam intactos, que é justamente o ponto — "segura o
                // enquadramento e deixa a cena se mover".
                position === index ? { ...keyframe, camera: source.camera } : keyframe,
              ),
            })),
          }
        })
      },

      copyAnimationKeyframeFigures: (animationId, keyframeId, offset) => {
        set((state) => {
          const animation = state.animations.find((candidate) => candidate.id === animationId)
          if (!animation) return {}

          const index = animation.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
          const source = animation.keyframes[index + offset]
          if (index < 0 || !source) return {}

          return {
            animations: updateAnimation(state.animations, animationId, (current) => ({
              ...current,
              keyframes: current.keyframes.map((keyframe, position) =>
                // Só os bonecos: câmera e duração ficam intactas — o oposto
                // exato do `copyAnimationKeyframeCamera`.
                position === index ? { ...keyframe, figures: source.figures } : keyframe,
              ),
            })),
          }
        })
      },

      applySceneCameraToKeyframes: (animationId, fromIndex, toIndex) => {
        const animation = get().animations.find((candidate) => candidate.id === animationId)
        if (!animation || animation.keyframes.length === 0) return false
        if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return false

        const last = animation.keyframes.length - 1
        const clamp = (index: number) => Math.min(last, Math.max(0, Math.round(index)))
        // A faixa é normalizada: quem escolhe "do 5 ao 2" no painel quer os
        // keyframes 2 a 5, não uma faixa vazia.
        const from = Math.min(clamp(fromIndex), clamp(toIndex))
        const to = Math.max(clamp(fromIndex), clamp(toIndex))

        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (current) => ({
            ...current,
            keyframes: current.keyframes.map((keyframe, index) =>
              // Só a câmera — o retrato dos bonecos e a duração do trecho ficam
              // intactos, como no `copyAnimationKeyframeCamera`. A diferença é
              // a fonte: ali é o keyframe vizinho, aqui é a câmera viva.
              index >= from && index <= to ? { ...keyframe, camera: state.sceneCamera } : keyframe,
            ),
          })),
        }))
        return true
      },

      duplicateAnimationKeyframe: (animationId, keyframeId) => {
        const animation = get().animations.find((candidate) => candidate.id === animationId)
        if (!animation) return null

        const index = animation.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
        if (index < 0) return null

        const source = animation.keyframes[index]
        const id = nextKeyframeIdFor(animation)
        // A cópia entra logo DEPOIS e leva a mesma duração: a pausa criada dura
        // o mesmo que o trecho que chegou até aqui, que é um valor que o
        // usuário já escolheu e reconhece.
        const copy: AnimationKeyframe = { ...source, id }

        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (current) => ({
            ...current,
            keyframes: [
              ...current.keyframes.slice(0, index + 1),
              copy,
              ...current.keyframes.slice(index + 1),
            ],
          })),
        }))
        return id
      },

      closeAnimationCycle: (animationId) => {
        const animation = get().animations.find((candidate) => candidate.id === animationId)
        if (!animation || animation.keyframes.length < 2) return null

        const first = animation.keyframes[0]
        const last = animation.keyframes[animation.keyframes.length - 1]
        const id = nextKeyframeIdFor(animation)
        // O keyframe que fecha o ciclo NÃO leva o rótulo do primeiro (item 38):
        // ele está no fim da linha do tempo, e o grupo do começo não continua
        // ali — seriam dois blocos separados com o mesmo nome.
        const closing: AnimationKeyframe = {
          id,
          durationMs: last.durationMs,
          figures: first.figures,
          camera: first.camera,
        }

        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (current) => ({
            ...current,
            keyframes: [...current.keyframes, closing],
          })),
        }))
        return id
      },

      updateAnimationKeyframe: (animationId, keyframeId, camera) => {
        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (animation) => ({
            ...animation,
            keyframes: animation.keyframes.map((keyframe) =>
              // A duração é do TRECHO, não do retrato: regravar o keyframe não
              // pode zerar o tempo que o usuário ajustou para chegar até ele.
              keyframe.id === keyframeId
                ? { ...keyframe, figures: [...state.figures], camera }
                : keyframe,
            ),
          })),
        }))
      },

      removeAnimationKeyframe: (animationId, keyframeId) => {
        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (animation) => ({
            ...animation,
            keyframes: animation.keyframes.filter((keyframe) => keyframe.id !== keyframeId),
          })),
        }))
      },

      moveAnimationKeyframe: (animationId, keyframeId, delta) => {
        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (animation) => {
            const from = animation.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
            const to = from + delta
            if (from < 0 || to < 0 || to >= animation.keyframes.length) return animation

            const keyframes = [...animation.keyframes]
            const [moved] = keyframes.splice(from, 1)
            keyframes.splice(to, 0, moved)
            return { ...animation, keyframes }
          }),
        }))
      },

      setAnimationKeyframeDuration: (animationId, keyframeId, durationMs) => {
        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (animation) => ({
            ...animation,
            keyframes: animation.keyframes.map((keyframe) =>
              keyframe.id === keyframeId
                ? { ...keyframe, durationMs: clampKeyframeDuration(durationMs) }
                : keyframe,
            ),
          })),
        }))
      },

      setAnimationKeyframeLabel: (animationId, keyframeId, label) => {
        set((state) => {
          const animation = state.animations.find((candidate) => candidate.id === animationId)
          if (!animation) return {}

          const index = animation.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
          if (index < 0) return {}

          const resolved = uniqueKeyframeLabel(animation.keyframes, index, label)
          return {
            animations: updateAnimation(state.animations, animationId, (current) => ({
              ...current,
              keyframes: current.keyframes.map((keyframe, position) => {
                if (position !== index) return keyframe
                if (resolved === '') {
                  const semGrupo = { ...keyframe }
                  delete semGrupo.label
                  return semGrupo
                }
                return { ...keyframe, label: resolved }
              }),
            })),
          }
        })
      },

      setAnimationSpeed: (animationId, speed) => {
        set((state) => ({
          animations: updateAnimation(state.animations, animationId, (animation) => ({
            ...animation,
            speed: clampAnimationSpeed(speed),
          })),
        }))
      },

      appendAnimationClip: (animationId, clipKey, camera, figureAIds, figureBId, label) => {
        const state = get()
        const clip = ANIMATION_CLIPS[clipKey]
        // Item 37: o papel A aceita VÁRIOS bonecos nos trechos individuais —
        // cada um executa o trecho inteiro no próprio lugar. Em dupla continua
        // valendo um só, porque os encaixes são medidos par a par
        // (`posePairs.ts`) e dois "A" cairiam exatamente no mesmo ponto.
        const askedIds = typeof figureAIds === 'string' ? [figureAIds] : [...new Set(figureAIds)]
        const rolesA = askedIds
          .map((id) => state.figures.find((figure) => figure.id === id))
          .filter((figure): figure is Figure => figure !== undefined)
        if (!clip || rolesA.length === 0) return false
        if (clip.kind === 'duo' && rolesA.length !== 1) return false

        // Como a captura: sem animação ativa, o trecho cria a de trabalho no
        // mesmo passo de undo (item 36).
        const { animations, target: animation } = withTargetAnimation(state.animations, animationId)

        const figureB =
          clip.kind === 'duo' ? state.figures.find((figure) => figure.id === figureBId) : undefined
        if (clip.kind === 'duo' && (!figureB || figureB.id === rolesA[0].id)) return false

        /**
         * Âncora do trecho para um boneco do papel A: onde ele está e para onde
         * encara — os passos são declarados com A na origem olhando +Z
         * (`animationClips`).
         */
        const anchorFor = (figureA: Figure) => {
          // Deslocamentos no chão foram medidos na altura de referência; em
          // dupla, a média das escalas dos dois é a repartição neutra — a mesma
          // regra da montagem de pares (`applyPosePreset`).
          const groundScale =
            clip.kind === 'duo'
              ? (getHeightScale(figureA.height) + getHeightScale(figureB!.height)) / 2
              : getHeightScale(figureA.height)
          return { heading: figureA.rotation.y, x: figureA.position[0], z: figureA.position[2], groundScale }
        }

        const anchors = new Map(rolesA.map((figureA) => [figureA.id, anchorFor(figureA)]))

        const posed = (
          figure: Figure,
          resolved: ResolvedClipFigure,
          anchor: { x: number; z: number; groundScale: number },
        ): Figure => ({
          ...figure,
          pose: resolved.pose,
          rotation: resolved.rotation,
          position: [
            anchor.x + resolved.offset[0] * anchor.groundScale,
            // O deslocamento vertical acompanha a escala do PRÓPRIO boneco,
            // como em qualquer aplicação de pose.
            resolved.groundOffsetM * getHeightScale(figure.height),
            anchor.z + resolved.offset[1] * anchor.groundScale,
          ],
        })

        // Rótulo do grupo (item 38): o trecho inserido já nasce agrupado, e o
        // sufixo resolve a segunda inserção do mesmo trecho sozinho.
        const baseSeq = maxKeyframeSeq(animation)
        const wantedLabel = label?.trim() ?? ''
        const groupLabel = freeKeyframeLabel(animation.keyframes, wantedLabel)

        const appended: AnimationKeyframe[] = clip.steps.map((step, index) => ({
          id: `k${baseSeq + index + 1}`,
          durationMs: step.durationMs,
          // O retrato de cada passo é a cena atual com os papéis substituídos:
          // quem não participa aparece parado onde está, em todos os passos.
          figures: state.figures.map((figure) => {
            const anchor = anchors.get(figure.id)
            if (anchor) return posed(figure, resolveClipFigure(step.a, anchor.heading), anchor)
            if (figureB && step.b && figure.id === figureB.id) {
              const anchorA = anchors.get(rolesA[0].id)!
              return posed(figure, resolveClipFigure(step.b, anchorA.heading), anchorA)
            }
            return figure
          }),
          camera,
          ...(groupLabel === '' ? {} : { label: groupLabel }),
        }))

        set({
          animations: updateAnimation(animations, animation.id, (target) => ({
            ...target,
            keyframes: [...target.keyframes, ...appended],
          })),
        })
        return true
      },

      appendCameraMoveKeyframes: (animationId, from, to, durationMs) => {
        const state = get()
        if (state.figures.length === 0) return false

        const { animations, target: animation } = withTargetAnimation(state.animations, animationId)
        const baseSeq = maxKeyframeSeq(animation)
        // A MESMA cena nos dois: quem montou o travelling quer a câmera
        // andando, não os bonecos. Ajustar a pose de um dos dois keyframes é o
        // passo seguinte, e é do usuário.
        const figures = [...state.figures]

        set({
          animations: updateAnimation(animations, animation.id, (current) => ({
            ...current,
            keyframes: [
              ...current.keyframes,
              { id: `k${baseSeq + 1}`, durationMs: DEFAULT_KEYFRAME_DURATION_MS, figures, camera: from },
              {
                id: `k${baseSeq + 2}`,
                durationMs: clampKeyframeDuration(durationMs ?? DEFAULT_KEYFRAME_DURATION_MS),
                figures,
                camera: to,
              },
            ],
          })),
        })
        return true
      },

      saveClipFromRange: (animationId, fromIndex, toIndex, name) => {
        const state = get()
        const animation = state.animations.find((candidate) => candidate.id === animationId)
        if (!animation) return null

        const id = `clip-${state.nextClipSeq}`
        const clip = captureClipFromAnimation(animation, fromIndex, toIndex, {
          id,
          name: name?.trim() || `Clip ${state.nextClipSeq}`,
        })
        if (!clip) return null

        set({ clipLibrary: [...state.clipLibrary, clip], nextClipSeq: state.nextClipSeq + 1 })
        return id
      },

      renameSavedClip: (clipId, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          clipLibrary: state.clipLibrary.map((clip) =>
            clip.id === clipId ? { ...clip, name: trimmed } : clip,
          ),
        }))
      },

      removeSavedClip: (clipId) => {
        set((state) => ({ clipLibrary: state.clipLibrary.filter((clip) => clip.id !== clipId) }))
      },

      appendSavedClip: (animationId, clipId, camera, casts, label) => {
        const state = get()
        const clip = state.clipLibrary.find((candidate) => candidate.id === clipId)
        if (!clip) return false

        const roles = clipRoleCount(clip)
        // Cada elenco precisa de um boneco DISTINTO por papel; o que não fechar
        // é descartado, em vez de entrar meio montado.
        const assignments = casts
          .map((cast) =>
            cast
              .map((figureId) => state.figures.find((figure) => figure.id === figureId))
              .filter((figure): figure is Figure => figure !== undefined),
          )
          .filter((cast) => cast.length === roles && new Set(cast.map((f) => f.id)).size === roles)
        if (assignments.length === 0) return false

        const { animations, target: animation } = withTargetAnimation(state.animations, animationId)
        const keyframes = buildKeyframesFromClip({
          clip,
          assignments,
          sceneFigures: state.figures,
          camera,
          baseSeq: maxKeyframeSeq(animation),
          label: freeKeyframeLabel(animation.keyframes, label ?? ''),
        })
        if (keyframes.length === 0) return false

        set({
          animations: updateAnimation(animations, animation.id, (target) => ({
            ...target,
            keyframes: [...target.keyframes, ...keyframes],
          })),
        })
        return true
      },

      loadClipLibrary: (clips) => {
        set({ clipLibrary: [...clips], nextClipSeq: nextClipSeqFor(clips) })
      },

      loadAnimationLibrary: (animations) => {
        set({ animations: [...animations], nextAnimationSeq: nextAnimationSeqFor(animations) })
      },

      importAnimation: (imported, options) => {
        const state = get()
        if (imported.keyframes.length === 0) return false

        // Como a captura e os trechos: sem animação de trabalho, a importação
        // cria a dela aqui dentro, no mesmo passo de undo (item 36).
        const { animations, target } = withTargetAnimation(state.animations, WORKING_ANIMATION_ID)
        const appending = options.mode === 'append'
        const assignment = options.assignment ?? null

        // Enxertar numa linha do tempo que já existe (pedido do usuário): nada
        // além do escolhido muda — nem o nome, nem a velocidade, nem os
        // keyframes de fora da faixa. Por isso ele sai antes dos outros dois
        // modos, que reescrevem a bancada inteira.
        if (options.mode === 'substitute') {
          if (!assignment || target.keyframes.length === 0) return false

          const substituted = substituteImportedKeyframes({
            keyframes: imported.keyframes,
            target: target.keyframes,
            sceneFigures: state.figures,
            assignment,
            startIndex: options.startIndex ?? 0,
            replaceCamera: options.replaceCamera ?? true,
            baseSeq: maxKeyframeSeq(target),
          })
          if (!substituted) return false

          // Só os keyframes que SOBRARAM para o fim trazem rótulo de fora e
          // podem colidir com um grupo da bancada; os enxertados mantêm o
          // rótulo que já tinham, que é o do grupo onde eles estão.
          const kept = substituted.keyframes.slice(0, substituted.keyframes.length - substituted.appended)
          const extras = substituted.keyframes.slice(kept.length)

          set({
            animations: updateAnimation(animations, target.id, (working) => ({
              ...working,
              keyframes: [...kept, ...withFreeGroupLabels(kept, extras)],
            })),
          })
          return true
        }

        const baseSeq = appending ? maxKeyframeSeq(target) : 0
        const keyframes = assignment
          ? remapImportedKeyframes({
              keyframes: imported.keyframes,
              sceneFigures: state.figures,
              assignment,
              // Substituir traz a animação onde ela foi gravada, e a câmera do
              // arquivo continua valendo; anexar a transporta para onde os
              // bonecos estão, com a câmera junto (decisão do usuário).
              anchoring: appending ? 'anchored' : 'absolute',
              baseSeq,
            })
          : renumberKeyframes(imported.keyframes, baseSeq)

        // Remapeamento sem nenhum papel com boneco não produz animação nenhuma
        // — melhor não mexer em nada do que esvaziar a bancada.
        if (keyframes.length === 0) return false

        if (!appending) {
          set({
            animations: updateAnimation(animations, target.id, (working) => ({
              ...working,
              name: imported.name,
              speed: clampAnimationSpeed(imported.speed),
              keyframes,
            })),
          })
          return true
        }

        // Anexar mantém nome e velocidade da bancada: a velocidade é da linha
        // do tempo inteira, e o nome é o do vídeo que vai sair daqui.
        set({
          animations: updateAnimation(animations, target.id, (working) => ({
            ...working,
            keyframes: [...working.keyframes, ...withFreeGroupLabels(working.keyframes, keyframes)],
          })),
        })
        return true
      },

      loadFiguresFromKeyframe: (figures) => {
        set((state) => {
          const next = clampFigures([...figures])
          const ids = next.map((figure) => figure.id)
          const keeps = state.selectedFigureId !== null && ids.includes(state.selectedFigureId)
          return {
            figures: next,
            // O contador tem de ultrapassar o maior id do retrato: um keyframe
            // com `figure-4` numa cena que ia no 2 faria o próximo boneco novo
            // nascer com id repetido.
            nextFigureSeq: Math.max(state.nextFigureSeq, nextFigureSeqFor(next)),
            selectedFigureId: keeps ? state.selectedFigureId : null,
            selectedJointName: keeps ? state.selectedJointName : null,
            activeAxis: keeps ? state.activeAxis : null,
            jointLocks: pruneJointLocks(state.jointLocks, ids),
          }
        })
      },

      // -----------------------------------------------------------------------
      // Objetos de cena (item 42)
      // -----------------------------------------------------------------------

      addProp: (shape, name) => {
        const { props, nextPropSeq } = get()
        if (props.length >= MAX_PROPS) return null

        const id = `prop-${nextPropSeq}`
        const base: SceneProp = {
          id,
          name: name ?? `Object ${nextPropSeq}`,
          shape,
          color: DEFAULT_PROP_COLOR,
          visible: true,
          hiddenInEditor: false,
          locked: false,
          position: [0, 0, 0],
          rotation: { ...ZERO_ROTATION },
          size: DEFAULT_PROP_SIZE[shape],
          vertexOffsets: {},
        }

        // Nasce APOIADO no chão e deslocado em X: um objeto novo enterrado
        // até a metade (o pivô é o centro) ou dentro do anterior seria trabalho
        // de arrumação antes mesmo de começar.
        const prop: SceneProp = {
          ...base,
          position: [props.length * PROP_SPACING_M, propGroundOffset(base), 0],
        }

        set({
          props: [...props, prop],
          nextPropSeq: nextPropSeq + 1,
          selectedPropId: id,
          selectedFigureId: null,
          selectedJointName: null,
          activeAxis: null,
        })
        return id
      },

      removeProp: (id) => {
        set((state) => ({
          props: state.props.filter((prop) => prop.id !== id),
          selectedPropId: state.selectedPropId === id ? null : state.selectedPropId,
        }))
      },

      duplicateProp: (id) => {
        const { props, nextPropSeq } = get()
        if (props.length >= MAX_PROPS) return null

        const original = props.find((prop) => prop.id === id)
        if (!original) return null

        const newId = `prop-${nextPropSeq}`
        const duplicate: SceneProp = {
          ...original,
          id: newId,
          name: `${original.name} (2)`,
          rotation: { ...original.rotation },
          // Os vértices arrastados vêm junto: a cópia existe justamente para
          // reaproveitar a forma que deu trabalho.
          vertexOffsets: { ...original.vertexOffsets },
          position: [
            original.position[0] + Math.max(original.size[0], PROP_SPACING_M),
            original.position[1],
            original.position[2],
          ],
        }

        set({ props: [...props, duplicate], nextPropSeq: nextPropSeq + 1, selectedPropId: newId })
        return newId
      },

      renameProp: (id, name) => {
        set((state) => ({ props: updateProp(state.props, id, (prop) => ({ ...prop, name })) }))
      },

      setPropShape: (id, shape) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.locked || prop.shape === shape
              ? prop
              : // Os desvios são índices de ponto de controle DAQUELA forma —
                // mantê-los deformaria a nova em pontos aleatórios.
                { ...prop, shape, vertexOffsets: {}, size: clampPropSize(prop.size, shape) },
          ),
        }))
      },

      setPropColor: (id, color) => {
        const normalized = normalizePropColor(color)
        if (!normalized) return
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.color === normalized ? prop : { ...prop, color: normalized },
          ),
        }))
      },

      setPropPosition: (id, position) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) => (prop.locked ? prop : { ...prop, position })),
        }))
      },

      setPropRotation: (id, rotation) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.locked ? prop : { ...prop, rotation: { ...prop.rotation, ...rotation } },
          ),
        }))
      },

      setPropSize: (id, size) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.locked ? prop : { ...prop, size: clampPropSize(size, prop.shape) },
          ),
        }))
      },

      togglePropVisible: (id) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) => ({ ...prop, visible: !prop.visible })),
        }))
      },

      togglePropHiddenInEditor: (id) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) => ({ ...prop, hiddenInEditor: !prop.hiddenInEditor })),
        }))
      },

      togglePropLocked: (id) => {
        set((state) => {
          const props = updateProp(state.props, id, (prop) => ({ ...prop, locked: !prop.locked }))
          // Travar o que está selecionado limpa a seleção: o gizmo continuaria
          // na tela sobre um objeto que já não aceita ser arrastado.
          const locked = props.find((prop) => prop.id === id)?.locked === true
          if (!locked || state.selectedPropId !== id) return { props }
          return { props, selectedPropId: null }
        })
      },

      setAllPropsHiddenInEditor: (hidden) => {
        set((state) => {
          if (state.props.every((prop) => prop.hiddenInEditor === hidden)) return {}
          return { props: state.props.map((prop) => ({ ...prop, hiddenInEditor: hidden })) }
        })
      },

      setPropVertex: (id, index, localPosition) => {
        set((state) => {
          const target = state.props.find((prop) => prop.id === id)
          if (!target || target.locked) return {}
          if (!Number.isInteger(index) || index < 0 || index >= controlPointCount(target.shape)) return {}

          // O store guarda o DESVIO, não a posição: assim o objeto continua
          // sendo "primitiva + o que foi puxado", e mudar o tamanho move a
          // primitiva por baixo em vez de congelar a malha inteira.
          const base = controlPointPosition(target.shape, target.size, {}, index)
          const offset = clampVertexOffset([
            localPosition[0] - base[0],
            localPosition[1] - base[1],
            localPosition[2] - base[2],
          ])

          return {
            props: updateProp(state.props, id, (prop) => ({
              ...prop,
              vertexOffsets: withVertexOffset(prop.vertexOffsets, index, offset),
            })),
          }
        })
      },

      clearPropVertices: (id) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.locked || Object.keys(prop.vertexOffsets).length === 0
              ? prop
              : { ...prop, vertexOffsets: {} },
          ),
        }))
      },

      seatPropOnGround: (id) => {
        set((state) => ({
          props: updateProp(state.props, id, (prop) =>
            prop.locked
              ? prop
              : { ...prop, position: [prop.position[0], propGroundOffset(prop), prop.position[2]] },
          ),
        }))
      },

      selectProp: (id) => {
        // Objeto travado não é selecionável — é justamente o que a trava promete.
        if (id !== null && get().props.find((prop) => prop.id === id)?.locked) return
        set({ selectedPropId: id, selectedFigureId: null, selectedJointName: null, activeAxis: null })
      },

      toggleJointLock: (figureId, jointName) => {
        set((state) => ({ jointLocks: toggleLockInMap(state.jointLocks, figureId, jointName) }))
      },

      clearJointLocks: (figureId) => {
        set((state) => ({ jointLocks: clearFigureLocks(state.jointLocks, figureId) }))
      },
    }),
    {
      // Seleção de boneco/junta/eixo ativo, navegação de câmera (fora deste
      // store, ver `cameraStore.ts`) e `nextSnapshotNumber` ficam fora do
      // histórico de undo — não são edição de conteúdo (ver PLANO.md >
      // "Interação de pose", item 5). O contador de instantâneo em particular
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
      // `poseLibrary`/`nextPoseSeq` entram: salvar e remover uma pose da
      // biblioteca é conteúdo do workspace, exatamente como salvar e remover
      // um snapshot de cena. `jointLocks` fica de fora: travar uma junta não é
      // edição do boneco, é um modo de trabalho — e desfazer uma edição não
      // pode reabrir a proteção que o usuário fechou (DECISOES.md #42).
      // `sceneCamera` fica de fora (fase 11): mover a câmera de cena é
      // ENQUADRAR, como a órbita/pan/zoom do viewport — persiste com a cena
      // (autosave/snapshots/arquivo de cena), mas um Ctrl+Z de pose não pode teleportar a
      // câmera (decidido com o usuário).
      // Os objetos de cena (item 42) entram no histórico como os bonecos:
      // criar, mover, redimensionar e puxar um vértice são edições de conteúdo.
      // `selectedPropId` fica de fora, como `selectedFigureId` — é ponteiro de
      // seleção, não conteúdo. As opções "ocultar na bancada" e "travar" ficam
      // DENTRO do objeto e, portanto, no histórico: são propriedades da cena,
      // como a visibilidade do boneco (que também é desfazível), e não modo de
      // trabalho por sessão como as travas de junta do #42.
      partialize: (state) => ({
        figures: state.figures,
        nextFigureSeq: state.nextFigureSeq,
        props: state.props,
        nextPropSeq: state.nextPropSeq,
        cameraBookmarks: state.cameraBookmarks,
        nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
        environment: state.environment,
        sceneName: state.sceneName,
        scenes: state.scenes,
        nextSceneSnapshotSeq: state.nextSceneSnapshotSeq,
        poseLibrary: state.poseLibrary,
        nextPoseSeq: state.nextPoseSeq,
        clipLibrary: state.clipLibrary,
        nextClipSeq: state.nextClipSeq,
        animations: state.animations,
        nextAnimationSeq: state.nextAnimationSeq,
      }),
      // Toda ação do store faz atualização imutável (sempre cria um novo
      // array/objeto ao mudar algo), então igualdade referencial basta para
      // detectar "nada mudou" (ex.: só a seleção) e não empilhar histórico.
      equality: (past, current) =>
        past.figures === current.figures &&
        past.nextFigureSeq === current.nextFigureSeq &&
        past.props === current.props &&
        past.nextPropSeq === current.nextPropSeq &&
        past.cameraBookmarks === current.cameraBookmarks &&
        past.nextCameraBookmarkSeq === current.nextCameraBookmarkSeq &&
        past.environment === current.environment &&
        past.sceneName === current.sceneName &&
        past.scenes === current.scenes &&
        past.nextSceneSnapshotSeq === current.nextSceneSnapshotSeq &&
        past.poseLibrary === current.poseLibrary &&
        past.clipLibrary === current.clipLibrary &&
        past.animations === current.animations,
      limit: 100,
    },
  ),
)
