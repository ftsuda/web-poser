import { create } from 'zustand'

/**
 * Estado de ferramenta do modo IK — quais membros (braço/perna, por
 * boneco) estão em IK em vez de FK, e a posição do alvo arrastável de cada
 * um. Fora do histórico de undo (é modo de ferramenta, não conteúdo — mesmo
 * raciocínio de `cameraStore.ts`/`snapshotCaptureStore.ts`); a pose
 * resultante do solver (`ikSolver.ts`) é que entra no undo, como qualquer
 * outra edição de `figure.pose` (ver PLANO.md > "Interação de pose", item 5).
 */

type Vec3 = [number, number, number]

function limbKey(figureId: string, endEffector: string): string {
  return `${figureId}:${endEffector}`
}

export interface IKState {
  enabledLimbs: Record<string, boolean>
  targets: Record<string, Vec3>
  reached: Record<string, boolean>
  isLimbEnabled: (figureId: string, endEffector: string) => boolean
  getTarget: (figureId: string, endEffector: string) => Vec3 | undefined
  getReached: (figureId: string, endEffector: string) => boolean
  enableLimb: (figureId: string, endEffector: string, initialTargetWorldPosition: Vec3) => void
  disableLimb: (figureId: string, endEffector: string) => void
  setTarget: (figureId: string, endEffector: string, worldPosition: Vec3) => void
  setReached: (figureId: string, endEffector: string, reached: boolean) => void
  /** Limpa todo estado de IK de um boneco removido — evita vazar chaves de bonecos que não existem mais. */
  removeFigure: (figureId: string) => void
}

export const useIKStore = create<IKState>()((set, get) => ({
  enabledLimbs: {},
  targets: {},
  reached: {},

  isLimbEnabled: (figureId, endEffector) => get().enabledLimbs[limbKey(figureId, endEffector)] === true,
  getTarget: (figureId, endEffector) => get().targets[limbKey(figureId, endEffector)],
  getReached: (figureId, endEffector) => get().reached[limbKey(figureId, endEffector)] ?? true,

  enableLimb: (figureId, endEffector, initialTargetWorldPosition) => {
    const key = limbKey(figureId, endEffector)
    set((state) => ({
      enabledLimbs: { ...state.enabledLimbs, [key]: true },
      targets: { ...state.targets, [key]: initialTargetWorldPosition },
      reached: { ...state.reached, [key]: true },
    }))
  },

  disableLimb: (figureId, endEffector) => {
    const key = limbKey(figureId, endEffector)
    set((state) => {
      const enabledLimbs = { ...state.enabledLimbs }
      delete enabledLimbs[key]
      return { enabledLimbs }
    })
  },

  setTarget: (figureId, endEffector, worldPosition) => {
    const key = limbKey(figureId, endEffector)
    set((state) => ({ targets: { ...state.targets, [key]: worldPosition } }))
  },

  setReached: (figureId, endEffector, reachedValue) => {
    const key = limbKey(figureId, endEffector)
    set((state) => ({ reached: { ...state.reached, [key]: reachedValue } }))
  },

  removeFigure: (figureId) => {
    const prefix = `${figureId}:`
    set((state) => {
      const enabledLimbs = Object.fromEntries(
        Object.entries(state.enabledLimbs).filter(([key]) => !key.startsWith(prefix)),
      )
      const targets = Object.fromEntries(Object.entries(state.targets).filter(([key]) => !key.startsWith(prefix)))
      const reached = Object.fromEntries(Object.entries(state.reached).filter(([key]) => !key.startsWith(prefix)))
      return { enabledLimbs, targets, reached }
    })
  },
}))
