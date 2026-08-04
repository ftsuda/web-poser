import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'
import { useCameraStore } from '../cameraStore'
import { selectTarget } from '../selection'
import { controlPointCount, controlPointPosition, controlPointsOf } from '../../props/propGeometry'
import { attachedPropPlacement } from '../../props/propAttachment'
import { DEFAULT_PROP_COLOR, DEFAULT_PROP_SIZE, MAX_PROPS } from '../../props/sceneProp'

/** O objeto que acabou de ser criado — as ações devolvem o id, não o objeto. */
function propById(id: string | null) {
  return useFiguresStore.getState().props.find((prop) => prop.id === id)
}

describe('objetos de cena no figuresStore', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useCameraStore.setState({ cameraSelected: false })
    useFiguresStore.temporal.getState().clear()
  })

  describe('criar e remover', () => {
    it('nasce apoiado no chão, com a cor neutra e o tamanho padrão da forma', () => {
      const id = useFiguresStore.getState().addProp('box')
      const prop = propById(id)

      expect(prop?.shape).toBe('box')
      expect(prop?.color).toBe(DEFAULT_PROP_COLOR)
      expect(prop?.size).toEqual([...DEFAULT_PROP_SIZE.box])
      // Pivô no centro: metade da altura acima do chão é "apoiado".
      expect(prop?.position[1]).toBeCloseTo(DEFAULT_PROP_SIZE.box[1] / 2, 6)
      expect(prop?.visible).toBe(true)
      expect(prop?.hiddenInEditor).toBe(false)
      expect(prop?.locked).toBe(false)
      expect(prop?.vertexOffsets).toEqual({})
    })

    it('objetos novos não nascem um dentro do outro', () => {
      const first = propById(useFiguresStore.getState().addProp('box'))
      const second = propById(useFiguresStore.getState().addProp('box'))
      expect(second?.position[0]).toBeGreaterThan(first?.position[0] ?? 0)
    })

    it(`para em ${MAX_PROPS} objetos, devolvendo null`, () => {
      for (let index = 0; index < MAX_PROPS; index += 1) {
        expect(useFiguresStore.getState().addProp('box')).not.toBeNull()
      }
      expect(useFiguresStore.getState().addProp('box')).toBeNull()
      expect(useFiguresStore.getState().props).toHaveLength(MAX_PROPS)
    })

    it('remover limpa a seleção quando era o selecionado', () => {
      const id = useFiguresStore.getState().addProp('cone')!
      expect(useFiguresStore.getState().selectedPropId).toBe(id)

      useFiguresStore.getState().removeProp(id)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()
    })

    it('duplicar leva os vértices arrastados junto', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropVertex(id, 0, [3, 3, 3])

      const copy = propById(useFiguresStore.getState().duplicateProp(id))
      expect(copy?.vertexOffsets).toEqual(propById(id)?.vertexOffsets)
      expect(copy?.position[0]).toBeGreaterThan(propById(id)!.position[0])
    })
  })

  describe('as três chaves são coisas diferentes', () => {
    it('visível, oculto na bancada e travado são independentes', () => {
      const id = useFiguresStore.getState().addProp('box')!

      useFiguresStore.getState().togglePropHiddenInEditor(id)
      expect(propById(id)?.hiddenInEditor).toBe(true)
      // Esconder da bancada NÃO desliga o objeto: ele continua saindo na
      // captura, e é a promessa da opção.
      expect(propById(id)?.visible).toBe(true)

      useFiguresStore.getState().togglePropVisible(id)
      expect(propById(id)?.visible).toBe(false)
      expect(propById(id)?.hiddenInEditor).toBe(true)
    })

    it('travar o objeto selecionado limpa a seleção', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().togglePropLocked(id)

      expect(propById(id)?.locked).toBe(true)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()
    })

    it('objeto travado não pode ser selecionado', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().togglePropLocked(id)

      useFiguresStore.getState().selectProp(id)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()
    })

    it('objeto travado não aceita edição nenhuma', () => {
      const id = useFiguresStore.getState().addProp('box')!
      const before = propById(id)!
      useFiguresStore.getState().togglePropLocked(id)

      const store = useFiguresStore.getState()
      store.setPropPosition(id, [9, 9, 9])
      store.setPropRotation(id, { y: 45 })
      store.setPropSize(id, [3, 3, 3])
      store.setPropShape(id, 'sphere')
      store.setPropVertex(id, 0, [5, 5, 5])
      store.seatPropOnGround(id)

      const after = propById(id)!
      expect(after.position).toEqual(before.position)
      expect(after.rotation).toEqual(before.rotation)
      expect(after.size).toEqual(before.size)
      expect(after.shape).toBe(before.shape)
      expect(after.vertexOffsets).toEqual({})
    })

    it('a chave geral vale para todos de uma vez, e não empilha undo à toa', () => {
      useFiguresStore.getState().addProp('box')
      useFiguresStore.getState().addProp('cone')

      useFiguresStore.getState().setAllPropsHiddenInEditor(true)
      expect(useFiguresStore.getState().props.every((prop) => prop.hiddenInEditor)).toBe(true)

      const before = useFiguresStore.getState().props
      useFiguresStore.getState().setAllPropsHiddenInEditor(true)
      expect(useFiguresStore.getState().props).toBe(before)
    })
  })

  describe('tamanho e medidas', () => {
    it('o tamanho é grampeado à faixa em metros', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropSize(id, [0, 1000, 2])
      expect(propById(id)?.size).toEqual([0.01, 20, 2])
    })

    it('apoiar no chão leva em conta a rotação', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropSize(id, [1, 1, 1])
      useFiguresStore.getState().setPropRotation(id, { z: 45 })
      useFiguresStore.getState().seatPropOnGround(id)

      expect(propById(id)?.position[1]).toBeCloseTo(Math.SQRT2 / 2, 5)
    })

    it('apoiar no chão não mexe em onde o objeto está', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropPosition(id, [2, 5, -3])
      useFiguresStore.getState().seatPropOnGround(id)

      const prop = propById(id)!
      expect(prop.position[0]).toBe(2)
      expect(prop.position[2]).toBe(-3)
    })
  })

  describe('vértice livre', () => {
    it('guarda o DESVIO, não a posição absoluta', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropSize(id, [1, 1, 1])

      const base = controlPointPosition('box', [1, 1, 1], {}, 0)
      useFiguresStore.getState().setPropVertex(id, 0, [base[0] + 0.3, base[1], base[2]])

      expect(propById(id)?.vertexOffsets[0][0]).toBeCloseTo(0.3, 6)
    })

    it('redimensionar depois move a primitiva por baixo e preserva o desvio', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropSize(id, [1, 1, 1])
      const base = controlPointPosition('box', [1, 1, 1], {}, 0)
      useFiguresStore.getState().setPropVertex(id, 0, [base[0] + 0.3, base[1], base[2]])

      useFiguresStore.getState().setPropSize(id, [2, 1, 1])
      expect(propById(id)?.vertexOffsets[0][0]).toBeCloseTo(0.3, 6)
    })

    it('voltar o vértice ao lugar devolve o objeto ao estado intacto', () => {
      const id = useFiguresStore.getState().addProp('box')!
      const base = controlPointPosition('box', propById(id)!.size, {}, 2)

      useFiguresStore.getState().setPropVertex(id, 2, [base[0] + 1, base[1], base[2]])
      expect(Object.keys(propById(id)!.vertexOffsets)).toHaveLength(1)

      useFiguresStore.getState().setPropVertex(id, 2, base)
      expect(propById(id)?.vertexOffsets).toEqual({})
    })

    it('índice fora da forma é ignorado', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropVertex(id, controlPointCount('box'), [1, 1, 1])
      useFiguresStore.getState().setPropVertex(id, -1, [1, 1, 1])
      expect(propById(id)?.vertexOffsets).toEqual({})
    })

    it('trocar a forma descarta os vértices — os índices são de outra malha', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropVertex(id, 0, [4, 4, 4])
      expect(Object.keys(propById(id)!.vertexOffsets)).toHaveLength(1)

      useFiguresStore.getState().setPropShape(id, 'sphere')
      expect(propById(id)?.shape).toBe('sphere')
      expect(propById(id)?.vertexOffsets).toEqual({})
    })

    it('trocar a forma PRESERVA o tamanho — metro é metro em qualquer forma', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropSize(id, [1.5, 0.3, 2])
      useFiguresStore.getState().setPropShape(id, 'cylinder')
      expect(propById(id)?.size).toEqual([1.5, 0.3, 2])
    })

    it('desfazer a deformação zera todos os vértices de uma vez', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropVertex(id, 0, [4, 4, 4])
      useFiguresStore.getState().setPropVertex(id, 1, [5, 5, 5])

      useFiguresStore.getState().clearPropVertices(id)
      expect(propById(id)?.vertexOffsets).toEqual({})
      expect(controlPointsOf('box')).toHaveLength(8)
    })
  })

  describe('seleção exclusiva', () => {
    it('escolher um objeto desmarca o boneco', () => {
      const figureId = useFiguresStore.getState().addFigure()!
      // Acrescentar um OBJETO já o seleciona (ele nasce precisando de lugar e
      // tamanho); acrescentar um boneco não — este teste é sobre a troca.
      useFiguresStore.getState().selectFigure(figureId)
      expect(useFiguresStore.getState().selectedFigureId).toBe(figureId)

      const propId = useFiguresStore.getState().addProp('box')!
      expect(useFiguresStore.getState().selectedPropId).toBe(propId)
      expect(useFiguresStore.getState().selectedFigureId).toBeNull()
      expect(useFiguresStore.getState().selectedJointName).toBeNull()
    })

    it('escolher um boneco desmarca o objeto', () => {
      const propId = useFiguresStore.getState().addProp('box')!
      const figureId = useFiguresStore.getState().addFigure()!

      useFiguresStore.getState().selectFigure(figureId)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()
      expect(propById(propId)).toBeDefined()
    })

    it('selectTarget é o ponto único: cada escolha apaga as outras duas', () => {
      const figureId = useFiguresStore.getState().addFigure()!
      const propId = useFiguresStore.getState().addProp('box')!

      selectTarget({ kind: 'camera', id: null })
      expect(useCameraStore.getState().cameraSelected).toBe(true)
      expect(useFiguresStore.getState().selectedFigureId).toBeNull()
      expect(useFiguresStore.getState().selectedPropId).toBeNull()

      selectTarget({ kind: 'prop', id: propId })
      expect(useCameraStore.getState().cameraSelected).toBe(false)
      expect(useFiguresStore.getState().selectedPropId).toBe(propId)

      selectTarget({ kind: 'figure', id: figureId })
      expect(useFiguresStore.getState().selectedFigureId).toBe(figureId)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()

      selectTarget(null)
      expect(useFiguresStore.getState().selectedFigureId).toBeNull()
      expect(useCameraStore.getState().cameraSelected).toBe(false)
    })
  })

  describe('formas compostas (kit de armas)', () => {
    it('a espada nasce apoiada no chão, de pé, no tamanho padrão', () => {
      const prop = propById(useFiguresStore.getState().addProp('sword'))
      expect(prop?.shape).toBe('sword')
      expect(prop?.size).toEqual([0.15, 1.1, 0.03])
      expect(prop?.position[1]).toBeCloseTo(0.55, 4)
    })

    it('composta não aceita vértice livre — nem pelo store', () => {
      const id = useFiguresStore.getState().addProp('sword')!
      useFiguresStore.getState().setPropVertex(id, 0, [3, 3, 3])
      expect(propById(id)?.vertexOffsets).toEqual({})
    })
  })

  describe('amarração a junta (PLANO.md > amarração, metade 1)', () => {
    /** Boneco + objeto prontos para amarrar; devolve os dois ids. */
    function setup() {
      const figureId = useFiguresStore.getState().addFigure()!
      const propId = useFiguresStore.getState().addProp('box')!
      return { figureId, propId }
    }

    function figureById(id: string) {
      return useFiguresStore.getState().figures.find((figure) => figure.id === id)!
    }

    it('amarrar guarda {figureId, jointName} e NÃO muda a colocação própria do objeto', () => {
      const { figureId, propId } = setup()
      const before = propById(propId)!

      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')

      const after = propById(propId)!
      expect(after.attachment?.figureId).toBe(figureId)
      expect(after.attachment?.jointName).toBe('wrist.R')
      expect(after.position).toEqual(before.position)
      expect(after.rotation).toEqual(before.rotation)
    })

    it('amarrar preserva a colocação de MUNDO: o objeto não pula ao ganhar a amarração', () => {
      const { figureId, propId } = setup()
      const before = propById(propId)!

      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')

      const placement = attachedPropPlacement(figureById(figureId), propById(propId)!.attachment!)!
      expect(placement.position[0]).toBeCloseTo(before.position[0], 5)
      expect(placement.position[1]).toBeCloseTo(before.position[1], 5)
      expect(placement.position[2]).toBeCloseTo(before.position[2], 5)
    })

    it('junta desconhecida ou boneco inexistente não amarram', () => {
      const { propId } = setup()
      useFiguresStore.getState().attachProp(propId, 'figure-99', 'wrist.R')
      expect(propById(propId)?.attachment).toBeNull()

      const { figureId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'rabo')
      expect(propById(propId)?.attachment).toBeNull()
    })

    it('objeto travado não amarra', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().togglePropLocked(propId)
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      expect(propById(propId)?.attachment).toBeNull()
    })

    it('soltar GRAVA a colocação de mundo no objeto: ele fica onde estava, agora como cenário', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      const placement = attachedPropPlacement(figureById(figureId), propById(propId)!.attachment!)!

      useFiguresStore.getState().detachProp(propId)

      const after = propById(propId)!
      expect(after.attachment).toBeNull()
      expect(after.position[0]).toBeCloseTo(placement.position[0], 5)
      expect(after.position[1]).toBeCloseTo(placement.position[1], 5)
      expect(after.position[2]).toBeCloseTo(placement.position[2], 5)
    })

    it('remover o boneco devolve o objeto à PRÓPRIA colocação (decisão do usuário)', () => {
      const { figureId, propId } = setup()
      const own = propById(propId)!.position
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')

      useFiguresStore.getState().removeFigure(figureId)

      const after = propById(propId)!
      expect(after.attachment).toBeNull()
      expect(after.position).toEqual(own)
    })

    it('mover objeto amarrado (gizmo/painel) escreve o OFFSET: a colocação derivada segue o pedido', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      const ownBefore = propById(propId)!.position

      useFiguresStore.getState().setPropPosition(propId, [0.3, 1.4, -0.2])

      const after = propById(propId)!
      // A colocação própria não muda — o arrasto virou offset relativo à junta.
      expect(after.position).toEqual(ownBefore)
      const placement = attachedPropPlacement(figureById(figureId), after.attachment!)!
      expect(placement.position[0]).toBeCloseTo(0.3, 5)
      expect(placement.position[1]).toBeCloseTo(1.4, 5)
      expect(placement.position[2]).toBeCloseTo(-0.2, 5)
    })

    it('girar objeto amarrado escreve o offset de rotação, sem tocar a rotação própria', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      const before = propById(propId)!

      useFiguresStore.getState().setPropRotation(propId, { y: 45 })

      const after = propById(propId)!
      expect(after.rotation).toEqual(before.rotation)
      expect(after.attachment!.rotation).not.toEqual(before.attachment!.rotation)
    })

    it('o offset também se edita direto (campos do painel)', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.L')

      useFiguresStore.getState().setPropAttachmentOffset(propId, {
        position: [0, -0.05, 0],
        rotation: { z: 90 },
      })

      const attachment = propById(propId)!.attachment!
      expect(attachment.position).toEqual([0, -0.05, 0])
      expect(attachment.rotation.z).toBe(90)
    })

    it('apoiar no chão não faz nada com objeto amarrado — quem manda é a junta', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      const before = propById(propId)!

      useFiguresStore.getState().seatPropOnGround(propId)
      expect(propById(propId)).toBe(before)
    })

    it('a cópia de um objeto amarrado nasce SOLTA, ao lado da colocação própria', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')

      const copy = propById(useFiguresStore.getState().duplicateProp(propId))
      expect(copy?.attachment).toBeNull()
    })

    it('amarrar e soltar entram no undo', () => {
      const { figureId, propId } = setup()
      useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
      expect(propById(propId)?.attachment).not.toBeNull()

      useFiguresStore.temporal.getState().undo()
      expect(propById(propId)?.attachment).toBeNull()
    })
  })

  describe('histórico e cenas', () => {
    it('criar e mover um objeto entram no undo', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropPosition(id, [5, 0, 0])
      expect(propById(id)?.position[0]).toBe(5)

      useFiguresStore.temporal.getState().undo()
      expect(propById(id)?.position[0]).not.toBe(5)

      useFiguresStore.temporal.getState().undo()
      expect(useFiguresStore.getState().props).toHaveLength(0)
    })

    it('um snapshot de cena guarda e devolve os objetos', () => {
      const id = useFiguresStore.getState().addProp('cylinder')!
      useFiguresStore.getState().setPropColor(id, '#123456')
      const sceneId = useFiguresStore.getState().saveSceneSnapshot('Com objeto')

      useFiguresStore.getState().removeProp(id)
      expect(useFiguresStore.getState().props).toHaveLength(0)

      useFiguresStore.getState().loadSceneSnapshot(sceneId)
      expect(useFiguresStore.getState().props).toHaveLength(1)
      expect(propById(id)?.color).toBe('#123456')
    })

    it('limpar o workspace leva os objetos junto', () => {
      useFiguresStore.getState().addProp('box')
      useFiguresStore.getState().resetWorkspace()

      expect(useFiguresStore.getState().props).toEqual([])
      expect(useFiguresStore.getState().nextPropSeq).toBe(1)
      expect(useFiguresStore.getState().selectedPropId).toBeNull()
    })

    it('a cor do objeto é livre, e o que não é cor não passa', () => {
      const id = useFiguresStore.getState().addProp('box')!
      useFiguresStore.getState().setPropColor(id, '#ABC')
      expect(propById(id)?.color).toBe('#aabbcc')

      useFiguresStore.getState().setPropColor(id, 'javascript:alert(1)')
      expect(propById(id)?.color).toBe('#aabbcc')
    })
  })
})
