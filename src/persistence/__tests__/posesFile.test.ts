import { describe, expect, it } from 'vitest'
import type { SavedPose } from '../../figure/poseLibrary'
import { getJoint } from '../../figure/skeleton'
import { POSES_FILENAME, POSES_VERSION, buildPosesFile, parsePosesFile } from '../posesFile'

const pose: SavedPose = {
  id: 'pose-1',
  name: 'Guarda alta',
  pose: { 'shoulder.L': { x: 10, y: 90, z: 20 }, 'elbow.L': { x: -30, y: 90, z: 0 } },
  rotation: { x: 0, y: 0, z: 0 },
  groundOffsetM: 0,
  preservesHeading: true,
}

const deitada: SavedPose = {
  ...pose,
  id: 'pose-2',
  name: 'Deitado',
  rotation: { x: -90, y: 0, z: 0 },
  groundOffsetM: -0.79,
  preservesHeading: false,
}

describe('posesFile — biblioteca de poses do workspace (DECISOES.md #42)', () => {
  it('grava versão, leiame e as juntas em tupla de graus', () => {
    const file = buildPosesFile([pose])

    expect(file.version).toBe(POSES_VERSION)
    expect(file.leiame.length).toBeGreaterThan(0)
    expect(file.poses[0].pose['shoulder.L']).toEqual([10, 90, 20])
    expect(file.poses[0].rotation).toEqual([0, 0, 0])
  })

  /** Campo derivado da rotação: gravá-lo só criaria a chance de os dois se contradizerem. */
  it('não grava preservesHeading — ele é recalculado na leitura', () => {
    expect('preservesHeading' in buildPosesFile([deitada]).poses[0]).toBe(false)
    expect(parsePosesFile(buildPosesFile([deitada]))[0].preservesHeading).toBe(false)
    expect(parsePosesFile(buildPosesFile([pose]))[0].preservesHeading).toBe(true)
  })

  it('faz o round-trip completo, inclusive o assentamento de uma pose deitada', () => {
    const [voltou] = parsePosesFile(buildPosesFile([deitada]))

    expect(voltou.id).toBe('pose-2')
    expect(voltou.name).toBe('Deitado')
    expect(voltou.pose).toEqual(deitada.pose)
    expect(voltou.rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(voltou.groundOffsetM).toBeCloseTo(-0.79, 6)
  })

  it('aceita o arquivo inteiro ou só a lista de poses colada à mão', () => {
    const file = buildPosesFile([pose, deitada])
    expect(parsePosesFile(file)).toHaveLength(2)
    expect(parsePosesFile(file.poses)).toHaveLength(2)
  })

  it('não quebra com arquivo ilegível: devolve biblioteca vazia', () => {
    expect(parsePosesFile(null)).toEqual([])
    expect(parsePosesFile({ poses: 'nada' })).toEqual([])
    expect(parsePosesFile('nem json de objeto')).toEqual([])
  })

  it('grampeia as juntas nos limites em vigor ao ler', () => {
    const limite = getJoint('elbow.L').limits.x!
    const [voltou] = parsePosesFile({
      poses: [{ ...pose, pose: { 'elbow.L': [limite.max + 900, 90, 0] } }],
    })
    expect(voltou.pose['elbow.L'].x).toBe(limite.max)
  })

  it('o nome do arquivo é estável (o manifesto aponta para ele)', () => {
    expect(POSES_FILENAME).toBe('poses.json')
  })
})
