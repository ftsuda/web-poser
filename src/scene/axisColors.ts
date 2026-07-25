import type { Axis } from '../figure/skeleton'

/**
 * Cores dos eixos X/Y/Z, iguais às usadas pelo gizmo do `TransformControls`
 * (`three-stdlib`: vermelho `0xff0000`, verde `0x00ff00`, azul `0x0000ff`) —
 * fase 9, item 9. Fonte única para que os controles numéricos do painel de
 * Propriedades (posição, rotação, alvo de IK) usem exatamente a mesma
 * convenção da seta/anel correspondente no viewport, em vez de uma paleta
 * "parecida" que se desencontre da do gizmo.
 */
export const AXIS_COLORS: Record<Axis, string> = {
  x: '#ff0000',
  y: '#00ff00',
  z: '#0000ff',
}
