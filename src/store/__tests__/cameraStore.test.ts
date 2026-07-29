import { beforeEach, describe, expect, it } from 'vitest'
import { CAMERA_DEFAULTS } from '../../scene/constants'
import { MAX_FOCAL_MM, focalLengthToFov } from '../../scene/lens'
import { MAX_ROLL_DEG } from '../../scene/shotFraming'
import { useCameraStore } from '../cameraStore'
import { useFiguresStore } from '../figuresStore'

describe('cameraStore', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts in perspective with the default FOV and no bookmarks pending', () => {
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.fov).toBe(CAMERA_DEFAULTS.fov)
    expect(state.pendingCommand).toBeNull()
  })

  it('updates the FOV directly, without a pending command (reactive prop, not an imperative move)', () => {
    useCameraStore.getState().setFov(70)
    expect(useCameraStore.getState().fov).toBe(70)
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })

  it('applying a preset switches to orthographic projection and queues a "preset" command', () => {
    useCameraStore.getState().applyPreset('front')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'preset', preset: 'front' })
  })

  it('requesting perspective switches projection back and queues a "toPerspective" command', () => {
    useCameraStore.getState().applyPreset('top')
    useCameraStore.getState().requestPerspective()
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'toPerspective' })
  })

  it('applying a bookmark switches to its saved projection and queues an "applyBookmark" command', () => {
    const id = useFiguresStore.getState().addCameraBookmark({
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'orthographic',
      fov: 50,
      zoom: 80,
    })

    useCameraStore.getState().applyBookmark(id)
    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'applyBookmark', id })
  })

  it('applying an unknown bookmark id leaves projection untouched but still queues the command (CameraRig no-ops)', () => {
    useCameraStore.getState().applyBookmark('does-not-exist')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'applyBookmark', id: 'does-not-exist' })
  })

  it('requesting to save a bookmark queues a "requestSaveBookmark" command without touching projection', () => {
    useCameraStore.getState().requestSaveBookmark('Plano geral')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'requestSaveBookmark', name: 'Plano geral' })
  })

  it('clears the pending command once handled', () => {
    useCameraStore.getState().applyPreset('front')
    useCameraStore.getState().clearPendingCommand()
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })
})

/**
 * Lente em milímetros, enquadramento cinematográfico e movimento entre dois
 * pontos (DECISOES.md #46). O store guarda a INTENÇÃO; quem mexe na câmera
 * viva é o `CameraRig`.
 */
describe('cameraStore — lente, enquadramento e movimento', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const A = {
    position: [0, 1.5, 4] as [number, number, number],
    target: [0, 1.5, 0] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
    focalMm: 50,
  }

  it('a lente é a mesma coisa que o FOV, vista do outro lado', () => {
    useCameraStore.getState().setFocalLength(85)
    expect(useCameraStore.getState().focalMm).toBeCloseTo(85, 6)
    expect(useCameraStore.getState().fov).toBeCloseTo(focalLengthToFov(85), 6)

    // Mexer no FOV (bookmark antigo, por exemplo) reflete de volta na lente.
    useCameraStore.getState().setFov(focalLengthToFov(24))
    expect(useCameraStore.getState().focalMm).toBeCloseTo(24, 6)
  })

  it('a lente fica dentro da faixa aceita', () => {
    useCameraStore.getState().setFocalLength(9999)
    expect(useCameraStore.getState().focalMm).toBe(MAX_FOCAL_MM)
  })

  it('aplicar um plano guarda plano e ângulo e enfileira o comando', () => {
    useCameraStore.getState().applyShot('closeUp')
    expect(useCameraStore.getState().shot).toBe('closeUp')
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyShot' })
  })

  /**
   * O painel monta o enquadramento inteiro e só então compromete (#51): um
   * comando só, senão a câmera pularia a cada peça escolhida.
   */
  it('aplicar o enquadramento inteiro guarda tudo e enfileira um comando só', () => {
    useCameraStore.getState().applyFraming({
      shot: 'cowboy',
      angle: 'lowAngle',
      cameraHeight: null,
      orientation: 'profile',
      thirds: true,
      leadRoom: false,
    })

    const state = useCameraStore.getState()
    expect(state.shot).toBe('cowboy')
    expect(state.angle).toBe('lowAngle')
    expect(state.cameraHeight).toBeNull()
    expect(state.orientation).toBe('profile')
    expect(state.thirds).toBe(true)
    expect(state.leadRoom).toBe(false)
    expect(state.pendingCommand).toEqual({ type: 'applyShot' })
  })

  it('escolher uma altura de câmera apaga o ângulo em vigor, e vice-versa', () => {
    const base = {
      shot: 'medium',
      angle: 'lowAngle',
      orientation: null,
      thirds: false,
      leadRoom: false,
    } as const

    useCameraStore.getState().applyFraming({ ...base, cameraHeight: 'knee' })
    expect(useCameraStore.getState().cameraHeight).toBe('knee')

    useCameraStore.getState().applyFraming({ ...base, cameraHeight: null })
    expect(useCameraStore.getState().cameraHeight).toBeNull()
    expect(useCameraStore.getState().angle).toBe('lowAngle')
  })

  /** É o que torna a lente previsível: 85 mm e 24 mm dão o MESMO recorte, com distorção diferente. */
  it('trocar a lente com um plano ativo reenquadra sozinho', () => {
    useCameraStore.getState().applyShot('medium')
    useCameraStore.getState().clearPendingCommand()

    useCameraStore.getState().setFocalLength(85)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyShot' })
  })

  it('sem plano ativo, trocar a lente não move a câmera', () => {
    useCameraStore.getState().setFocalLength(85)
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })

  it('inclinar (holandês) enfileira a reaplicação do topo da tela', () => {
    useCameraStore.getState().setRoll(15)
    expect(useCameraStore.getState().rollDeg).toBe(15)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyRoll' })

    useCameraStore.getState().setRoll(999)
    expect(useCameraStore.getState().rollDeg).toBe(MAX_ROLL_DEG)
  })

  it('marcar A e B guarda os dois pontos e libera o slider', () => {
    expect(useCameraStore.getState().canPlayMove()).toBe(false)
    useCameraStore.getState().setMovePoint('a', A)
    expect(useCameraStore.getState().canPlayMove()).toBe(false)
    useCameraStore.getState().setMovePoint('b', { ...A, position: [0, 1.5, 2] })
    expect(useCameraStore.getState().canPlayMove()).toBe(true)
  })

  it('os atalhos de movimento geram B a partir de A', () => {
    useCameraStore.getState().setMovePoint('a', A)
    useCameraStore.getState().generateMove('zoomIn')
    const { moveA, moveB } = useCameraStore.getState()
    expect(moveA).toEqual(A)
    expect(moveB!.position[2]).toBeCloseTo(2, 6)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyMove' })
  })

  it('um atalho sem o ponto A marcado não faz nada — não há de onde sair', () => {
    useCameraStore.getState().generateMove('orbit')
    expect(useCameraStore.getState().moveB).toBeNull()
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })

  it('o slider enfileira a aplicação do estado interpolado', () => {
    useCameraStore.getState().setMovePoint('a', A)
    useCameraStore.getState().generateMove('zoomIn')
    useCameraStore.getState().clearPendingCommand()

    useCameraStore.getState().setMoveT(0.5)
    expect(useCameraStore.getState().moveT).toBe(0.5)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyMove' })
  })

  it('sem os dois pontos, o slider não move nada', () => {
    useCameraStore.getState().setMoveT(0.5)
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })
})
