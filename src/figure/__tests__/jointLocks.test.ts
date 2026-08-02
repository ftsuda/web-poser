import { describe, expect, it } from 'vitest'
import {
  clearFigureLocks,
  copyFigureLocks,
  getLockedJoints,
  getLockedRootAxes,
  isJointLocked,
  isRootAxisLocked,
  mergeLockedJoints,
  pruneJointLocks,
  rootAxisLockToken,
  sanitizeJointLocks,
  toggleJointLock,
} from '../jointLocks'

describe('jointLocks', () => {
  it('trava e destrava a mesma junta', () => {
    const travado = toggleJointLock({}, 'figure-1', 'elbow.L')
    expect(isJointLocked(travado, 'figure-1', 'elbow.L')).toBe(true)

    const destravado = toggleJointLock(travado, 'figure-1', 'elbow.L')
    expect(isJointLocked(destravado, 'figure-1', 'elbow.L')).toBe(false)
  })

  it('cada boneco tem as suas travas', () => {
    const locks = toggleJointLock(toggleJointLock({}, 'figure-1', 'elbow.L'), 'figure-2', 'knee.R')

    expect(getLockedJoints(locks, 'figure-1')).toEqual(['elbow.L'])
    expect(getLockedJoints(locks, 'figure-2')).toEqual(['knee.R'])
    expect(getLockedJoints(locks, 'figure-3')).toEqual([])
  })

  /** A `root` é colocação do boneco na cena, não parte da pose. */
  it('recusa a root e nomes de junta desconhecidos, sem alterar o mapa', () => {
    const locks = { 'figure-1': ['elbow.L'] }
    expect(toggleJointLock(locks, 'figure-1', 'root')).toBe(locks)
    expect(toggleJointLock(locks, 'figure-1', 'asaEsquerda')).toBe(locks)
  })

  it('limpa todas as travas de um boneco', () => {
    const locks = toggleJointLock(toggleJointLock({}, 'figure-1', 'elbow.L'), 'figure-1', 'knee.L')
    expect(getLockedJoints(clearFigureLocks(locks, 'figure-1'), 'figure-1')).toEqual([])
  })

  it('duplicar um boneco leva as travas junto', () => {
    const locks = toggleJointLock({}, 'figure-1', 'elbow.L')
    const copiado = copyFigureLocks(locks, 'figure-1', 'figure-2')

    expect(getLockedJoints(copiado, 'figure-2')).toEqual(['elbow.L'])
    // Cópia, não a mesma lista: destravar num não pode destravar no outro.
    expect(copiado['figure-2']).not.toBe(copiado['figure-1'])
  })

  it('descarta travas de bonecos que não existem mais', () => {
    const locks = { 'figure-1': ['elbow.L'], 'figure-9': ['knee.R'] }
    expect(pruneJointLocks(locks, ['figure-1'])).toEqual({ 'figure-1': ['elbow.L'] })
  })

  /**
   * Trava por eixo da raiz (item 64): tokens `root.x`/`root.y`/`root.z` no
   * MESMO mapa — mesma persistência, cópia e poda das travas de junta. A
   * `root` crua continua recusada: travar a raiz inteira é travar os três.
   */
  describe('trava por eixo da raiz (item 64)', () => {
    it('trava e destrava um eixo da raiz pelo token', () => {
      const travado = toggleJointLock({}, 'figure-1', rootAxisLockToken('y'))
      expect(isRootAxisLocked(travado, 'figure-1', 'y')).toBe(true)
      expect(isRootAxisLocked(travado, 'figure-1', 'x')).toBe(false)

      const destravado = toggleJointLock(travado, 'figure-1', rootAxisLockToken('y'))
      expect(isRootAxisLocked(destravado, 'figure-1', 'y')).toBe(false)
    })

    it('lista os eixos travados na ordem x, y, z, independente da ordem de travar', () => {
      let locks = toggleJointLock({}, 'figure-1', rootAxisLockToken('z'))
      locks = toggleJointLock(locks, 'figure-1', rootAxisLockToken('x'))
      expect(getLockedRootAxes(locks, 'figure-1')).toEqual(['x', 'z'])
    })

    it('tokens convivem com travas de junta no mesmo boneco', () => {
      let locks = toggleJointLock({}, 'figure-1', 'elbow.L')
      locks = toggleJointLock(locks, 'figure-1', rootAxisLockToken('y'))

      expect(isJointLocked(locks, 'figure-1', 'elbow.L')).toBe(true)
      expect(getLockedRootAxes(locks, 'figure-1')).toEqual(['y'])
      // O token não vaza como "junta travada" em quem pergunta por nome.
      expect(isJointLocked(locks, 'figure-1', 'root')).toBe(false)
    })

    it('sanitize mantém os tokens e continua recusando a root crua', () => {
      expect(
        sanitizeJointLocks({ 'figure-1': ['root.y', 'root', 'root.w', 'elbow.L'] }),
      ).toEqual({ 'figure-1': ['root.y', 'elbow.L'] })
    })
  })

  describe('sanitizeJointLocks', () => {
    it('mantém só nomes de junta conhecidos, sem root e sem repetição', () => {
      expect(
        sanitizeJointLocks({
          'figure-1': ['elbow.L', 'elbow.L', 'root', 'asaEsquerda', 42],
          'figure-2': ['knee.R'],
        }),
      ).toEqual({ 'figure-1': ['elbow.L'], 'figure-2': ['knee.R'] })
    })

    it('descarta bonecos sem nenhuma junta válida e entradas que não são lista', () => {
      expect(sanitizeJointLocks({ 'figure-1': ['root'], 'figure-2': 'elbow.L' })).toEqual({})
    })

    it('devolve mapa vazio para qualquer coisa que não seja um objeto', () => {
      expect(sanitizeJointLocks(null)).toEqual({})
      expect(sanitizeJointLocks(['elbow.L'])).toEqual({})
      expect(sanitizeJointLocks('elbow.L')).toEqual({})
    })
  })

  describe('mergeLockedJoints', () => {
    it('preserva as juntas travadas e deixa o resto vir da pose nova', () => {
      const atual = { 'elbow.L': 1, 'knee.L': 2 }
      const nova = { 'elbow.L': 10, 'knee.L': 20 }

      expect(mergeLockedJoints(atual, nova, ['elbow.L'])).toEqual({ 'elbow.L': 1, 'knee.L': 20 })
    })

    it('sem travas, devolve a pose nova como está (sem cópia desnecessária)', () => {
      const nova = { 'elbow.L': 10 }
      expect(mergeLockedJoints({ 'elbow.L': 1 }, nova, [])).toBe(nova)
    })

    it('ignora uma trava de junta que a pose atual não tem', () => {
      expect(mergeLockedJoints({}, { 'elbow.L': 10 }, ['knee.L'])).toEqual({ 'elbow.L': 10 })
    })
  })
})
