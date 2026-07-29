import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import { IK_CHAINS, getSwivelAngle, solveIKChain } from './ikSolver'
import { isJointLocked } from './jointLocks'
import { useFiguresStore } from '../store/figuresStore'
import { useIKStore } from '../store/ikStore'

/**
 * Ações que conectam o solver de IK (`ikSolver.ts`, puro) aos stores —
 * usadas tanto pelo toggle no painel de Propriedades quanto pelo atalho `R`
 * (`useKeyboardShortcuts.ts`) e pelo alvo arrastável no viewport
 * (`IKTargetGizmo.tsx`), para não duplicar a lógica de liga/desliga e de
 * aplicar uma solução em cada lugar que precisa disparar IK.
 */

/** Liga/desliga o modo IK do membro (identificado pela junta-efetuador, ex. `wrist.L`) do boneco. Ao ligar, o alvo nasce na posição atual do efetuador — arrastar não move nada até o usuário mexer. */
export function toggleLimbIK(figureId: string, endEffector: string): void {
  const figure = useFiguresStore.getState().figures.find((f) => f.id === figureId)
  if (!figure) return

  const ikState = useIKStore.getState()
  if (ikState.isLimbEnabled(figureId, endEffector)) {
    ikState.disableLimb(figureId, endEffector)
    return
  }

  const { joints } = buildJointFrames(figure)
  const jointGroup = joints.get(endEffector)
  if (!jointGroup) return

  const worldPosition = new THREE.Vector3()
  jointGroup.getWorldPosition(worldPosition)
  ikState.enableLimb(figureId, endEffector, [worldPosition.x, worldPosition.y, worldPosition.z])
}

/** Resolve a cadeia para o alvo pedido e grava o resultado em `figuresStore` (undo normal, como qualquer edição de pose) + `ikStore` (alvo/alcançabilidade). */
export function applyIKTarget(
  figureId: string,
  endEffector: string,
  targetWorldPosition: readonly [number, number, number],
): void {
  const figure = useFiguresStore.getState().figures.find((f) => f.id === figureId)
  const chain = IK_CHAINS[endEffector]
  if (!figure || !chain) return

  // Junta travada (DECISOES.md #42): o membro inteiro para. Não é um detalhe
  // de implementação — este solver é analítico de DOIS ossos, e não sabe
  // resolver com um deles preso. Aplicar só a metade destravada moveria o
  // efetuador para um lugar que ninguém pediu; melhor não mexer e sinalizar
  // que o alvo não foi alcançado.
  const locks = useFiguresStore.getState().jointLocks
  if (chain.joints.some((jointName) => isJointLocked(locks, figureId, jointName))) {
    useIKStore.getState().setTarget(figureId, endEffector, [...targetWorldPosition])
    useIKStore.getState().setReached(figureId, endEffector, false)
    return
  }

  const result = solveIKChain(figure, chain, targetWorldPosition)
  const { setJointRotation } = useFiguresStore.getState()
  for (const [jointName, rotation] of Object.entries(result.rotations)) {
    setJointRotation(figureId, jointName, rotation)
  }

  useIKStore.getState().setTarget(figureId, endEffector, [...targetWorldPosition])
  useIKStore.getState().setReached(figureId, endEffector, result.reached)
}

/**
 * Distância máxima que o efetuador pode ficar do alvo para o giro ser
 * aplicado. Medido: dentro da faixa alcançável o solver acerta o alvo com erro
 * de 0,0 mm; fora dela o efetuador escapa 18 cm ou mais. Qualquer corte entre
 * um e outro classifica igual — 1 cm é a mesma tolerância que o resto do IK usa.
 */
const SWIVEL_TOLERANCE_M = 0.01

/**
 * Gira o cotovelo/joelho em torno do eixo base→alvo, mantendo o efetuador
 * onde está (DECISOES.md #44). O alvo do IK não muda — ele já é o "pino" da
 * mão; o que muda é só de que lado o cotovelo aponta.
 *
 * **Só aplica se a mão continuar no alvo.** A volta inteira não é alcançável:
 * os limites do ombro/quadril liberam uma faixa contígua, e fora dela a
 * rotação da base é grampeada e o efetuador escapa até 88 cm do alvo — o
 * oposto do que o controle promete. Recusar deixa o membro parado na borda da
 * faixa, como um slider de junta que bate no limite.
 */
export function applyIKSwivel(figureId: string, endEffector: string, swivelDeg: number): void {
  const figure = useFiguresStore.getState().figures.find((f) => f.id === figureId)
  const chain = IK_CHAINS[endEffector]
  if (!figure || !chain) return

  const locks = useFiguresStore.getState().jointLocks
  if (chain.joints.some((jointName) => isJointLocked(locks, figureId, jointName))) return

  const target = useIKStore.getState().getTarget(figureId, endEffector)
  if (!target) return

  const result = solveIKChain(figure, chain, target, { swivelDeg })
  if (result.remainingDistanceM > SWIVEL_TOLERANCE_M) return

  const { setJointRotation } = useFiguresStore.getState()
  for (const [jointName, rotation] of Object.entries(result.rotations)) {
    setJointRotation(figureId, jointName, rotation)
  }
}

/** Giro atual do cotovelo/joelho do membro, lido da pose — o valor que o controle exibe. */
export function readIKSwivel(figureId: string, endEffector: string): number {
  const figure = useFiguresStore.getState().figures.find((f) => f.id === figureId)
  const chain = IK_CHAINS[endEffector]
  if (!figure || !chain) return 0
  return getSwivelAngle(figure, chain)
}
