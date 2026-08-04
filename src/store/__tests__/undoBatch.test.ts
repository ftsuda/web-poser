import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_LIMIT, useFiguresStore } from '../figuresStore'
import { beginUndoBatch, endUndoBatch, isUndoBatchOpen } from '../undoBatch'

/** O histórico só enxerga o recorte de `undoPartialize` — aqui basta a posição. */
function positionOf(id: string): readonly [number, number, number] {
  return useFiguresStore.getState().figures.find((figure) => figure.id === id)!.position
}

function pastLength(): number {
  return useFiguresStore.temporal.getState().pastStates.length
}

describe('lote de undo (gesto contínuo = um passo só)', () => {
  beforeEach(() => {
    // Lote deixado aberto por um teste anterior não pode vazar para o seguinte.
    while (isUndoBatchOpen()) endUndoBatch()
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useFiguresStore.temporal.getState().resume()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('empilha UM passo por gesto, por mais eventos que ele escreva', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    for (let step = 1; step <= 20; step += 1) {
      useFiguresStore.getState().setPosition(id, [step * 0.01, 0, 0])
    }
    // Enquanto o botão está pressionado, nada foi registrado.
    expect(pastLength()).toBe(0)

    endUndoBatch()

    expect(pastLength()).toBe(1)
  })

  it('o undo volta ao estado de ANTES do gesto, e não a um intermediário', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1, 0, 0])
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    for (let step = 1; step <= 20; step += 1) {
      useFiguresStore.getState().setPosition(id, [1 + step * 0.01, 0, 0])
    }
    endUndoBatch()

    expect(positionOf(id)[0]).toBeCloseTo(1.2)
    useFiguresStore.temporal.getState().undo()
    expect(positionOf(id)).toEqual([1, 0, 0])
  })

  it('o redo devolve o estado do fim do gesto (o de quando o botão foi solto)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    useFiguresStore.getState().setPosition(id, [0.5, 0, 0])
    useFiguresStore.getState().setPosition(id, [0.9, 0, 0])
    endUndoBatch()

    useFiguresStore.temporal.getState().undo()
    expect(positionOf(id)).toEqual([0, 0, 0])
    useFiguresStore.temporal.getState().redo()
    expect(positionOf(id)).toEqual([0.9, 0, 0])
  })

  it('gesto que não escreveu nada (clique sem arrastar) não deixa passo nenhum', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    // Só seleção — não é conteúdo, e portanto não é histórico.
    useFiguresStore.getState().selectJoint('elbow.L')
    endUndoBatch()

    expect(pastLength()).toBe(0)
  })

  it('o passo do gesto descarta o redo pendente, como qualquer edição nova', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1, 0, 0])
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.temporal.getState().futureStates).toHaveLength(1)

    beginUndoBatch()
    useFiguresStore.getState().setPosition(id, [2, 0, 0])
    endUndoBatch()

    expect(useFiguresStore.temporal.getState().futureStates).toHaveLength(0)
  })

  it('lotes aninhados fecham só no último `end` — um gesto composto é um passo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    beginUndoBatch()
    useFiguresStore.getState().setPosition(id, [0.3, 0, 0])
    endUndoBatch()
    expect(isUndoBatchOpen()).toBe(true)
    expect(pastLength()).toBe(0)

    endUndoBatch()

    expect(isUndoBatchOpen()).toBe(false)
    expect(pastLength()).toBe(1)
  })

  it('`endUndoBatch` sem lote aberto não mexe no histórico', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setPosition(id, [1, 0, 0])
    const antes = pastLength()

    endUndoBatch()
    endUndoBatch()

    expect(pastLength()).toBe(antes)
  })

  it('fora do lote, cada edição continua sendo seu próprio passo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().setPosition(id, [0.1, 0, 0])
    useFiguresStore.getState().setPosition(id, [0.2, 0, 0])

    expect(pastLength()).toBe(2)
  })

  it('o passo do gesto respeita o teto do histórico', () => {
    const id = useFiguresStore.getState().addFigure() as string
    for (let step = 0; step < UNDO_LIMIT + 5; step += 1) {
      useFiguresStore.getState().setPosition(id, [step * 0.01, 0, 0])
    }
    expect(pastLength()).toBe(UNDO_LIMIT)

    beginUndoBatch()
    useFiguresStore.getState().setPosition(id, [5, 0, 0])
    endUndoBatch()

    expect(pastLength()).toBe(UNDO_LIMIT)
  })

  it('gesto interrompido sem `end` (dedo fora da tela, alt-tab) é fechado pelo `pointerup` da janela', () => {
    vi.useFakeTimers()
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.temporal.getState().clear()

    beginUndoBatch()
    useFiguresStore.getState().setPosition(id, [0.4, 0, 0])
    // Ninguém chamou `endUndoBatch` — o histórico ficaria pausado para sempre.
    window.dispatchEvent(new Event('pointerup'))
    vi.runAllTimers()

    expect(isUndoBatchOpen()).toBe(false)
    expect(pastLength()).toBe(1)
    // E o histórico volta a registrar normalmente depois.
    useFiguresStore.getState().setPosition(id, [0.8, 0, 0])
    expect(pastLength()).toBe(2)
  })
})
