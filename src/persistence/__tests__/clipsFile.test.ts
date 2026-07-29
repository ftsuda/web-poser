import { describe, expect, it } from 'vitest'
import { CLIPS_VERSION, buildClipsFile, parseClipsFile } from '../clipsFile'
import type { SavedClip } from '../../animation/clipLibrary'
import { resolvePosePreset } from '../../figure/posePresets'

const clip: SavedClip = {
  id: 'clip-1',
  name: 'Caminhada',
  roleHeights: [1.7],
  steps: [
    {
      durationMs: 1000,
      label: 'Andando 1',
      figures: [{ role: 0, pose: resolvePosePreset('walking'), rotation: { x: 0, y: 0, z: 0 }, position: [0, 0, 0] }],
    },
    {
      durationMs: 500,
      figures: [{ role: 0, pose: resolvePosePreset('walking'), rotation: { x: 0, y: 0, z: 0 }, position: [0, 0, 1] }],
    },
  ],
}

describe('clipsFile', () => {
  it('grava versão, leiame e os trechos', () => {
    const file = buildClipsFile([clip])

    expect(file.version).toBe(CLIPS_VERSION)
    expect(file.leiame.length).toBeGreaterThan(0)
    expect(file.clips).toHaveLength(1)
  })

  /** A câmera é o que o trecho NÃO guarda — decisão do usuário no item 39. */
  it('o arquivo não carrega câmera nenhuma', () => {
    expect(JSON.stringify(buildClipsFile([clip]))).not.toContain('focalMm')
  })

  it('faz round-trip do trecho, com rótulo e alturas', () => {
    const [restaurado] = parseClipsFile(JSON.parse(JSON.stringify(buildClipsFile([clip]))))

    expect(restaurado.id).toBe('clip-1')
    expect(restaurado.name).toBe('Caminhada')
    expect(restaurado.roleHeights).toEqual([1.7])
    expect(restaurado.steps.map((step) => step.label)).toEqual(['Andando 1', undefined])
    expect(restaurado.steps[1].figures[0].position).toEqual([0, 0, 1])
  })

  /** Quem edita à mão às vezes cola só o array — mesma tolerância do `poses.json`. */
  it('aceita a lista crua, além do arquivo completo', () => {
    expect(parseClipsFile([clip])).toHaveLength(1)
  })

  it('entrada inválida vira lista vazia, sem lançar', () => {
    expect(parseClipsFile(null)).toEqual([])
    expect(parseClipsFile({ clips: 'nada' })).toEqual([])
    expect(() => parseClipsFile('texto qualquer')).not.toThrow()
  })
})
