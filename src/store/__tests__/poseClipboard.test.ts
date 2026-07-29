import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'
import { uniqueClipboardName, usePoseClipboardStore } from '../poseClipboardStore'
import { getHeightScale } from '../../figure/skeleton'

const figureById = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!
const clipboard = () => usePoseClipboardStore.getState()

describe('uniqueClipboardName', () => {
  it('usa o nome pedido quando ele está livre', () => {
    expect(uniqueClipboardName([], 'Boneco 1')).toBe('Boneco 1')
  })

  it('numera a partir de (2) quando o nome já está na lista', () => {
    const entries = [{ name: 'Boneco 1' }, { name: 'Boneco 1 (2)' }] as never

    expect(uniqueClipboardName(entries, 'Boneco 1')).toBe('Boneco 1 (3)')
  })

  it('cai num nome genérico quando o pedido é vazio', () => {
    expect(uniqueClipboardName([], '   ')).toBe('Pose')
  })
})

describe('área de transferência de poses', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    usePoseClipboardStore.setState(usePoseClipboardStore.getInitialState())
  })

  it('copia a pose do boneco com o nome dele', () => {
    const a = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'running')

    const id = clipboard().copyPose(figureById(a))

    expect(clipboard().entries).toHaveLength(1)
    expect(clipboard().entries[0].id).toBe(id)
    expect(clipboard().entries[0].name).toBe(figureById(a).name)
    expect(clipboard().entries[0].pose['hip.L']).toEqual(figureById(a).pose['hip.L'])
  })

  it('desambigua duas cópias do mesmo boneco', () => {
    const a = useFiguresStore.getState().addFigure() as string
    clipboard().copyPose(figureById(a))
    clipboard().copyPose(figureById(a))

    const nome = figureById(a).name
    expect(clipboard().entries.map((entry) => entry.name)).toEqual([nome, `${nome} (2)`])
    expect(new Set(clipboard().entries.map((entry) => entry.id)).size).toBe(2)
  })

  it('remove só a entrada pedida', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const primeiro = clipboard().copyPose(figureById(a))
    const segundo = clipboard().copyPose(figureById(a))

    clipboard().removePose(primeiro)

    expect(clipboard().entries.map((entry) => entry.id)).toEqual([segundo])
  })

  /**
   * A razão de ser do recurso: a área de transferência vive FORA do
   * `figuresStore`, então trocar de cena (que substitui figuras, animações e
   * biblioteca de poses de uma vez) não a esvazia.
   */
  it('sobrevive a trocar a cena inteira', () => {
    const a = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'sitting')
    clipboard().copyPose(figureById(a))

    useFiguresStore.setState(useFiguresStore.getInitialState())

    expect(useFiguresStore.getState().figures).toHaveLength(0)
    expect(clipboard().entries).toHaveLength(1)
  })

  it('cola a pose em outro boneco, preservando onde ele está e para onde encara', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'running')
    useFiguresStore.getState().setPosition(b, [3, 0, -4])
    useFiguresStore.getState().setRootRotation(b, { y: 45 })

    clipboard().copyPose(figureById(a))
    useFiguresStore.getState().pasteFigurePose(b, clipboard().entries[0])

    expect(figureById(b).pose).toEqual(figureById(a).pose)
    expect(figureById(b).position[0]).toBe(3)
    expect(figureById(b).position[2]).toBe(-4)
    expect(figureById(b).rotation).toEqual({ x: 0, y: 45, z: 0 })
  })

  it('devolve a inclinação e a altura do quadril de uma pose deitada', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'lyingSpreadSupine')

    clipboard().copyPose(figureById(a))
    useFiguresStore.getState().pasteFigurePose(b, clipboard().entries[0])

    expect(figureById(b).rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(figureById(b).position[1]).toBeCloseTo(figureById(a).position[1], 6)
  })

  /** Capturar desfaz a escala do boneco de origem; colar refaz na de quem recebe. */
  it('escala o assentamento pela altura de quem recebe', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setHeight(b, 1.5)
    useFiguresStore.getState().applyPosePreset(a, 'sitting')

    clipboard().copyPose(figureById(a))
    useFiguresStore.getState().pasteFigurePose(b, clipboard().entries[0])

    const razao = getHeightScale(1.5) / getHeightScale(figureById(a).height)
    expect(figureById(b).position[1]).toBeCloseTo(figureById(a).position[1] * razao, 6)
  })

  it('não mexe nas juntas travadas de quem recebe', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'running')
    // -40 e não um valor positivo: o cotovelo só dobra para um lado, e um
    // ângulo fora do limite seria grampeado a 0 antes mesmo de colar.
    useFiguresStore.getState().setJointRotation(b, 'elbow.L', { x: -40 })
    useFiguresStore.getState().toggleJointLock(b, 'elbow.L')

    clipboard().copyPose(figureById(a))
    useFiguresStore.getState().pasteFigurePose(b, clipboard().entries[0])

    expect(figureById(b).pose['elbow.L'].x).toBe(-40)
    expect(figureById(b).pose['hip.L']).toEqual(figureById(a).pose['hip.L'])
  })

  it('colar é um passo de undo só', () => {
    const a = useFiguresStore.getState().addFigure() as string
    const b = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(a, 'running')
    clipboard().copyPose(figureById(a))

    const antes = figureById(b).pose
    useFiguresStore.getState().pasteFigurePose(b, clipboard().entries[0])
    expect(figureById(b).pose).not.toEqual(antes)

    useFiguresStore.temporal.getState().undo()
    expect(figureById(b).pose).toEqual(antes)
  })

  it('ignora um boneco inexistente', () => {
    const a = useFiguresStore.getState().addFigure() as string
    clipboard().copyPose(figureById(a))

    expect(() =>
      useFiguresStore.getState().pasteFigurePose('figure-inexistente', clipboard().entries[0]),
    ).not.toThrow()
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })
})
