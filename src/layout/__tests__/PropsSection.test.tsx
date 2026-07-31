import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'
import { MAX_PROPS } from '../../props/sceneProp'
import { PropsSection, PropProperties } from '../PropsSection'

async function renderSection() {
  const utils = render(<PropsSection />)
  await act(async () => {})
  return utils
}

describe('PropsSection', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState({ propGizmoMode: 'translate' })
  })

  it('mostra o vazio antes de haver objeto', async () => {
    await renderSection()
    expect(screen.getByText('Nenhum objeto na cena ainda.')).toBeInTheDocument()
  })

  it('acrescenta o objeto da forma escolhida no combo', async () => {
    const user = userEvent.setup()
    await renderSection()

    await user.selectOptions(screen.getByLabelText('Forma'), 'ramp')
    await user.click(screen.getByRole('button', { name: 'Adicionar objeto' }))

    const props = useFiguresStore.getState().props
    expect(props).toHaveLength(1)
    expect(props[0].shape).toBe('ramp')
  })

  it('desabilita o botão no limite de objetos', async () => {
    act(() => {
      for (let index = 0; index < MAX_PROPS; index += 1) useFiguresStore.getState().addProp('box')
    })
    await renderSection()

    expect(screen.getByRole('button', { name: 'Adicionar objeto' })).toBeDisabled()
  })

  it('a cor do objeto é editável pelo seletor', async () => {
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    await renderSection()

    const swatch = screen.getByLabelText('Trocar cor do objeto') as HTMLInputElement
    fireEvent.change(swatch, { target: { value: '#00ff88' } })

    expect(useFiguresStore.getState().props[0].color).toBe('#00ff88')
  })

  it('as três chaves são botões distintos e independentes', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    await renderSection()

    await user.click(screen.getByRole('button', { name: 'Ocultar objeto na bancada' }))
    expect(useFiguresStore.getState().props[0].hiddenInEditor).toBe(true)
    // Escondido da bancada continua ligado — é o que o faz sair no PNG.
    expect(useFiguresStore.getState().props[0].visible).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Travar objeto' }))
    expect(useFiguresStore.getState().props[0].locked).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Mostrar/ocultar objeto' }))
    expect(useFiguresStore.getState().props[0].visible).toBe(false)
  })

  it('a chave geral esconde todos os objetos da bancada de uma vez', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addProp('box')
      useFiguresStore.getState().addProp('cone')
    })
    await renderSection()

    await user.click(screen.getByLabelText('Ocultar todos os objetos na bancada'))
    expect(useFiguresStore.getState().props.every((prop) => prop.hiddenInEditor)).toBe(true)
  })

  it('remover tira o objeto da lista', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    await renderSection()

    await user.click(screen.getByRole('button', { name: 'Remover objeto' }))
    expect(useFiguresStore.getState().props).toHaveLength(0)
  })
})

describe('PropProperties', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState({ propGizmoMode: 'translate' })
  })

  function renderProperties() {
    const prop = useFiguresStore.getState().props[0]
    return render(<PropProperties prop={prop} />)
  }

  it('mostra o tamanho EM METROS e grava metro ao editar', async () => {
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    const { rerender } = renderProperties()

    const [sizeX] = screen.getAllByLabelText('X')
    fireEvent.change(sizeX, { target: { value: '1.25' } })

    expect(useFiguresStore.getState().props[0].size[0]).toBe(1.25)
    rerender(<PropProperties prop={useFiguresStore.getState().props[0]} />)
    expect((screen.getAllByLabelText('X')[0] as HTMLInputElement).value).toBe('1.25')
  })

  it('troca a ferramenta do objeto, inclusive para vértices', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    renderProperties()

    await user.click(screen.getByRole('button', { name: 'Vértices' }))
    expect(useUIStore.getState().propGizmoMode).toBe('vertex')
  })

  it('conta os vértices movidos e só então libera o botão de desfazer', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addProp('box')
    })
    const { rerender } = renderProperties()

    expect(screen.getByText('0 de 8 vértices movidos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desfazer deformação' })).toBeDisabled()

    act(() => {
      useFiguresStore.getState().setPropVertex(useFiguresStore.getState().props[0].id, 0, [4, 4, 4])
    })
    rerender(<PropProperties prop={useFiguresStore.getState().props[0]} />)

    expect(screen.getByText('1 de 8 vértices movidos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desfazer deformação' }))
    expect(useFiguresStore.getState().props[0].vertexOffsets).toEqual({})
  })

  it('avisa que trocar a forma descarta os vértices — antes, não depois', () => {
    act(() => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropVertex(id, 0, [4, 4, 4])
    })
    renderProperties()

    expect(screen.getByText('Trocar a forma descarta os vértices movidos.')).toBeInTheDocument()
  })

  it('objeto travado deixa os controles inertes e diz por quê', () => {
    act(() => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().togglePropLocked(id)
    })
    renderProperties()

    expect(screen.getByText('Objeto travado: destrave na lista de objetos para editá-lo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apoiar no chão' })).toBeDisabled()
    expect(screen.getAllByLabelText('X')[0]).toBeDisabled()
  })

  it('apoia o objeto no chão pelo botão', async () => {
    const user = userEvent.setup()
    act(() => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropPosition(id, [0, 5, 0])
    })
    renderProperties()

    await user.click(screen.getByRole('button', { name: 'Apoiar no chão' }))
    expect(useFiguresStore.getState().props[0].position[1]).toBeCloseTo(0.25, 6)
  })
})
