import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { LookAtFieldset } from '../LookAtFieldset'

/**
 * O controle de "Olhar para" (PLANO.md item 32). A matemática mora no
 * `lookAt.test.ts`, que é puro; aqui trava-se a UI: quem pode ser alvo, o que
 * o clique escreve e que ele é UM passo de undo.
 */
describe('LookAtFieldset (item 32)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  function addFigure(name: string, position: [number, number, number]) {
    const id = useFiguresStore.getState().addFigure(name) as string
    act(() => useFiguresStore.getState().setPosition(id, position))
    return id
  }

  it('a câmera de cena é o alvo padrão, e o clique gira pescoço e cabeça', async () => {
    const user = userEvent.setup()
    let id = ''
    act(() => {
      id = addFigure('Herói', [0, 0, 0])
    })
    render(<LookAtFieldset figureId={id} />)
    useFiguresStore.temporal.getState().clear()

    expect(screen.getByLabelText('Alvo')).toHaveValue('scene-camera')

    await user.click(screen.getByRole('button', { name: 'Olhar para' }))

    const pose = useFiguresStore.getState().figures[0].pose
    expect(pose.neck).toBeDefined()
    expect(pose.head).toBeDefined()
    expect(Math.abs(pose.neck.y) + Math.abs(pose.head.y)).toBeGreaterThan(1)

    // Um clique, UM passo de undo — pescoço e cabeça entram numa escrita só.
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('lista os OUTROS bonecos visíveis como alvo, nunca o próprio nem os escondidos', async () => {
    const user = userEvent.setup()
    let id = ''
    let outroId = ''
    act(() => {
      id = addFigure('Herói', [0, 0, 0])
      outroId = addFigure('Vilão', [2, 0, 0])
      addFigure('Fantasma', [-2, 0, 0])
    })
    act(() => useFiguresStore.getState().toggleVisibility(useFiguresStore.getState().figures[2].id))

    render(<LookAtFieldset figureId={id} />)
    const alvo = screen.getByLabelText('Alvo')

    expect(screen.queryByRole('option', { name: 'Herói' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Fantasma' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Vilão' })).toBeInTheDocument()

    // Mirar no vilão, que está à direita: a guinada sai positiva no mundo.
    await user.selectOptions(alvo, outroId)
    await user.click(screen.getByRole('button', { name: 'Olhar para' }))

    const pose = useFiguresStore.getState().figures[0].pose
    expect(pose.neck.y + pose.head.y).toBeGreaterThan(10)
  })

  it('junta travada não se mexe — nem por aqui (#42)', async () => {
    const user = userEvent.setup()
    let id = ''
    act(() => {
      id = addFigure('Herói', [0, 0, 0])
    })
    act(() => {
      useFiguresStore.getState().toggleJointLock(id, 'neck')
      useFiguresStore.getState().toggleJointLock(id, 'head')
    })
    render(<LookAtFieldset figureId={id} />)

    await user.click(screen.getByRole('button', { name: 'Olhar para' }))

    const pose = useFiguresStore.getState().figures[0].pose
    expect(pose.neck).toEqual({ x: 0, y: 0, z: 0 })
    expect(pose.head).toEqual({ x: 0, y: 0, z: 0 })
  })
})
