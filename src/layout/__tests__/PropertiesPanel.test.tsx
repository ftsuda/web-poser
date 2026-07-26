import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AXIS_COLORS } from '../../scene/axisColors'
import { useFiguresStore } from '../../store/figuresStore'
import { useIKStore } from '../../store/ikStore'
import { useUIStore } from '../../store/uiStore'
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
    useUIStore.setState(useUIStore.getInitialState())
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

      // A rotação da raiz virou slider na fase 9 (item 13), como nas demais juntas.
      const rotationGroup = screen.getByRole('group', { name: 'Rotação (°)' })
      const rotationY = within(rotationGroup).getByRole('slider', { name: 'Y' })
      fireEvent.change(rotationY, { target: { value: '45' } })

      expect(useFiguresStore.getState().figures[0].rotation.y).toBeCloseTo(45, 2)
    })

    it('gives the root rotation sliders a full turn of range and the gizmo axis colors (fase 9, itens 9 e 13)', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      const rotationGroup = screen.getByRole('group', { name: 'Rotação (°)' })
      const sliderX = within(rotationGroup).getByRole('slider', { name: 'X' })
      expect(sliderX).toHaveAttribute('min', '-180')
      expect(sliderX).toHaveAttribute('max', '180')
      expect(sliderX).toHaveStyle({ accentColor: AXIS_COLORS.x })

      const positionZ = screen.getByLabelText('Z', { selector: '#position-z' })
      expect(positionZ).toHaveStyle({ accentColor: AXIS_COLORS.z })
    })

    it('resets only the root rotation, keeping the position (fase 9, item 13)', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().setPosition(id, [2, 0, 1])
      useFiguresStore.getState().setRootRotation(id, { y: 90 })
      await renderPropertiesPanel()

      await user.click(screen.getByRole('button', { name: 'Resetar rotação' }))

      expect(useFiguresStore.getState().figures[0].rotation).toEqual({ x: 0, y: 0, z: 0 })
      expect(useFiguresStore.getState().figures[0].position).toEqual([2, 0, 1])
    })

    it('switches the root gizmo between move and rotate (fase 9, item 13)', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      expect(screen.getByRole('button', { name: 'Mover' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Girar' }))
      expect(useUIStore.getState().rootGizmoMode).toBe('rotate')
      expect(screen.getByRole('button', { name: 'Girar' })).toHaveAttribute('aria-pressed', 'true')
    })

    /** O combo escolhe; o botão "Aplicar pose" é que aplica (DECISOES.md #36). */
    async function escolherEAplicar(user: ReturnType<typeof userEvent.setup>, pose: string) {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), pose)
      await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))
    }

    it('applies a preset pose through the store when the apply button is clicked', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      expect(screen.getByRole('group', { name: 'Poses predefinidas' })).toBeInTheDocument()
      await escolherEAplicar(user, 'Sentado')

      const figure = useFiguresStore.getState().figures[0]
      expect(figure.pose['hip.L'].x).toBeLessThan(0)
      expect(figure.pose['knee.L'].x).toBeGreaterThan(0)
    })

    it('applies the T-pose (palms down) through the store when the T-pose button is clicked', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      // Começa numa pose diferente (a T-pose já é o padrão ao criar um
      // boneco — ver DECISOES.md #19) para o clique no botão ter efeito.
      useFiguresStore.getState().applyPosePreset(id, 'standing')
      await renderPropertiesPanel()

      await escolherEAplicar(user, 'T-pose')

      const figure = useFiguresStore.getState().figures[0]
      expect(figure.pose['shoulder.L'].z).toBe(90)
      expect(figure.pose['shoulder.R'].z).toBe(-90)
    })

    /**
     * O aviso de par (DECISOES.md #41) aparece só quando aplicar VAI mesmo
     * mexer no outro boneco. Com um boneco só — ou com três, onde não há como
     * saber qual é o parceiro — a montagem continua manual, e quem manda é a
     * dica da pose, que traz a distância.
     */
    it('avisa que a pose em dupla também vai posar o outro boneco, e só quando são dois', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      const { rerender } = await renderPropertiesPanel()

      const aviso = /também põe o outro boneco na pose correspondente/
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Aperto de mão')
      expect(screen.queryByText(aviso)).not.toBeInTheDocument()

      act(() => {
        useFiguresStore.getState().addFigure('Coadjuvante')
      })
      rerender(<PropertiesPanel />)
      expect(screen.getByText(aviso)).toBeInTheDocument()

      // Pose solo: nada a avisar, mesmo com dois bonecos em cena.
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Correndo')
      expect(screen.queryByText(aviso)).not.toBeInTheDocument()
    })

    it('aplica a pose em dupla nos dois bonecos pelo botão do painel', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      const outro = useFiguresStore.getState().addFigure('Coadjuvante') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      await escolherEAplicar(user, 'Dança (condutor)')

      const parceiro = useFiguresStore.getState().figures.find((f) => f.id === outro)!
      expect(parceiro.pose['shoulder.R'].z).not.toBe(0)
      expect(parceiro.rotation.y).toBe(180)
      expect(parceiro.position[2]).toBeCloseTo(0.36, 5)
    })

    it('lets the user jump to any joint (including ones hidden behind other body parts) via the joint select combobox', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      const jointSelect = screen.getByLabelText('Selecionar junta') as HTMLSelectElement
      await user.selectOptions(jointSelect, 'fingersTip.L')

      expect(useFiguresStore.getState().selectedJointName).toBe('fingersTip.L')
      expect(screen.getByText('fingersTip.L', { selector: 'span' })).toBeInTheDocument()
    })
  })

  describe('with a joint selected', () => {
    it('shows one slider per degree of freedom, bounded to the joint limits', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      expect(screen.getByText('elbow.L', { selector: 'span' })).toBeInTheDocument()

      const xSlider = screen.getByRole('slider', { name: 'X' }) as HTMLInputElement
      expect(xSlider.min).toBe('-150')
      expect(xSlider.max).toBe('0')

      // Faixa centrada na torção neutra de +90 (ver DECISOES.md #25).
      const ySlider = screen.getByRole('slider', { name: 'Y' }) as HTMLInputElement
      expect(ySlider.min).toBe('0')
      expect(ySlider.max).toBe('180')
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
        nativeSetter?.call(xSlider, '-90')
        xSlider.dispatchEvent(new Event('input', { bubbles: true }))
      })

      expect(useFiguresStore.getState().figures[0].pose['elbow.L'].x).toBe(-90)
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

  describe('poses de mão e simetria (DECISOES.md #30)', () => {
    async function withJointSelected(jointName: string) {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint(jointName)
      await renderPropertiesPanel()
      return id
    }

    it('oferece as 5 poses novas de corpo, com descrição no tooltip', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      for (const label of ['Deitado', 'Fetal', 'Luta', 'Superman', 'Modelo']) {
        expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
      }
      // A descrição da pose escolhida aparece abaixo do combo, no lugar do
      // antigo tooltip de cada botão.
      const user = userEvent.setup()
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Fetal')
      expect(screen.getByText('Sentado no chão, abraçando os joelhos')).toBeInTheDocument()
    })

    /** Poses de luta em par e sorteio (DECISOES.md #35). */
    it('oferece as 6 poses de luta em par, com descrição no tooltip', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      for (const label of [
        'Soco (dando)',
        'Soco (levando)',
        'Chute (dando)',
        'Chute (levando)',
        'Gravata (aplicando)',
        'Gravata (recebendo)',
      ]) {
        expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
      }
    })

    it('sorteia uma pose pelo botão, sem tirar o boneco do lugar', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()
      const before = useFiguresStore.getState().figures.find((f) => f.id === id)!

      await user.click(screen.getByRole('button', { name: 'Aleatória' }))

      const after = useFiguresStore.getState().figures.find((f) => f.id === id)!
      expect(after.pose).not.toEqual(before.pose)
      expect(after.position).toEqual(before.position)
    })

    it('deita o boneco no chão pelo botão, ajustando também rotação e altura', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Deitado')
      await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))

      const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
      expect(figure.rotation.x).toBe(-90)
      expect(figure.position[1]).toBeLessThan(0)
    })

    it('mostra as poses da mão DAQUELE lado ao selecionar qualquer junta do braço', async () => {
      await withJointSelected('elbow.R')
      expect(screen.getByRole('group', { name: 'Poses da mão direita' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Poses da mão esquerda' })).not.toBeInTheDocument()

      await act(async () => {
        useFiguresStore.getState().selectJoint('fingersTip.L')
      })
      expect(screen.getByRole('group', { name: 'Poses da mão esquerda' })).toBeInTheDocument()
    })

    it('não mostra poses de mão em juntas fora do braço', async () => {
      await withJointSelected('knee.L')
      expect(screen.queryByRole('group', { name: 'Poses da mão esquerda' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Poses da mão direita' })).not.toBeInTheDocument()
    })

    it('fecha a mão do lado selecionado, sem mexer na outra', async () => {
      const user = userEvent.setup()
      const id = await withJointSelected('wrist.R')

      await user.click(screen.getByRole('button', { name: 'Fechada' }))

      const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
      expect(figure.pose['fingersBase.R'].x).toBeGreaterThan(60)
      expect(figure.pose['fingersBase.L'].x).toBe(0)
    })

    it('espelha e inverte os lados a partir do painel da raiz', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -50 })
      await renderPropertiesPanel()

      expect(screen.getByRole('group', { name: 'Simetria' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copiar direito → esquerdo' }))
      expect(useFiguresStore.getState().figures[0].pose['shoulder.L'].x).toBe(-50)

      await user.click(screen.getByRole('button', { name: 'Inverter lados' }))
      expect(useFiguresStore.getState().figures[0].pose['shoulder.R'].x).toBe(-50)
    })

    /**
     * Escopo parcial (DECISOES.md #34): a simetria deixou de ser exclusiva da
     * raiz — com uma junta selecionada, ela vale só daquela junta para baixo.
     */
    it('espelha só a cadeia da junta selecionada, deixando o resto intacto', async () => {
      const user = userEvent.setup()
      const id = await withJointSelected('shoulder.R')
      act(() => {
        useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -50 })
        useFiguresStore.getState().setJointRotation(id, 'hip.R', { x: -35 })
      })

      await user.click(screen.getByRole('button', { name: 'Copiar direito → esquerdo' }))

      const pose = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose
      expect(pose['shoulder.L'].x).toBe(-50)
      expect(pose['hip.L'].x).toBe(0)
    })

    it('diz na dica até onde a operação vale', async () => {
      await withJointSelected('shoulder.R')
      expect(
        screen.getByText('Vale de shoulder.R para baixo, nos dois lados — o resto não muda.'),
      ).toBeInTheDocument()
    })

    it('some onde não há junta pareada embaixo (cabeça), mas fica no tronco (os braços)', async () => {
      await withJointSelected('spine')
      expect(screen.getByRole('group', { name: 'Simetria' })).toBeInTheDocument()

      await act(async () => {
        useFiguresStore.getState().selectJoint('head')
      })
      expect(screen.queryByRole('group', { name: 'Simetria' })).not.toBeInTheDocument()
    })
  })
})

describe('PropertiesPanel — resetar junta e cores de eixo (fase 9, itens 6 e 9)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useIKStore.setState(useIKStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('reseta só a junta selecionada, preservando as demais', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    useFiguresStore.getState().selectFigure(id)
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 90 })
    useFiguresStore.getState().setJointRotation(id, 'knee.R', { x: 60 })
    useFiguresStore.getState().selectJoint('knee.L')
    await renderPropertiesPanel()

    await user.click(screen.getByRole('button', { name: 'Resetar esta junta' }))

    const figure = useFiguresStore.getState().figures[0]
    expect(figure.pose['knee.L'].x).toBe(0)
    expect(figure.pose['knee.R'].x).toBe(60)
  })

  it('pinta cada slider de junta com a cor do eixo do gizmo', async () => {
    const id = useFiguresStore.getState().addFigure('Herói') as string
    useFiguresStore.getState().selectFigure(id)
    useFiguresStore.getState().selectJoint('shoulder.L')
    await renderPropertiesPanel()

    const rotationGroup = screen.getByRole('group', { name: 'Rotação (°)' })
    expect(within(rotationGroup).getByRole('slider', { name: 'X' })).toHaveStyle({
      accentColor: AXIS_COLORS.x,
    })
    expect(within(rotationGroup).getByRole('button', { name: 'X' })).toHaveStyle({
      color: AXIS_COLORS.x,
    })
    expect(within(rotationGroup).getByRole('slider', { name: 'Z' })).toHaveStyle({
      accentColor: AXIS_COLORS.z,
    })
  })
})
