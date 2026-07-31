import { create } from 'zustand'
import {
  DEFAULT_DEPTH_RANGE,
  DEFAULT_GROUND_MODE,
  sanitizeDepthRange,
  type GroundMode,
} from '../scene/depthMap'

/**
 * Estado do MAPA DE PROFUNDIDADE (fase 13): as três escolhas de saída e a faixa
 * que todas compartilham.
 *
 * Fora do histórico de undo e fora dos arquivos, como o `snapshotCaptureStore`
 * e o `cameraStore`: é configuração de ferramenta e modo de visualização, não
 * conteúdo da cena. Também não é persistido em `localStorage` — abrir o app com
 * o viewport em cinza de profundidade seria um susto, e ligar de novo é um
 * clique.
 *
 * **As três são independentes** (decisão do usuário): ver na tela, gerar o PNG
 * e exportar o MP4 não se contaminam. Precisar da imagem normal E do mapa
 * significa gerar duas vezes — e é o sufixo `_depth` no nome que distingue os
 * arquivos na pasta.
 */
export interface DepthState {
  /** Modo de visualização do viewport — a alternância fica na Toolbar, ao lado da régua. */
  previewEnabled: boolean
  /** O próximo "Capturar instantâneo" sai como mapa de profundidade. */
  snapshotDepth: boolean
  /** A próxima exportação de MP4 sai como mapa de profundidade. */
  videoDepth: boolean
  /**
   * Faixa automática: perto e longe medidos a cada saída pela caixa envolvente
   * dos bonecos e objetos visíveis. Travada, valem os números abaixo — que é o
   * que dá uma SEQUÊNCIA com escala estável, sem a imagem "respirar" a cada
   * quadro.
   */
  autoRange: boolean
  nearM: number
  farM: number
  /**
   * O que o chão faz no mapa (ver `depthMap.GroundMode`). Nasce em `clipped`:
   * com a faixa medida só pelos bonecos, o chão em primeiro plano fica fora
   * dela e, grampeado, vira uma cunha branca chapada disputando o branco com a
   * superfície mais próxima do boneco.
   */
  groundMode: GroundMode

  togglePreview: () => void
  toggleSnapshotDepth: () => void
  toggleVideoDepth: () => void
  toggleAutoRange: () => void
  setNearM: (value: number) => void
  setFarM: (value: number) => void
  setGroundMode: (mode: GroundMode) => void
}

export const useDepthStore = create<DepthState>((set, get) => ({
  previewEnabled: false,
  snapshotDepth: false,
  videoDepth: false,
  autoRange: true,
  nearM: DEFAULT_DEPTH_RANGE.near,
  farM: DEFAULT_DEPTH_RANGE.far,
  groundMode: DEFAULT_GROUND_MODE,

  togglePreview: () => set((state) => ({ previewEnabled: !state.previewEnabled })),

  toggleSnapshotDepth: () => set((state) => ({ snapshotDepth: !state.snapshotDepth })),

  toggleVideoDepth: () => set((state) => ({ videoDepth: !state.videoDepth })),

  // Travar NÃO apaga os números: eles são o ponto de partida do ajuste, como a
  // resolução personalizada do instantâneo preserva a que estava em vigor.
  toggleAutoRange: () => set((state) => ({ autoRange: !state.autoRange })),

  // Os campos comitam no `blur` (o padrão dos numéricos do projeto), então
  // grampear aqui não atrapalha quem está digitando — e garante que a faixa
  // guardada é sempre uma faixa que existe.
  setNearM: (value) => {
    const { near, far } = sanitizeDepthRange(value, get().farM)
    set({ nearM: near, farM: far })
  },

  setFarM: (value) => {
    const { near, far } = sanitizeDepthRange(get().nearM, value)
    set({ nearM: near, farM: far })
  },

  setGroundMode: (groundMode) => set({ groundMode }),
}))
