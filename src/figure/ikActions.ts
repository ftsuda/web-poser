import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import { IK_CHAINS, solveIKChain } from './ikSolver'
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

  const result = solveIKChain(figure, chain, targetWorldPosition)
  const { setJointRotation } = useFiguresStore.getState()
  for (const [jointName, rotation] of Object.entries(result.rotations)) {
    setJointRotation(figureId, jointName, rotation)
  }

  useIKStore.getState().setTarget(figureId, endEffector, [...targetWorldPosition])
  useIKStore.getState().setReached(figureId, endEffector, result.reached)
}
