import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rootAxisLockToken } from '../../figure/jointLocks'
import { resolvePosePreset } from '../../figure/posePresets'
import { AXIS_COLORS } from '../../scene/axisColors'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'

vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'
import { PropertiesPanel } from '../PropertiesPanel'

async function renderPropertiesPanel() {
  const utils = render(<PropertiesPanel />)
  await act(async () => {})
  return utils
}

/**
 * As seções de uso ocasional do painel (guardar/copiar pose e simetria) nascem
 * RECOLHIDAS — uma escolha de layout, `uiPreferences.ts`. Estes testes são
 * sobre o conteúdo, então começam todas abertas.
 */
function abrirSecoes() {
  useUIStore.setState((state) => ({
    collapsedSections: Object.fromEntries(
      Object.keys(state.collapsedSections).map((key) => [key, false]),
    ) as typeof state.collapsedSections,
  }))
}

describe('PropertiesPanel', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
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

    it('arrastar o slider é UM passo de undo, e ele volta ao valor de antes do arrasto (DECISOES.md #118)', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()
      useFiguresStore.temporal.getState().clear()

      const rotationGroup = screen.getByRole('group', { name: 'Rotação (°)' })
      const rotationY = within(rotationGroup).getByRole('slider', { name: 'Y' })

      fireEvent.pointerDown(rotationY)
      for (const value of ['10', '20', '30', '40', '50']) {
        fireEvent.change(rotationY, { target: { value } })
      }
      // Enquanto o botão está pressionado, o histórico não registra nada.
      expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
      fireEvent.pointerUp(rotationY)

      expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(1)
      expect(useFiguresStore.getState().figures[0].rotation.y).toBeCloseTo(50, 2)

      act(() => useFiguresStore.temporal.getState().undo())
      expect(useFiguresStore.getState().figures[0].rotation.y).toBeCloseTo(0, 2)
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
      expect(useUIStore.getState().gizmoMode).toBe('rotate')
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

    it('filtra a lista de poses pelo nome, sem acento, mantendo a escolhida visível (item 35)', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      const combo = screen.getByRole('combobox', { name: 'Poses predefinidas' })
      expect(within(combo).getByRole('option', { name: 'Correndo' })).toBeInTheDocument()

      await user.type(screen.getByLabelText('Filtrar poses'), 'sentado')

      expect(within(combo).queryByRole('option', { name: 'Correndo' })).not.toBeInTheDocument()
      expect(within(combo).getByRole('option', { name: 'Sentado' })).toBeInTheDocument()
      // "Sentado, pernas esticadas" (grupo Chão) também casa — o filtro vale
      // para todos os grupos, não só para o primeiro.
      expect(within(combo).getByRole('option', { name: 'Sentado, pernas esticadas' })).toBeInTheDocument()
      // A escolhida ("Em pé", o default) nunca some do combo, senão ele
      // ficaria em branco no meio da digitação.
      expect(within(combo).getByRole('option', { name: 'Em pé' })).toBeInTheDocument()
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

    it('copia a pose para outro boneco pelo combo de destino', async () => {
      const user = userEvent.setup()
      const origem = useFiguresStore.getState().addFigure('Herói') as string
      const destino = useFiguresStore.getState().addFigure('Coadjuvante') as string
      useFiguresStore.getState().setPosition(destino, [2, 0, -1])
      useFiguresStore.getState().selectFigure(origem)
      await renderPropertiesPanel()

      await escolherEAplicar(user, 'Correndo')
      await user.selectOptions(screen.getByLabelText('Copiar pose para'), destino)
      await user.click(screen.getByRole('button', { name: 'Copiar' }))

      const figures = useFiguresStore.getState().figures
      const alvo = figures.find((f) => f.id === destino)!
      expect(alvo.pose).toEqual(figures.find((f) => f.id === origem)!.pose)
      // O outro boneco não sai do lugar nem perde o nome.
      expect(alvo.position[0]).toBe(2)
      expect(alvo.name).toBe('Coadjuvante')
    })

    it('sem outro boneco na cena não há para onde copiar', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      expect(screen.queryByLabelText('Copiar pose para')).not.toBeInTheDocument()
    })

    it('a caixa do par só aparece quando há um par para montar', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      const { rerender } = await renderPropertiesPanel()

      const caixa = 'Posar também o outro boneco'
      // Um boneco só: não há parceiro, e marcar não mudaria nada.
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Aperto de mão')
      expect(screen.queryByLabelText(caixa)).not.toBeInTheDocument()

      act(() => {
        useFiguresStore.getState().addFigure('Coadjuvante')
      })
      rerender(<PropertiesPanel />)
      expect(screen.getByLabelText(caixa)).toBeChecked()

      // Pose solo: sem par, sem caixa.
      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Correndo')
      expect(screen.queryByLabelText(caixa)).not.toBeInTheDocument()
    })

    it('desmarcada, aplicar a pose em dupla deixa o outro boneco intocado', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      const outro = useFiguresStore.getState().addFigure('Coadjuvante') as string
      useFiguresStore.getState().setPosition(outro, [2, 0, -1])
      useFiguresStore.getState().selectFigure(id)
      await renderPropertiesPanel()

      await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Dança (condutor)')
      await user.click(screen.getByLabelText('Posar também o outro boneco'))

      // O aviso troca junto: o painel passa a dizer que a montagem é manual.
      expect(screen.getByText(/o outro boneco não será tocado/)).toBeInTheDocument()

      const antes = useFiguresStore.getState().figures.find((f) => f.id === outro)!
      await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))

      expect(useFiguresStore.getState().figures.find((f) => f.id === outro)).toBe(antes)
      // E quem estava selecionado recebeu a pose normalmente.
      expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose['shoulder.R'].z).not.toBe(0)
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

    /**
     * Seletor de modo do gizmo (W/E) na junta: só aparece nas juntas
     * arrastáveis — mão/dedos e spine/hip.* ficam sempre em rotação.
     */
    it('shows the gizmo mode selector on draggable joints, with the drag hint in translate mode', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      expect(screen.getByRole('group', { name: 'Gizmo' })).toBeInTheDocument()
      // Modo padrão é mover — a dica do arrasto de cadeia aparece.
      expect(screen.getByText(/as juntas acima dela são puxadas até os limites/)).toBeInTheDocument()
      // E os sliders de rotação continuam disponíveis nos dois modos.
      expect(screen.getByRole('slider', { name: 'X' })).toBeInTheDocument()
    })

    it('hides the gizmo mode selector on joints without drag (hand and spine/hip)', async () => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)

      useFiguresStore.getState().selectJoint('spine')
      const { unmount } = await renderPropertiesPanel()
      expect(screen.queryByRole('group', { name: 'Gizmo' })).not.toBeInTheDocument()
      unmount()

      useFiguresStore.getState().selectJoint('fingersTip.L')
      await renderPropertiesPanel()
      expect(screen.queryByRole('group', { name: 'Gizmo' })).not.toBeInTheDocument()
    })

    it('switching the joint gizmo to rotate hides the drag hint and updates the shared mode', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      useFiguresStore.getState().selectJoint('elbow.L')
      await renderPropertiesPanel()

      await user.click(screen.getByRole('button', { name: 'Girar' }))

      expect(useUIStore.getState().gizmoMode).toBe('rotate')
      expect(screen.queryByText(/as juntas acima dela são puxadas/)).not.toBeInTheDocument()
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

    /**
     * As operações de LADO somem onde não há junta pareada embaixo (cabeça); o
     * espelho completo do boneco fica, porque não obedece ao escopo — escondê-lo
     * justamente ali pareceria defeito.
     */
    it('some onde não há junta pareada embaixo (cabeça), mas fica no tronco (os braços)', async () => {
      await withJointSelected('spine')
      expect(screen.getByRole('button', { name: 'Copiar direito → esquerdo' })).toBeInTheDocument()

      await act(async () => {
        useFiguresStore.getState().selectJoint('head')
      })
      expect(screen.queryByRole('button', { name: 'Copiar direito → esquerdo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Inverter lados' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Espelhar o boneco todo' })).toBeInTheDocument()
    })

    /**
     * Espelho completo (pedido do usuário): o que faltava ao "Inverter lados" —
     * as juntas SEM par (tronco, pescoço, cabeça) também têm o ângulo invertido.
     */
    it('espelha o boneco todo, incluindo as juntas sem par', async () => {
      const user = userEvent.setup()
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
      act(() => {
        useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -50 })
        useFiguresStore.getState().setJointRotation(id, 'head', { y: 30 })
        useFiguresStore.getState().setJointRotation(id, 'spine', { z: 12 })
      })
      await renderPropertiesPanel()

      await user.click(screen.getByRole('button', { name: 'Espelhar o boneco todo' }))

      const pose = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose
      // Os membros trocaram de lado, como no "Inverter lados"...
      expect(pose['shoulder.L'].x).toBe(-50)
      expect(pose['shoulder.R'].x).toBe(0)
      // ...e as juntas sem par foram invertidas, que é o que faltava.
      expect(pose.head.y).toBe(-30)
      expect(pose.spine.z).toBe(-12)
    })
  })
})

describe('PropertiesPanel — resetar junta e cores de eixo (fase 9, itens 6 e 9)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
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

/**
 * Biblioteca de poses e travamento de juntas no painel (DECISOES.md #42).
 * O que estes testes travam é o contrato de UI: a pose salva aparece no MESMO
 * combo das de fábrica, aplicar funciona para as duas, e uma junta travada
 * mostra na tela por que os controles não respondem.
 */
describe('PropertiesPanel — biblioteca de poses e travamento (DECISOES.md #42)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
  })

  async function comBonecoSelecionado(nome = 'Herói') {
    const id = useFiguresStore.getState().addFigure(nome) as string
    useFiguresStore.getState().selectFigure(id)
    const utils = await renderPropertiesPanel()
    return { id, ...utils }
  }

  it('salva a pose atual com nome e a lista no mesmo combo das poses de fábrica', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().applyPosePreset(id, 'running')
    })

    await user.click(screen.getByRole('button', { name: 'Salvar pose atual' }))
    await user.type(screen.getByLabelText('Nome da pose'), 'Corrida')
    await user.click(screen.getByRole('button', { name: 'Salvar pose' }))

    expect(useFiguresStore.getState().poseLibrary.map((pose) => pose.name)).toEqual(['Corrida'])
    const combo = screen.getByRole('combobox', { name: 'Poses predefinidas' }) as HTMLSelectElement
    expect(within(combo).getByRole('option', { name: 'Corrida' })).toBeInTheDocument()
    // A pose recém-salva já fica escolhida: o passo seguinte é aplicá-la.
    expect(combo.value).toBe(`saved:${useFiguresStore.getState().poseLibrary[0].id}`)
  })

  it('aplica uma pose da biblioteca no boneco selecionado', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    let poseSalva = ''
    let corrida: Record<string, unknown> = {}
    act(() => {
      useFiguresStore.getState().applyPosePreset(id, 'running')
      poseSalva = useFiguresStore.getState().saveFigurePose(id, 'Corrida') as string
      corrida = useFiguresStore.getState().figures[0].pose
      useFiguresStore.getState().applyPosePreset(id, 'tpose')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), `saved:${poseSalva}`)
    await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))

    expect(useFiguresStore.getState().figures[0].pose).toEqual(corrida)
  })

  it('remove uma pose da biblioteca, e o botão só existe para poses do usuário', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    let poseSalva = ''
    act(() => {
      poseSalva = useFiguresStore.getState().saveFigurePose(id, 'Corrida') as string
    })

    expect(screen.queryByRole('button', { name: 'Remover da biblioteca' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), `saved:${poseSalva}`)
    await user.click(screen.getByRole('button', { name: 'Remover da biblioteca' }))

    expect(useFiguresStore.getState().poseLibrary).toEqual([])
    expect(screen.queryByRole('button', { name: 'Remover da biblioteca' })).not.toBeInTheDocument()
  })

  /**
   * Renomear existia no store desde sempre, testado, e nunca tinha ganhado
   * botão: dava para salvar e apagar uma pose, mas não para corrigir o nome
   * dela — enquanto animações, trechos e cenas renomeiam.
   */
  it('renomeia a pose escolhida da biblioteca, pelo mesmo campo de nome', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    let poseSalva = ''
    act(() => {
      poseSalva = useFiguresStore.getState().saveFigurePose(id, 'Corrida') as string
    })

    // Só para poses do usuário: as de fábrica não são renomeáveis.
    expect(screen.queryByRole('button', { name: 'Renomear' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), `saved:${poseSalva}`)
    await user.click(screen.getByRole('button', { name: 'Renomear' }))

    // O campo abre JÁ com o nome atual — renomear é corrigir, não redigitar.
    const campo = screen.getByLabelText('Nome da pose')
    expect(campo).toHaveValue('Corrida')

    await user.clear(campo)
    await user.type(campo, 'Corrida rápida')
    await user.click(screen.getByRole('button', { name: 'Salvar pose' }))

    expect(useFiguresStore.getState().poseLibrary.map((pose) => pose.name)).toEqual(['Corrida rápida'])
    // A pose continua escolhida no combo, com o nome novo.
    const combo = screen.getByRole('combobox', { name: 'Poses predefinidas' }) as HTMLSelectElement
    expect(combo.value).toBe(`saved:${poseSalva}`)
    expect(screen.queryByLabelText('Nome da pose')).not.toBeInTheDocument()
  })

  it('cancelar o renomear não mexe no nome guardado', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    let poseSalva = ''
    act(() => {
      poseSalva = useFiguresStore.getState().saveFigurePose(id, 'Corrida') as string
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), `saved:${poseSalva}`)
    await user.click(screen.getByRole('button', { name: 'Renomear' }))
    await user.type(screen.getByLabelText('Nome da pose'), ' e mais')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(useFiguresStore.getState().poseLibrary[0].name).toBe('Corrida')
  })

  it('trava a junta selecionada e desabilita os controles dela', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().selectJoint('elbow.L')
    })

    const travar = screen.getByRole('button', { name: 'Travar junta' })
    expect(travar).toHaveAttribute('aria-pressed', 'false')
    await user.click(travar)

    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['elbow.L'])
    expect(screen.getByRole('button', { name: 'Destravar junta' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Junta travada — nada a altera até você destravá-la\./)).toBeInTheDocument()

    const rotacao = screen.getByRole('group', { name: 'Rotação (°)' })
    expect(within(rotacao).getByRole('slider', { name: 'X' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resetar esta junta' })).toBeDisabled()
  })

  it('mostra quantas juntas estão travadas e destrava todas de uma vez', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().toggleJointLock(id, 'elbow.L')
      useFiguresStore.getState().toggleJointLock(id, 'knee.R')
    })

    expect(await screen.findByText('2 juntas travadas neste boneco.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Destravar todas' }))

    expect(useFiguresStore.getState().jointLocks[id]).toBeUndefined()
    expect(screen.queryByText(/juntas travadas neste boneco/)).not.toBeInTheDocument()
  })

  it('ancora a junta selecionada (item 62): ela continua editável, o ancestral desabilita com o porquê', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().selectJoint('elbow.L')
    })

    const ancorar = screen.getByRole('button', { name: 'Fixar posição' })
    expect(ancorar).toHaveAttribute('aria-pressed', 'false')
    await user.click(ancorar)

    expect(useFiguresStore.getState().jointPins[id]).toEqual(['elbow.L'])
    expect(screen.getByRole('button', { name: 'Soltar âncora' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Junta ancorada — a posição dela está fixa/)).toBeInTheDocument()
    // A rotação da própria junta ancorada segue livre.
    const rotacao = screen.getByRole('group', { name: 'Rotação (°)' })
    expect(within(rotacao).getByRole('slider', { name: 'X' })).toBeEnabled()

    // O ancestral congelado desabilita, explicando de onde veio o congelamento.
    act(() => {
      useFiguresStore.getState().selectJoint('shoulder.L')
    })
    expect(screen.getByText(/Congelada por uma âncora abaixo/)).toBeInTheDocument()
    const rotacaoOmbro = screen.getByRole('group', { name: 'Rotação (°)' })
    expect(within(rotacaoOmbro).getByRole('slider', { name: 'X' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resetar esta junta' })).toBeDisabled()
  })

  it('com âncora, a colocação desabilita na raiz: posição, rotação, assentar e reset', async () => {
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
      useFiguresStore.getState().selectJoint('root')
    })

    expect(await screen.findByText(/Colocação congelada por âncora/)).toBeInTheDocument()
    const posicao = screen.getByRole('group', { name: 'Posição (m)' })
    expect(within(posicao).getByLabelText('X')).toBeDisabled()
    const rotacao = screen.getByRole('group', { name: 'Rotação (°)' })
    expect(within(rotacao).getByRole('slider', { name: 'Y' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apoiar no chão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resetar rotação' })).toBeDisabled()
  })

  it('trava um eixo da rotação da raiz (item 64): o token grava e o slider do eixo desabilita', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().selectJoint('root')
    })

    const rotacao = screen.getByRole('group', { name: 'Rotação (°)' })
    const travarY = within(rotacao).getByRole('button', { name: 'Travar eixo Y' })
    expect(travarY).toHaveAttribute('aria-pressed', 'false')
    await user.click(travarY)

    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['root.y'])
    expect(within(rotacao).getByRole('button', { name: 'Destravar eixo Y' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(rotacao).getByRole('slider', { name: 'Y' })).toBeDisabled()
    expect(within(rotacao).getByRole('slider', { name: 'X' })).toBeEnabled()
  })

  it('com os três eixos travados o reset da rotação desabilita — e os tokens não contam como juntas travadas', async () => {
    const { id } = await comBonecoSelecionado()
    act(() => {
      for (const axis of ['x', 'y', 'z'] as const) {
        useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken(axis))
      }
      useFiguresStore.getState().selectJoint('root')
    })

    expect(screen.getByRole('button', { name: 'Resetar rotação' })).toBeDisabled()
    // A contagem de travas fala de JUNTAS — os eixos da raiz têm os próprios cadeados à vista.
    expect(screen.queryByText(/juntas travadas neste boneco/)).not.toBeInTheDocument()
  })

  it('mostra quantas juntas estão ancoradas e solta todas de uma vez', async () => {
    const user = userEvent.setup()
    const { id } = await comBonecoSelecionado()
    act(() => {
      useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
      useFiguresStore.getState().toggleJointPin(id, 'knee.R')
    })

    expect(await screen.findByText('2 juntas ancoradas neste boneco.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Soltar todas as âncoras' }))

    expect(useFiguresStore.getState().jointPins[id]).toBeUndefined()
    expect(screen.queryByText(/juntas ancoradas neste boneco/)).not.toBeInTheDocument()
  })

})

/**
 * Slider de mistura entre poses (DECISOES.md #43). O contrato de UI: as duas
 * pontas são capturadas UMA vez, então voltar o slider a 0% devolve a pose
 * original; trocar de pose alvo (ou de boneco) recomeça a mistura.
 */
describe('PropertiesPanel — mistura entre poses (DECISOES.md #43)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
  })

  async function comBoneco() {
    const id = useFiguresStore.getState().addFigure('Herói') as string
    useFiguresStore.getState().selectFigure(id)
    await renderPropertiesPanel()
    return id
  }

  const slider = () => screen.getByRole('slider', { name: 'Mistura com a pose escolhida' })
  const poseDe = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!.pose

  it('mistura a pose escolhida em meio caminho, e o valor aparece em porcentagem', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    const partida = poseDe(id)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Correndo')

    fireEvent.change(slider(), { target: { value: '50' } })

    const meio = poseDe(id)['hip.L'].x
    const extremos = [partida['hip.L'].x, resolvePosePreset('running')['hip.L'].x].sort((a, b) => a - b)
    expect(meio).toBeGreaterThan(extremos[0])
    expect(meio).toBeLessThan(extremos[1])
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('voltar a 0% devolve exatamente a pose de partida', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    const partida = poseDe(id)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Fetal')

    fireEvent.change(slider(), { target: { value: '70' } })
    fireEvent.change(slider(), { target: { value: '30' } })
    fireEvent.change(slider(), { target: { value: '0' } })

    expect(poseDe(id)).toEqual(partida)
  })

  it('em 100% dá o mesmo que o botão "Aplicar pose"', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Sentado')

    fireEvent.change(slider(), { target: { value: '100' } })

    expect(poseDe(id)).toEqual(resolvePosePreset('sitting'))
  })

  it('trocar a pose escolhida recomeça a mistura do zero', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Correndo')
    fireEvent.change(slider(), { target: { value: '60' } })
    const meioCorrendo = poseDe(id)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Fetal')

    // A pose do boneco não muda ao trocar o alvo — só o slider volta a 0.
    expect(poseDe(id)).toEqual(meioCorrendo)
    expect(slider()).toHaveValue('0')

    // E a mistura nova parte DAQUI, não da pose original.
    fireEvent.change(slider(), { target: { value: '0' } })
    expect(poseDe(id)).toEqual(meioCorrendo)
  })

  it('funciona também com uma pose da biblioteca como alvo', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    let poseSalva = ''
    act(() => {
      useFiguresStore.getState().applyPosePreset(id, 'running')
      poseSalva = useFiguresStore.getState().saveFigurePose(id, 'Corrida') as string
      useFiguresStore.getState().applyPosePreset(id, 'tpose')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), `saved:${poseSalva}`)
    fireEvent.change(slider(), { target: { value: '100' } })

    expect(poseDe(id)).toEqual(resolvePosePreset('running'))
  })

  it('depois de aplicar a pose, o slider volta a 0 e a mistura parte da pose nova', async () => {
    const user = userEvent.setup()
    const id = await comBoneco()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Poses predefinidas' }), 'Correndo')
    fireEvent.change(slider(), { target: { value: '40' } })

    await user.click(screen.getByRole('button', { name: 'Aplicar pose' }))
    expect(slider()).toHaveValue('0')

    // Misturar de novo com a MESMA pose não pode mexer em nada: as duas
    // pontas são iguais agora.
    fireEvent.change(slider(), { target: { value: '50' } })
    expect(poseDe(id)).toEqual(resolvePosePreset('running'))
  })
})

describe('PropertiesPanel — apoiar no chão e espelho ao vivo (DECISOES.md #58)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
  })

  const bonecoSelecionado = () => {
    const id = useFiguresStore.getState().addFigure('Herói') as string
    useFiguresStore.getState().selectFigure(id)
    return id
  }

  it('o botão de apoiar no chão devolve o boneco flutuando ao solo', async () => {
    const user = userEvent.setup()
    const id = bonecoSelecionado()
    useFiguresStore.getState().setPosition(id, [1, 0.5, 2])
    await renderPropertiesPanel()

    await user.click(screen.getByRole('button', { name: 'Apoiar no chão' }))

    const figura = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(figura.position[1]).toBeCloseTo(0, 9)
    // Só a altura: o lugar no chão é encenação de quem monta a cena.
    expect([figura.position[0], figura.position[2]]).toEqual([1, 2])
  })

  it('a caixa de espelhar edições liga o modo e a dica muda junto', async () => {
    const user = userEvent.setup()
    bonecoSelecionado()
    await renderPropertiesPanel()

    expect(screen.getByText(/Desligado: cada lado é ajustado por conta própria/)).toBeInTheDocument()

    await user.click(screen.getByLabelText('Espelhar edições ao vivo'))

    expect(useFiguresStore.getState().liveMirrorEnabled).toBe(true)
    expect(screen.getByText(/Ligado: ajustar uma junta de um lado/)).toBeInTheDocument()
  })

  it('com o modo ligado, mexer no slider de uma junta escreve o espelho na outra', async () => {
    const user = userEvent.setup()
    const id = bonecoSelecionado()
    useFiguresStore.getState().selectJoint('shoulder.L')
    await renderPropertiesPanel()

    await user.click(screen.getByLabelText('Espelhar edições ao vivo'))
    const grupo = screen.getByRole('group', { name: 'Rotação (°)' })
    fireEvent.change(within(grupo).getByRole('slider', { name: 'Z' }), { target: { value: '35' } })

    const pose = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose
    expect(pose['shoulder.L'].z).toBe(35)
    // Reflexão sagital, não cópia: o mesmo valor numérico faria o movimento
    // anatômico oposto no outro lado (DECISOES.md #14).
    expect(pose['shoulder.R'].z).toBe(-35)
  })
})

describe('PropertiesPanel — zerar por grupo e copiar um membro (DECISOES.md #59)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
  })

  const bonecoSelecionado = (nome = 'Herói') => {
    const id = useFiguresStore.getState().addFigure(nome) as string
    useFiguresStore.getState().selectFigure(id)
    return id
  }

  it('zera o grupo escolhido sem tocar nos outros', async () => {
    const user = userEvent.setup()
    const id = bonecoSelecionado()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -55 })
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 40 })
    await renderPropertiesPanel()

    const grupo = screen.getByRole('group', { name: 'Zerar por grupo' })
    await user.click(within(grupo).getByRole('button', { name: 'Braço direito' }))

    const pose = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose
    expect(pose['shoulder.R']).toEqual(resolvePosePreset('standing')['shoulder.R'])
    expect(pose['knee.L'].x).toBe(40)
  })

  it('grupo inteiro travado aparece desabilitado, em vez de virar botão inerte', async () => {
    const id = bonecoSelecionado()
    for (const jointName of ['neck', 'head']) useFiguresStore.getState().toggleJointLock(id, jointName)
    await renderPropertiesPanel()

    const grupo = screen.getByRole('group', { name: 'Zerar por grupo' })
    expect(within(grupo).getByRole('button', { name: 'Cabeça' })).toBeDisabled()
    expect(within(grupo).getByRole('button', { name: 'Tronco' })).toBeEnabled()
  })

  it('copiar com escopo de grupo leva só o membro e não mexe no lugar do destino', async () => {
    const user = userEvent.setup()
    const origem = bonecoSelecionado('Origem')
    const destino = useFiguresStore.getState().addFigure('Destino') as string
    useFiguresStore.getState().setPosition(destino, [2, 0, 0])
    useFiguresStore.getState().setJointRotation(origem, 'shoulder.L', { x: -70 })
    useFiguresStore.getState().setJointRotation(origem, 'knee.L', { x: 50 })
    useFiguresStore.getState().selectFigure(origem)
    await renderPropertiesPanel()

    await user.selectOptions(screen.getByLabelText('O que copiar'), 'armLeft')
    await user.click(screen.getByRole('button', { name: /^Copiar$/ }))

    const alvo = useFiguresStore.getState().figures.find((f) => f.id === destino)!
    expect(alvo.pose['shoulder.L'].x).toBe(-70)
    // Só o braço: a perna e o lugar no chão ficam como estavam.
    expect(alvo.pose['knee.L'].x).toBe(0)
    expect(alvo.position).toEqual([2, 0, 0])
  })
})

/**
 * Pose em arquivo JSON (DECISOES.md #81) — a ponte com o celular. Aqui só a
 * fiação do painel; o contrato do formato é testado em
 * `persistence/__tests__/figurePoseFile.test.ts`.
 */
describe('PropertiesPanel — pose em arquivo (.json)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    abrirSecoes()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  })

  const selecionarBoneco = (nome = 'Original') => {
    const id = useFiguresStore.getState().addFigure(nome) as string
    useFiguresStore.getState().selectFigure(id)
    return id
  }

  it('não aparece sem boneco selecionado', async () => {
    await renderPropertiesPanel()
    expect(screen.queryByRole('group', { name: 'Pose em arquivo (.json)' })).not.toBeInTheDocument()
  })

  it('aparece na visão da raiz e some com uma junta selecionada — é operação do boneco INTEIRO', async () => {
    const id = selecionarBoneco()
    const { rerender } = await renderPropertiesPanel()

    expect(screen.getByRole('group', { name: 'Pose em arquivo (.json)' })).toBeInTheDocument()

    act(() => {
      useFiguresStore.getState().selectJoint('elbow.L')
    })
    rerender(<PropertiesPanel />)

    expect(screen.queryByRole('group', { name: 'Pose em arquivo (.json)' })).not.toBeInTheDocument()
    expect(id).toBeTruthy()
  })

  it('exporta a pose num .json com o boneco no (0,0) do plano', async () => {
    const id = selecionarBoneco('Herói')
    useFiguresStore.getState().setPosition(id, [3, 0.5, -2])

    const user = userEvent.setup()
    await renderPropertiesPanel()
    await user.click(screen.getByRole('button', { name: 'Exportar pose' }))

    await vi.waitFor(() => {
      expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    })
    const [directoryHandle, filename, blob] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/-pose\.json$/)

    const gravado = JSON.parse(await (blob as Blob).text())
    expect(gravado.figures[0].position).toEqual([0, 0.5, 0])
    expect(gravado.figures[0].pose['elbow.L']).toBeDefined()
    // A cena em si não muda ao exportar.
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.position).toEqual([3, 0.5, -2])
  })

  it('carrega uma pose mantendo X/Z do boneco e trazendo só o Y do arquivo', async () => {
    const id = selecionarBoneco()
    useFiguresStore.getState().setPosition(id, [4, 0, 4])

    const arquivo = {
      version: 1,
      figure: {
        id: 'figure-do-celular',
        name: 'Vindo do celular',
        color: '#4060e0',
        visible: true,
        height: 1.55,
        position: [0, 0.3, 0],
        rotation: { x: 0, y: 45, z: 0 },
        pose: { 'knee.L': { x: 90, y: 0, z: 0 } },
      },
    }
    vi.mocked(pickFile).mockResolvedValue({
      file: new File([], 'pose.json'),
      data: new TextEncoder().encode(JSON.stringify(arquivo)).buffer as ArrayBuffer,
    })

    const user = userEvent.setup()
    await renderPropertiesPanel()
    await user.click(screen.getByRole('button', { name: 'Carregar pose' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.pose['knee.L']).toEqual({
        x: 90,
        y: 0,
        z: 0,
      })
    })
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.position).toEqual([4, 0.3, 4])
    expect(figure?.height).toBe(1.55)
    expect(figure?.rotation).toEqual({ x: 0, y: 45, z: 0 })
    // Nome e cor são do boneco de destino, não do arquivo.
    expect(figure?.name).toBe('Original')
  })

  it('avisa quando o arquivo não é JSON válido, sem mexer na pose', async () => {
    const id = selecionarBoneco()
    const poseAntes = useFiguresStore.getState().figures.find((f) => f.id === id)?.pose

    vi.mocked(pickFile).mockResolvedValue({
      file: new File([], 'ruim.json'),
      data: new TextEncoder().encode('{ isto não é json').buffer as ArrayBuffer,
    })

    const user = userEvent.setup()
    await renderPropertiesPanel()
    await user.click(screen.getByRole('button', { name: 'Carregar pose' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('não é um JSON válido')
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.pose).toEqual(poseAntes)
  })

  it('avisa quando o JSON é válido mas não tem pose aproveitável', async () => {
    selecionarBoneco()

    vi.mocked(pickFile).mockResolvedValue({
      file: new File([], 'outro.json'),
      data: new TextEncoder().encode('{"algo":"que não é pose"}').buffer as ArrayBuffer,
    })

    const user = userEvent.setup()
    await renderPropertiesPanel()
    await user.click(screen.getByRole('button', { name: 'Carregar pose' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('não tem nenhuma pose aproveitável')
  })
})

/**
 * Reorganização do painel (pedido do usuário, 2026-07-31): a colocação sobe
 * para junto do gizmo que a arrasta, as poses ficam separadas de guardar/copiar
 * e as duas vistas terminam na mesma ordem.
 */
describe('PropertiesPanel — ordem e seções', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  async function comBoneco() {
    const id = useFiguresStore.getState().addFigure('Herói') as string
    useFiguresStore.getState().selectFigure(id)
    await renderPropertiesPanel()
    return id
  }

  /** Ordem de leitura dos blocos, pela posição no DOM. */
  function ordemDe(nomes: readonly string[]): string[] {
    const encontrados = nomes
      .map((nome) => {
        const el =
          screen.queryByRole('group', { name: nome }) ??
          screen.queryByRole('button', { name: nome }) ??
          screen.queryByRole('slider', { name: nome })
        return el ? { nome, el } : null
      })
      .filter((entry): entry is { nome: string; el: HTMLElement } => entry !== null)
    return encontrados
      .sort((a, b) =>
        a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map((entry) => entry.nome)
  }

  it('na raiz, a colocação vem antes das poses — e o gizmo junto dela', async () => {
    await comBoneco()

    expect(ordemDe(['Gizmo', 'Posição (m)', 'Rotação (°)', 'Poses predefinidas'])).toEqual([
      'Gizmo',
      'Posição (m)',
      'Rotação (°)',
      'Poses predefinidas',
    ])
  })

  it('as seções ocasionais nascem recolhidas; a de poses, aberta', async () => {
    await comBoneco()

    expect(screen.getByRole('button', { name: 'Poses predefinidas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    for (const titulo of ['Guardar e copiar', 'Simetria']) {
      expect(screen.getByRole('button', { name: titulo })).toHaveAttribute('aria-expanded', 'false')
    }
    // Recolhida, "Guardar e copiar" não deixa nada no DOM.
    expect(screen.queryByRole('button', { name: 'Salvar pose atual' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Pose em arquivo (.json)' })).not.toBeInTheDocument()
  })

  it('as duas vistas terminam na mesma ordem: simetria e depois zerar por grupo', async () => {
    const id = await comBoneco()
    expect(ordemDe(['Simetria', 'Zerar por grupo'])).toEqual(['Simetria', 'Zerar por grupo'])

    act(() => {
      useFiguresStore.getState().selectJoint('elbow.L')
    })

    // Antes, a dupla aparecia invertida na junta — trocar de junta reordenava
    // o painel sem que nada tivesse mudado de assunto.
    expect(ordemDe(['Simetria', 'Zerar por grupo'])).toEqual(['Simetria', 'Zerar por grupo'])
    expect(id).toBeTruthy()
  })

  /**
   * Escolher a ferramenta do gizmo é o que se faz ANTES de mexer nos números —
   * a mesma ordem que a raiz já tinha (pedido do usuário, 2026-07-31).
   */
  it('na junta, o gizmo vem antes da rotação, como na raiz', async () => {
    await comBoneco()
    act(() => {
      useFiguresStore.getState().selectJoint('wrist.L')
    })

    expect(ordemDe(['Gizmo', 'Rotação (°)', 'Poses da mão esquerda'])).toEqual([
      'Gizmo',
      'Rotação (°)',
      'Poses da mão esquerda',
    ])
  })

  /**
   * A fila de cima é a da pose ESCOLHIDA no combo (aplicar, renomear, remover);
   * o sorteio não tem nada a ver com ela e desce para depois da mistura
   * (pedido do usuário, 2026-07-31).
   */
  it('na raiz, "Aleatória" fica depois da mistura', async () => {
    await comBoneco()

    expect(ordemDe(['Aplicar pose', 'Mistura com a pose escolhida', 'Aleatória'])).toEqual([
      'Aplicar pose',
      'Mistura com a pose escolhida',
      'Aleatória',
    ])
  })

  /** "Guardar e copiar" fecha o painel: é o fim de uma sessão, não o meio. */
  it('na raiz, guardar e copiar é o último bloco', async () => {
    await comBoneco()

    expect(ordemDe(['Poses predefinidas', 'Simetria', 'Zerar por grupo', 'Guardar e copiar'])).toEqual([
      'Poses predefinidas',
      'Simetria',
      'Zerar por grupo',
      'Guardar e copiar',
    ])
  })
})
