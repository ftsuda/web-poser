import type { Axis } from '../figure/skeleton'

/**
 * Aparência COMPARTILHADA dos indicadores do módulo de poses: as setas de
 * translação, os anéis gimbal e os sliders da aba Junta usam as mesmas cores
 * por eixo (item 60 — é a cor que faz o controle do painel e o desenho no
 * viewport se explicarem um ao outro), e os dois indicadores 3D usam a mesma
 * escala por distância (item 48 — tamanho constante em tela).
 */

/** Cores por eixo, a convenção dos editores 3D: X vermelho, Y verde, Z azul. */
export const AXIS_COLORS: Record<Axis, string> = {
  x: '#e04040',
  y: '#40a840',
  z: '#4060e0',
}

/** Escala do indicador por metro de distância da câmera — 5 m dá o tamanho de projeto. */
export const GIZMO_SCALE_PER_METER = 0.2
