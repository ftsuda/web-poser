import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { useIKStore } from '../../store/ikStore'
import { PropertiesPanel } from '../PropertiesPanel'

async function renderPropertiesPanel() {
  const utils = render(<PropertiesPanel />)
  await act(async () => {})
  return utils
}

describe('PropertiesPanel', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useIKStore.setState(useIKStore.getInitialState())
  })

  it('shows the panel title and the empty-state message when nothing is selected', async () => {
    await renderPropertiesPanel()
    expect(screen.getByRole('heading', { name: 'Propriedades' })).toBeInTheDocument()
    expect(
      screen.getByText('Selecione um boneco ou uma articulação para ver as propriedades.'),
    ).toBeInTheDocument()
  })

  describe('with the root (figure placement) selected', () => {
    it('shows position and rotation fields and edits them through the store', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      expect(screen.getByText('Herói')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Posição (m)' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Rotação (°)' })).toBeInTheDocument()

      const positionX = screen.getByLabelText('X', { selector: '#position-x' })
      await user.clear(positionX)
      await user.type(positionX, '1.5')

      expect(useFiguresStore.getState().figures[0].position[0]).toBeCloseTo(1.5, 2)

      const rotationY = screen.getByLabelText('Y', { selector: '#rotation-y' })
      await user.clear(rotationY)
      await user.type(rotationY, '45')

      expect(useFiguresStore.getState().figures[0].rotation.y).toBeCloseTo(45, 2)
    })

    it('applies a preset pose through the store when a preset button is clicked', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      expect(screen.getByRole('group', { name: 'Poses predefinidas' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Sentado' }))

      const figure = useFiguresStore.getState().figures[0]
      expect(figure.pose['hip.L'].x).toBeLessThan(0)
      expect(figure.pose['knee.L'].x).toBeGreaterThan(0)
    })
  })

  describe('with a joint selected', () => {
    it('shows one slider per degree of freedom, bounded to the joint limits', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      expect(screen.getByText('elbow.L')).toBeInTheDocument()

      const xSlider = screen.getByRole('slider', { name: 'X' }) as HTMLInputElement
      expect(xSlider.min).toBe('0')
      expect(xSlider.max).toBe('150')

      const ySlider = screen.getByRole('slider', { name: 'Y' }) as HTMLInputElement
      expect(ySlider.min).toBe('-80')
      expect(ySlider.max).toBe('80')
    })

    it('changes the joint rotation through the store when a slider moves', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      const xSlider = screen.getByRole('slider', { name: 'X' }) as HTMLInputElement
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set
      await act(async () => {
        nativeSetter?.call(xSlider, '90')
        xSlider.dispatchEvent(new Event('input', { bubbles: true }))
      })

      expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).toBe(90)
    })

    it('marks the active axis and lets the user change it', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('shoulder.L')
      await renderPropertiesPanel()

      const xButton = screen.getByRole('button', { name: 'X' })
      const yButton = screen.getByRole('button', { name: 'Y' })
      expect(xButton).toHaveAttribute('aria-pressed', 'true')
      expect(yButton).toHaveAttribute('aria-pressed', 'false')

      await user.click(yButton)
      expect(useFiguresStore.getState().activeAxis).toBe('y')
    })

    it('shows an IK toggle only for joints belonging to a limb chain, not for e.g. the spine', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)

      useFiguresStore.getState().selectJoint('elbow.L')
      const { unmount } = await renderPropertiesPanel()
      expect(screen.getByText('IK ativo neste membro')).toBeInTheDocument()
      unmount()

      useFiguresStore.getState().selectJoint('spine')
      await renderPropertiesPanel()
      expect(screen.queryByText('IK ativo neste membro')).not.toBeInTheDocument()
    })

    it('enabling IK hides the shoulder/elbow FK sliders and shows editable target fields', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      expect(screen.getByRole('slider', { name: 'X' })).toBeInTheDocument()

      await user.click(screen.getByLabelText('IK ativo neste membro'))

      expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(true)
      expect(screen.queryByRole('slider', { name: 'X' })).not.toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Alvo do IK (m)' })).toBeInTheDocument()
    })

    it('editing the IK target fields moves the target and re-solves the pose', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      await user.click(screen.getByLabelText('IK ativo neste membro'))

      const targetX = screen.getByLabelText('X', { selector: '#ik-target-x' })
      await user.clear(targetX)
      await user.type(targetX, '0.5')

      const target = useIKStore.getState().getTarget(id, 'wrist.L')!
      expect(target[0]).toBeCloseTo(0.5, 1)
      expect(useFiguresStore.getState().figures[0].pose['shoulder.L']).toBeDefined()
    })

    it('shows a warning when the IK target is out of reach', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      await user.click(screen.getByLabelText('IK ativo neste membro'))
      const targetX = screen.getByLabelText('X', { selector: '#ik-target-x' })
      await user.clear(targetX)
      await user.type(targetX, '100')

      expect(useIKStore.getState().getReached(id, 'wrist.L')).toBe(false)
      expect(
        screen.getByText('Alvo fora de alcance — aproximação mais próxima aplicada.'),
      ).toBeInTheDocument()
    })

    it("the wrist's own rotation sliders remain visible even when the arm is in IK mode", async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()
      await user.click(screen.getByLabelText('IK ativo neste membro'))

      await act(async () => {
        useFiguresStore.getState().selectJoint('wrist.L')
      })
      expect(screen.getByRole('slider', { name: 'X' })).toBeInTheDocument()
    })
  })
})
