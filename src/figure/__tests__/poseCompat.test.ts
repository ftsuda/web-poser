import { describe, expect, it } from 'vitest'
import { withLegacyIndexFinger } from '../poseCompat'
import type { JointRotation } from '../skeleton'

/**
 * Poses gravadas antes do #45 não têm `index*`: o indicador nasceria ESTICADO
 * enquanto o bloco continua fechado — um punho salvo viraria um "apontando".
 * A migração copia o bloco para o indicador na leitura, reproduzindo o gesto
 * antigo exatamente (era um dedo só para os quatro).
 */
describe('withLegacyIndexFinger', () => {
  const punhoAntigo: Record<string, JointRotation> = {
    'fingersBase.L': { x: 85, y: 0, z: 0 },
    'fingersMid.L': { x: 105, y: 0, z: 0 },
    'fingersTip.L': { x: 80, y: 0, z: 0 },
  }

  it('copia o bloco para o indicador quando a pose não traz o indicador', () => {
    const migrada = withLegacyIndexFinger(punhoAntigo)
    expect(migrada['indexBase.L']).toEqual({ x: 85, y: 0, z: 0 })
    expect(migrada['indexMid.L']).toEqual({ x: 105, y: 0, z: 0 })
    expect(migrada['indexTip.L']).toEqual({ x: 80, y: 0, z: 0 })
    // O bloco não muda.
    expect(migrada['fingersBase.L']).toEqual(punhoAntigo['fingersBase.L'])
  })

  it('não toca em poses que já trazem o indicador (arquivo novo manda)', () => {
    const nova = { ...punhoAntigo, 'indexBase.L': { x: 0, y: 0, z: 0 } }
    const migrada = withLegacyIndexFinger(nova)
    expect(migrada['indexBase.L']).toEqual({ x: 0, y: 0, z: 0 })
    // As outras juntas do indicador não são inventadas: o arquivo já decidiu.
    expect(migrada['indexMid.L']).toBeUndefined()
  })

  it('trata cada mão por si', () => {
    const soEsquerda = { ...punhoAntigo, 'indexBase.R': { x: 10, y: 0, z: 0 } }
    const migrada = withLegacyIndexFinger(soEsquerda)
    expect(migrada['indexBase.L']).toEqual({ x: 85, y: 0, z: 0 })
    expect(migrada['indexBase.R']).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('devolve a MESMA referência quando não há nada a migrar', () => {
    const semMao = { 'elbow.L': { x: -30, y: 90, z: 0 } }
    expect(withLegacyIndexFinger(semMao)).toBe(semMao)
  })

  it('copia só as juntas do bloco presentes na pose', () => {
    const parcial = { 'fingersBase.L': { x: 40, y: 0, z: 0 } }
    const migrada = withLegacyIndexFinger(parcial)
    expect(migrada['indexBase.L']).toEqual({ x: 40, y: 0, z: 0 })
    expect(migrada['indexMid.L']).toBeUndefined()
  })
})
