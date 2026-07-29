import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { useFiguresStore } from '../../store/figuresStore'
import { useIKStore } from '../../store/ikStore'
import { buildJointFrames } from '../jointFrames'
import { applyIKSwivel, applyIKTarget, readIKSwivel, toggleLimbIK } from '../ikActions'

describe('ikActions', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useIKStore.setState(useIKStore.getInitialState())
  })

  describe('toggleLimbIK', () => {
    it('enables IK for a limb, seeding the target at the current wrist world position', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const expected = new THREE.Vector3()
      joints.get('wrist.L')!.getWorldPosition(expected)

      toggleLimbIK(id, 'wrist.L')

      expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(true)
      const target = useIKStore.getState().getTarget(id, 'wrist.L')!
      expect(target[0]).toBeCloseTo(expected.x)
      expect(target[1]).toBeCloseTo(expected.y)
      expect(target[2]).toBeCloseTo(expected.z)
    })

    it('disables IK when called again for an already-enabled limb', () => {
      const id = useFiguresStore.getState().addFigure() as string
      toggleLimbIK(id, 'wrist.L')
      toggleLimbIK(id, 'wrist.L')
      expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(false)
    })

    it('does nothing for an unknown figure id', () => {
      expect(() => toggleLimbIK('figure-inexistente', 'wrist.L')).not.toThrow()
      expect(useIKStore.getState().isLimbEnabled('figure-inexistente', 'wrist.L')).toBe(false)
    })
  })

  describe('applyIKTarget', () => {
    it('solves the chain and writes the resulting joint rotations into figuresStore, tracked by undo', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      const target: [number, number, number] = [shoulderPos.x + 0.3, shoulderPos.y - 0.4, shoulderPos.z + 0.2]

      applyIKTarget(id, 'wrist.L', target)

      const updated = useFiguresStore.getState().figures.find((f) => f.id === id)!
      expect(updated.pose['shoulder.L']).toBeDefined()
      expect(updated.pose['elbow.L']).toBeDefined()
      expect(useFiguresStore.temporal.getState().pastStates.length).toBeGreaterThan(0)
    })

    it('updates the ikStore target and reached flag', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      const farTarget: [number, number, number] = [shoulderPos.x + 100, shoulderPos.y, shoulderPos.z]

      applyIKTarget(id, 'wrist.L', farTarget)

      expect(useIKStore.getState().getTarget(id, 'wrist.L')).toEqual(farTarget)
      expect(useIKStore.getState().getReached(id, 'wrist.L')).toBe(false)
    })

    it('does nothing for an unknown limb key', () => {
      const id = useFiguresStore.getState().addFigure() as string
      expect(() => applyIKTarget(id, 'not-a-limb', [0, 0, 0])).not.toThrow()
    })

    /**
     * Junta travada (DECISOES.md #42): o membro inteiro para. O solver é
     * analítico de dois ossos e não sabe resolver com um deles preso — aplicar
     * só a metade destravada levaria o punho para um lugar que ninguém pediu.
     */
    it('não mexe no membro quando uma junta da cadeia está travada', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      const target: [number, number, number] = [shoulderPos.x + 0.3, shoulderPos.y - 0.4, shoulderPos.z + 0.2]
      useFiguresStore.getState().toggleJointLock(id, 'shoulder.L')
      const antes = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose

      applyIKTarget(id, 'wrist.L', target)

      expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toBe(antes)
      // O alvo continua sendo registrado, e marcado como NÃO alcançado — o
      // gizmo mostra que o arrasto não teve efeito, em vez de mentir.
      expect(useIKStore.getState().getTarget(id, 'wrist.L')).toEqual(target)
      expect(useIKStore.getState().getReached(id, 'wrist.L')).toBe(false)
    })

    it('volta a resolver quando a junta é destravada', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      // Dentro do alcance do braço (0,515 m), para que "alcançou" seja mesmo
      // sobre a trava e não sobre a distância.
      const target: [number, number, number] = [shoulderPos.x + 0.2, shoulderPos.y - 0.3, shoulderPos.z + 0.1]

      useFiguresStore.getState().toggleJointLock(id, 'elbow.L')
      applyIKTarget(id, 'wrist.L', target)
      useFiguresStore.getState().toggleJointLock(id, 'elbow.L')
      applyIKTarget(id, 'wrist.L', target)

      expect(useIKStore.getState().getReached(id, 'wrist.L')).toBe(true)
    })
  })
})

/**
 * Giro do cotovelo/joelho (DECISOES.md #44). A geometria está travada em
 * `ikSolver.test.ts`; aqui trava-se a regra da ação: a mão não sai do alvo —
 * nem quando o ângulo pedido não existe.
 */
describe('ikActions — giro do cotovelo/joelho', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useIKStore.setState(useIKStore.getInitialState())
  })

  function bracoDobrado() {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'handsOnHips')
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    const { joints } = buildJointFrames(figure)
    const punho = new THREE.Vector3()
    joints.get('wrist.L')!.getWorldPosition(punho)
    // Liga o IK com o alvo exatamente onde a mão já está.
    toggleLimbIK(id, 'wrist.L')
    return { id, punho }
  }

  const mundo = (id: string, joint: string) => {
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)!
    const { joints } = buildJointFrames(figure)
    const v = new THREE.Vector3()
    joints.get(joint)!.getWorldPosition(v)
    return v
  }

  it('move o cotovelo e mantém a mão no alvo', () => {
    const { id, punho } = bracoDobrado()
    const cotoveloAntes = mundo(id, 'elbow.L')

    applyIKSwivel(id, 'wrist.L', readIKSwivel(id, 'wrist.L') + 25)

    expect(mundo(id, 'elbow.L').distanceTo(cotoveloAntes)).toBeGreaterThan(0.03)
    expect(mundo(id, 'wrist.L').distanceTo(punho)).toBeLessThan(0.01)
  })

  /**
   * A volta inteira não é alcançável (medido: os limites liberam uma faixa
   * contígua, e fora dela o efetuador escapa até 88 cm). Recusar é o que faz o
   * controle parar na borda em vez de arrancar a mão do alvo.
   */
  it('recusa em silêncio um ângulo que tiraria a mão do alvo', () => {
    const { id, punho } = bracoDobrado()
    const poseAntes = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose

    applyIKSwivel(id, 'wrist.L', readIKSwivel(id, 'wrist.L') + 180)

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toBe(poseAntes)
    expect(mundo(id, 'wrist.L').distanceTo(punho)).toBeLessThan(0.01)
  })

  it('não faz nada com uma junta da cadeia travada', () => {
    const { id } = bracoDobrado()
    useFiguresStore.getState().toggleJointLock(id, 'shoulder.L')
    const poseAntes = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose

    applyIKSwivel(id, 'wrist.L', readIKSwivel(id, 'wrist.L') + 25)

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toBe(poseAntes)
  })

  it('não faz nada sem IK ligado (não há alvo para segurar a mão)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().applyPosePreset(id, 'handsOnHips')
    const poseAntes = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose

    applyIKSwivel(id, 'wrist.L', 40)

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toBe(poseAntes)
  })

  it('readIKSwivel devolve o ângulo da pose, e 0 para boneco ou membro inexistente', () => {
    const { id } = bracoDobrado()
    const antes = readIKSwivel(id, 'wrist.L')

    applyIKSwivel(id, 'wrist.L', antes + 20)

    expect(readIKSwivel(id, 'wrist.L')).toBeCloseTo(antes + 20, 0)
    expect(readIKSwivel('figure-inexistente', 'wrist.L')).toBe(0)
    expect(readIKSwivel(id, 'not-a-limb')).toBe(0)
  })

  /**
   * Cada junta escrita é uma entrada, como já acontece ao arrastar o alvo do
   * IK (a ação escreve ombro e cotovelo em duas chamadas) — o giro segue a
   * convenção que já existia, em vez de inventar uma granularidade própria.
   */
  it('é edição de pose normal: entra no histórico de undo', () => {
    const { id } = bracoDobrado()
    const poseAntes = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose
    const entradasAntes = useFiguresStore.temporal.getState().pastStates.length

    applyIKSwivel(id, 'wrist.L', readIKSwivel(id, 'wrist.L') + 25)

    expect(useFiguresStore.temporal.getState().pastStates.length).toBeGreaterThan(entradasAntes)

    useFiguresStore.temporal.getState().undo()
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().figures.find((f) => f.id === id)!.pose).toEqual(poseAntes)
  })
})
