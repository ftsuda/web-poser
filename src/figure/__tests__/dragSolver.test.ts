import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { clampJointRotation, type JointRotation } from '../skeleton'
import { isDraggableJoint, solveJointDrag } from '../dragSolver'

/** Pose toda zerada (membros retos para baixo) — o solver não depende do preset "Em pé". */
const restingFigure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: {},
}

function worldPosition(figure: Figure, jointName: string): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  const position = new THREE.Vector3()
  joints.get(jointName)!.getWorldPosition(position)
  return position
}

function withRotations(figure: Figure, rotations: Record<string, JointRotation>): Figure {
  return { ...figure, pose: { ...figure.pose, ...rotations } }
}

describe('isDraggableJoint', () => {
  it('aceita juntas de membro, tronco e cabeça com ancestral móvel', () => {
    for (const name of ['elbow.L', 'wrist.R', 'knee.L', 'ankle.R', 'ball.L', 'chest', 'neck', 'head', 'clavicle.R', 'shoulder.L']) {
      expect(isDraggableJoint(name), name).toBe(true)
    }
  })

  it('recusa a raiz, as juntas da mão e juntas cujo único ancestral é a raiz', () => {
    for (const name of ['root', 'spine', 'hip.L', 'hip.R', 'thumb1.L', 'thumb2.R', 'indexMid.L', 'fingersTip.R']) {
      expect(isDraggableJoint(name), name).toBe(false)
    }
  })

  it('recusa nome desconhecido sem estourar', () => {
    expect(isDraggableJoint('nao-existe')).toBe(false)
  })
})

describe('solveJointDrag', () => {
  it('alcança um alvo próximo e devolve rotações que REPRODUZEM a posição alcançada via FK normal', () => {
    // Alvo "na esfera" do braço: o punho atual girado 8° em torno do ombro —
    // alcançável por rotação pura, sem mudar o comprimento do membro.
    const shoulder = worldPosition(restingFigure, 'shoulder.L')
    const wrist = worldPosition(restingFigure, 'wrist.L')
    const offset = wrist.clone().sub(shoulder).applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(8))
    const targetVec = shoulder.clone().add(offset)
    const target: [number, number, number] = [targetVec.x, targetVec.y, targetVec.z]

    const result = solveJointDrag(restingFigure, 'wrist.L', target)

    expect(result.reached).toBe(true)
    // A "conversão para o padrão usual" é exata por construção: reconstruir o
    // boneco com as rotações devolvidas (o mesmo FK do renderer) coloca a
    // junta exatamente em achievedWorldPosition.
    const replayed = worldPosition(withRotations(restingFigure, result.rotations), 'wrist.L')
    expect(replayed.distanceTo(new THREE.Vector3(...result.achievedWorldPosition))).toBeLessThan(1e-6)
    expect(replayed.distanceTo(targetVec)).toBeLessThan(0.005)
  })

  it('nunca inclui a raiz nem a própria junta arrastada, e a subárvore abaixo segue rígida', () => {
    const start = worldPosition(restingFigure, 'elbow.L')
    const result = solveJointDrag(restingFigure, 'elbow.L', [start.x + 0.1, start.y, start.z + 0.05])

    expect(result.rotations).not.toHaveProperty('root')
    expect(result.rotations).not.toHaveProperty('elbow.L')
    expect(result.rotations).not.toHaveProperty('wrist.L')
    for (const name of Object.keys(result.rotations)) {
      expect(['shoulder.L', 'clavicle.L', 'upperChest', 'chest', 'spine']).toContain(name)
    }
  })

  it('toda rotação devolvida já está dentro dos limites articulares', () => {
    const result = solveJointDrag(restingFigure, 'wrist.L', [5, 5, 5])
    for (const [name, rotation] of Object.entries(result.rotations)) {
      expect(clampJointRotation(name, rotation)).toEqual(rotation)
    }
  })

  it('alvo que o braço alcança sozinho NÃO recruta o tronco (prioridade próximo→raiz)', () => {
    const shoulder = worldPosition(restingFigure, 'shoulder.L')
    const wrist = worldPosition(restingFigure, 'wrist.L')
    const offset = wrist.clone().sub(shoulder).applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(8))
    const target = shoulder.clone().add(offset)

    const result = solveJointDrag(restingFigure, 'wrist.L', [target.x, target.y, target.z])

    expect(result.rotations).not.toHaveProperty('spine')
    expect(result.rotations).not.toHaveProperty('chest')
    expect(result.rotations).not.toHaveProperty('upperChest')
  })

  it('alvo longe recruta o tronco (a cadeia sobe até perto da raiz)', () => {
    const shoulder = worldPosition(restingFigure, 'shoulder.L')
    // Bem além do alcance do braço (~0,52 m): só chega mais perto inclinando o tronco.
    const target: [number, number, number] = [shoulder.x + 1.2, shoulder.y, shoulder.z]
    const result = solveJointDrag(restingFigure, 'wrist.L', target)

    const trunkMoved = (['spine', 'chest'] as const).some((name) => {
      const rotation = result.rotations[name]
      return rotation && (Math.abs(rotation.x) > 1 || Math.abs(rotation.y) > 1 || Math.abs(rotation.z) > 1)
    })
    expect(trunkMoved).toBe(true)
  })

  it('alvo inalcançável: para na melhor aproximação, com reached=false', () => {
    const result = solveJointDrag(restingFigure, 'wrist.L', [10, 10, 10])
    expect(result.reached).toBe(false)
    const achieved = new THREE.Vector3(...result.achievedWorldPosition)
    expect(achieved.distanceTo(new THREE.Vector3(10, 10, 10))).toBeGreaterThan(1)
    // E a aproximação também é reproduzível pelo FK normal.
    const replayed = worldPosition(withRotations(restingFigure, result.rotations), 'wrist.L')
    expect(replayed.distanceTo(achieved)).toBeLessThan(1e-6)
  })

  it('junta travada fica rígida mas NÃO interrompe a cadeia: as de cima continuam participando', () => {
    const start = worldPosition(restingFigure, 'wrist.L')
    const target: [number, number, number] = [start.x + 0.3, start.y + 0.3, start.z]
    const result = solveJointDrag(restingFigure, 'wrist.L', target, ['shoulder.L'])

    expect(result.rotations).not.toHaveProperty('shoulder.L')
    // Cotovelo (abaixo da trava) e clavícula/tronco (acima) seguem no jogo.
    const others = Object.keys(result.rotations)
    expect(others).toContain('elbow.L')
    expect(others.some((name) => ['clavicle.L', 'upperChest', 'chest', 'spine'].includes(name))).toBe(true)
  })

  it('com TODOS os ancestrais travados a junta não sai do lugar (amplitude zero)', () => {
    const start = worldPosition(restingFigure, 'wrist.L')
    const locked = ['elbow.L', 'shoulder.L', 'clavicle.L', 'upperChest', 'chest', 'spine']
    const result = solveJointDrag(restingFigure, 'wrist.L', [start.x + 0.3, start.y, start.z], locked)

    expect(result.rotations).toEqual({})
    expect(result.reached).toBe(false)
    expect(new THREE.Vector3(...result.achievedWorldPosition).distanceTo(start)).toBeLessThan(1e-6)
  })

  it('estoura para junta desconhecida, como as demais funções do esqueleto', () => {
    expect(() => solveJointDrag(restingFigure, 'nao-existe', [0, 0, 0])).toThrow()
  })
})
