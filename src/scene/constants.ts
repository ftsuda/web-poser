import type { BackgroundTone } from '../store/figuresStore'
import { DEFAULT_FOCAL_MM, focalLengthToFov } from './lens'

export const BACKGROUND_COLORS: Record<BackgroundTone, string> = {
  light: '#b3b3b3',
  medium: '#808080',
  dark: '#404040',
}

export const CAMERA_DEFAULTS = {
  position: [3, 2, 4] as [number, number, number],
  // Em GRAUS, mas quem manda é a lente: 35 mm (ver `lens.ts`).
  fov: focalLengthToFov(DEFAULT_FOCAL_MM),
  near: 0.1,
  far: 100,
}

export const GROUND_SIZE = 20
export const GRID_DIVISIONS = 20

/** Distância entre duas linhas da grade do chão, em metros. */
export const GRID_SPACING_M = GROUND_SIZE / GRID_DIVISIONS

/**
 * Régua vertical do viewport (fase 9, item 11). Altura acima do boneco mais
 * alto possível (1,90 m), com folga para poses erguidas; traços finos a cada
 * 10 cm entre as marcas de metro. Onde ela fica não é constante: a régua é
 * ancorada no boneco selecionado, acompanhando o gizmo de translação (o
 * `RULER_POSITION` fixo num cruzamento da grade saiu daqui — DECISOES.md #33).
 */
export const RULER_HEIGHT_M = 2.5
export const RULER_MINOR_STEP_M = 0.1

/**
 * Nomes dos objetos que são "apoio de tela", não conteúdo da cena — a captura
 * de instantâneo os esconde quando "ocultar grade/gizmos" está ligado
 * (`SnapshotCapture.tsx`). Fonte única para não sair do ar quando um overlay
 * novo é adicionado (foi o que aconteceu na fase 9 com o indicador de grade e
 * a régua vertical).
 */
export const OVERLAY_NAMES = {
  grid: 'scene-grid',
  gridAlignment: 'scene-grid-alignment',
  verticalRuler: 'scene-vertical-ruler',
  /**
   * Papel-cebola (item 31). Entrar nesta lista é o que garante que os fantasmas
   * fiquem só na tela: o PNG e o MP4 já escondem tudo o que está aqui, com uma
   * regra só. Um grupo, não um objeto por fantasma — esconder o pai basta.
   */
  onionSkin: 'scene-onion-skin',
  /**
   * Gizmo da câmera de cena (fase 11): apoio de tela por definição — a câmera
   * não pode aparecer na própria foto, e o modo visão-câmera também o esconde.
   */
  sceneCamera: 'scene-camera-gizmo',
} as const

export const OVERLAY_NAME_LIST: readonly string[] = Object.values(OVERLAY_NAMES)
