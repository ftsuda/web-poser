import { describe, expect, it } from 'vitest'
import {
  SCENE_EXTRAS_VERSION,
  cameraBookmarkFromExtras,
  cameraBookmarkToExtras,
  figureFromExtras,
  figureToExtras,
  sceneFromExtras,
  sceneToExtras,
  type SceneWorkingState,
} from '../sceneSerialization'
import { DEFAULT_FIGURE_COLOR } from '../../store/figuresStore'
import type { CameraBookmark, Figure } from '../../store/figuresStore'

const sampleFigure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.75,
  position: [1.2, 0, -0.6],
  rotation: { x: 0, y: 45, z: 0 },
  pose: {
    'shoulder.L': { x: 30, y: 0, z: 10 },
    'elbow.L': { x: -90, y: 0, z: 0 },
  },
}

const sampleBookmark: CameraBookmark = {
  id: 'camera-bookmark-1',
  name: 'Plano geral',
  position: [3, 2, 4],
  target: [0, 1, 0],
  projection: 'perspective',
  fov: 50,
  zoom: 1,
}

const sampleScene: SceneWorkingState = {
  name: 'Cena de teste',
  figures: [sampleFigure],
  nextFigureSeq: 2,
  environment: { background: 'dark', grid: false },
  cameraBookmarks: [sampleBookmark],
  nextCameraBookmarkSeq: 2,
  nextSnapshotNumber: 7,
}

describe('sceneSerialization — figura', () => {
  it('converte uma figura para o formato de extras e de volta sem perda', () => {
    const extras = figureToExtras(sampleFigure)
    expect(extras.joints['shoulder.L']).toEqual([30, 0, 10])
    expect(extras.position).toEqual([1.2, 0, -0.6])

    const restored = figureFromExtras(extras, 0)
    expect(restored).toEqual(sampleFigure)
  })

  it('aplica defaults e grampeamento de skeleton.ts ao reconstruir uma figura de extras não confiáveis', () => {
    const restored = figureFromExtras(
      {
        id: 'figure-9',
        joints: { 'elbow.L': [-999, 0, 0] }, // fora do limite (-150 a 0) — deve ser grampeado
      },
      0,
    )
    expect(restored.pose['elbow.L']).toEqual({ x: -150, y: 0, z: 0 })
    expect(restored.name).toBe('Figure 1')
    expect(restored.color).toBe('#e04040')
    expect(restored.visible).toBe(true)
    expect(restored.height).toBeCloseTo(1.7)
  })

  it('ignora juntas desconhecidas ao reconstruir (não lança erro)', () => {
    const restored = figureFromExtras({ id: 'f1', joints: { juntaInexistente: [1, 2, 3] } }, 0)
    expect(restored.pose.juntaInexistente).toBeUndefined()
  })

  /**
   * Arquivo gravado antes do dedo indicador separado (DECISOES.md #45): sem a
   * migração o indicador nasceria esticado no meio de um punho fechado.
   */
  it('completa o indicador a partir do bloco em cenas gravadas antes dele existir', () => {
    const restored = figureFromExtras(
      {
        id: 'f1',
        joints: {
          'fingersBase.L': [85, 0, 0],
          'fingersMid.L': [105, 0, 0],
          'fingersTip.L': [80, 0, 0],
        },
      },
      0,
    )
    expect(restored.pose['indexBase.L']).toEqual({ x: 85, y: 0, z: 0 })
    expect(restored.pose['indexMid.L']).toEqual({ x: 105, y: 0, z: 0 })
    expect(restored.pose['indexTip.L']).toEqual({ x: 80, y: 0, z: 0 })
  })

  it('grampeia a altura fora do intervalo permitido ao reconstruir', () => {
    const restored = figureFromExtras({ id: 'f1', height: 99 }, 0)
    expect(restored.height).toBe(1.9)
  })

  // Cor livre (DECISOES.md #39): o campo deixou de ser "uma das 5 da paleta" e
  // passou a ser "qualquer #rrggbb" — o que torna a validação de FORMATO na
  // leitura obrigatória, já que o valor vai direto para o material do three.js
  // e para o `style` do painel.
  it('aceita qualquer cor hexadecimal do arquivo e normaliza a forma curta', () => {
    expect(figureFromExtras({ id: 'f1', color: '#7F3AC1' }, 0).color).toBe('#7f3ac1')
    expect(figureFromExtras({ id: 'f1', color: '#0f8' }, 0).color).toBe('#00ff88')
  })

  it('cai para a cor padrão quando o arquivo traz algo que não é cor', () => {
    for (const bogus of ['red', 'rgb(1,2,3)', '#12345', 42, null, { r: 1 }]) {
      expect(figureFromExtras({ id: 'f1', color: bogus }, 0).color).toBe(DEFAULT_FIGURE_COLOR)
    }
  })

  it('usa um id/nome de fallback quando o extras não é um objeto válido', () => {
    const restored = figureFromExtras(null, 2)
    expect(restored.id).toBe('figure-3')
    expect(restored.name).toBe('Figure 3')
    expect(restored.position).toEqual([0, 0, 0])
  })
})

describe('sceneSerialization — bookmark de câmera', () => {
  it('converte um bookmark para extras e de volta sem perda', () => {
    const extras = cameraBookmarkToExtras(sampleBookmark)
    const restored = cameraBookmarkFromExtras(extras, 0)
    expect(restored).toEqual(sampleBookmark)
  })

  it('cai para "perspective" quando a projeção do extras é inválida/ausente', () => {
    const restored = cameraBookmarkFromExtras({ id: 'b1', projection: 'isometric' }, 0)
    expect(restored.projection).toBe('perspective')
  })

  /** Ângulo holandês (DECISOES.md #46): sem o `up`, o bookmark voltaria endireitado. */
  it('preserva a inclinação da câmera no round-trip', () => {
    const inclinado = { ...sampleBookmark, up: [0.5, 0.866, 0] as [number, number, number] }
    expect(cameraBookmarkFromExtras(cameraBookmarkToExtras(inclinado), 0)).toEqual(inclinado)
  })

  it('bookmark gravado antes da inclinação existir não ganha um `up` inventado', () => {
    const restored = cameraBookmarkFromExtras({ id: 'b1', position: [1, 2, 3], target: [0, 0, 0] }, 0)
    expect(restored.up).toBeUndefined()
  })
})

describe('sceneSerialization — cena completa', () => {
  it('faz o round-trip completo (cena → extras → cena) preservando todos os campos', () => {
    const extras = sceneToExtras(sampleScene)
    expect(extras.version).toBe(SCENE_EXTRAS_VERSION)
    expect(extras.snapshotCounter).toBe(7)

    const restored = sceneFromExtras(extras)
    expect(restored).toEqual(sampleScene)
  })

  it('continua a contagem de cenas gravadas com o nome antigo `keyframeCounter`', () => {
    // Renomeação da fase 10 (DECISOES.md #52): grava-se `snapshotCounter`, mas
    // um `.glb` salvo antes dela só tem o nome antigo — e reiniciar a sequência
    // do 1 sobrescreveria arquivos já gravados na pasta.
    expect(sceneFromExtras({ keyframeCounter: 13 }).nextSnapshotNumber).toBe(13)
    // Com os dois presentes (arquivo gravado por uma versão nova e editado à
    // mão), manda o nome novo.
    expect(sceneFromExtras({ keyframeCounter: 13, snapshotCounter: 20 }).nextSnapshotNumber).toBe(20)
  })

  it('aplica defaults completos quando o extras está vazio/corrompido', () => {
    const restored = sceneFromExtras({})
    expect(restored.name).toBe('Cena 1')
    expect(restored.figures).toEqual([])
    expect(restored.nextFigureSeq).toBe(1)
    expect(restored.environment).toEqual({ background: 'medium', grid: true })
    expect(restored.cameraBookmarks).toEqual([])
    expect(restored.nextCameraBookmarkSeq).toBe(1)
    expect(restored.nextSnapshotNumber).toBe(1)
  })

  it('aplica defaults quando o extras é undefined/não-objeto (ex.: .glb sem o bloco do app)', () => {
    const restored = sceneFromExtras(undefined)
    expect(restored.name).toBe('Cena 1')
    expect(restored.figures).toEqual([])
  })

  it('deriva nextFigureSeq/nextCameraBookmarkSeq a partir da contagem quando ausentes no extras', () => {
    const restored = sceneFromExtras({
      figures: [{ id: 'f1' }, { id: 'f2' }],
      cameraBookmarks: [{ id: 'b1' }],
    })
    expect(restored.nextFigureSeq).toBe(3)
    expect(restored.nextCameraBookmarkSeq).toBe(2)
  })
})
