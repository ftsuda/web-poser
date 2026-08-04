import {
  UNDO_LIMIT,
  undoEquality,
  undoPartialize,
  useFiguresStore,
  type UndoTrackedState,
} from './figuresStore'

/**
 * O AGRUPADOR DE GESTOS do histórico de undo (DECISOES.md #118).
 *
 * Um arrasto é um gesto só, mas escreve o store dezenas de vezes: o gizmo
 * resolve a cadeia a cada `onObjectChange`, o módulo de poses a cada quadro, o
 * slider a cada pixel. Sem agrupamento, cada evento vira um passo de undo — um
 * arrasto de dois segundos enche sozinho o teto de `UNDO_LIMIT` passos, e um
 * Ctrl+Z volta um pixel em vez de desfazer o movimento.
 *
 * A regra que o usuário pediu: **o histórico registra o estado de quando o
 * botão do mouse (ou o dedo) é solto**; o que passa entre o começo e o fim do
 * gesto não interessa. É isso que estas duas funções fazem:
 *
 * - `beginUndoBatch` (no `pointerdown`) tira um retrato do estado e PAUSA o
 *   rastreio do `zundo` — as escritas do arrasto acontecem normais, e nenhuma
 *   entra no histórico;
 * - `endUndoBatch` (no `pointerup`) religa o rastreio e empilha UM passo: o
 *   retrato de antes do gesto. O undo então volta para onde o boneco estava
 *   quando o gesto começou, e o redo devolve onde ele parou.
 *
 * Gesto que não escreveu nada — clique no gizmo sem arrastar, dois dedos que
 * acabaram virando câmera — não deixa passo: a comparação é a mesma
 * `undoEquality` do store, e ela vê que a referência de `figures` não mudou.
 *
 * A contagem (`depth`) é o que permite aninhar: no módulo de poses um arrasto
 * de junta e o gesto de torção podem se sobrepor, e o gesto composto continua
 * sendo um passo só.
 */

let depth = 0
let snapshot: UndoTrackedState | null = null

/**
 * Identifica o lote aberto. A rede de segurança fecha por `setTimeout`, e sem
 * isto ela poderia fechar um gesto NOVO que tivesse começado no meio-tempo.
 */
let generation = 0

/** Está no meio de um gesto? Exportado para os testes e para diagnóstico. */
export function isUndoBatchOpen(): boolean {
  return depth > 0
}

export function beginUndoBatch(): void {
  installSafetyNet()
  depth += 1
  if (depth > 1) return
  generation += 1
  snapshot = undoPartialize(useFiguresStore.getState())
  useFiguresStore.temporal.getState().pause()
}

export function endUndoBatch(): void {
  if (depth === 0) return
  depth -= 1
  if (depth > 0) return
  closeBatch()
}

function closeBatch(): void {
  depth = 0
  const before = snapshot
  snapshot = null
  useFiguresStore.temporal.getState().resume()
  if (!before) return

  const after = undoPartialize(useFiguresStore.getState())
  if (undoEquality(before, after)) return

  // O passo é empilhado À MÃO porque o `zundo` estava pausado justamente para
  // não empilhar os intermediários. Descartar o `futureStates` é o que toda
  // edição nova faz: o redo pendente deixou de valer.
  useFiguresStore.temporal.setState((state) => ({
    pastStates: [...state.pastStates, before].slice(-UNDO_LIMIT),
    futureStates: [],
  }))
}

/**
 * Props de ponteiro para um controle CONTÍNUO de painel (`<input
 * type="range">`): arrastar o slider vira um passo de undo só, como arrastar um
 * gizmo — antes disso, cada pixel do trajeto era um passo.
 *
 * Ajuste por TECLADO (setas com o slider em foco) não passa por aqui, e é de
 * propósito: cada toque de seta é um ajuste discreto, e desfazer um a um é o
 * que se espera dele.
 */
export const UNDO_BATCH_POINTER_PROPS = {
  onPointerDown: beginUndoBatch,
  onPointerUp: endUndoBatch,
  onPointerCancel: endUndoBatch,
} as const

// ---------------------------------------------------------------------------
// Rede de segurança
// ---------------------------------------------------------------------------

/**
 * Um gesto que começa e nunca termina (o dedo sai da tela, a janela perde o
 * foco, um `pointerup` que o componente não recebeu) deixaria o histórico
 * PAUSADO para sempre — o undo pararia de funcionar sem nenhum aviso. A rede
 * fecha o lote quando não há mais nenhum ponteiro pressionado.
 *
 * O fechamento é adiado por uma volta do loop de eventos porque quem termina o
 * gesto de verdade ainda tem trabalho a fazer no mesmo `pointerup`: o módulo de
 * poses despacha ali o último movimento pendente do rAF, e essa escrita
 * precisa cair DENTRO do lote.
 */
let safetyNetInstalled = false

const pressedPointers = new Set<number>()

function installSafetyNet(): void {
  if (safetyNetInstalled || typeof window === 'undefined') return
  safetyNetInstalled = true

  window.addEventListener('pointerdown', (event) => {
    pressedPointers.add(event.pointerId)
  })
  window.addEventListener('pointerup', handlePointerRelease)
  window.addEventListener('pointercancel', handlePointerRelease)
  window.addEventListener('blur', () => {
    pressedPointers.clear()
    scheduleClose()
  })
}

function handlePointerRelease(event: PointerEvent): void {
  pressedPointers.delete(event.pointerId)
  // Com um dedo ainda na tela o gesto continua (a torção de dois dedos do
  // módulo de poses solta um ponteiro de cada vez).
  if (pressedPointers.size === 0) scheduleClose()
}

function scheduleClose(): void {
  if (depth === 0) return
  const pending = generation
  setTimeout(() => {
    if (depth > 0 && generation === pending) closeBatch()
  }, 0)
}
