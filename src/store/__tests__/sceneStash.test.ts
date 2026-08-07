import { beforeEach, describe, expect, it } from 'vitest'
import { useSceneStashStore, type StashedScene } from '../sceneStashStore'
import type { CameraViewState } from '../../scene/cameraMove'
import type { Figure } from '../figuresStore'

const camera = (focalMm: number): CameraViewState => ({
  position: [0, 1.6, 4],
  target: [0, 1, 0],
  up: [0, 1, 0],
  focalMm,
})

const cena = (nome: string, focalMm: number): StashedScene => ({
  figures: [{ name: nome }] as unknown as Figure[],
  camera: camera(focalMm),
  pristine: false,
})

/**
 * A guarda temporária da bancada (a caixa, sem quem a enche): um slot só, em
 * memória, que o "Ir para" enche e o botão de recuperar troca.
 */
describe('sceneStashStore', () => {
  beforeEach(() => {
    useSceneStashStore.setState(useSceneStashStore.getInitialState())
  })

  it('nasce vazia', () => {
    expect(useSceneStashStore.getState().stash).toBeNull()
  })

  it('guarda a cena que recebe', () => {
    useSceneStashStore.getState().stashScene(cena('antes', 35))

    expect(useSceneStashStore.getState().stash?.camera.focalMm).toBe(35)
  })

  /** Um slot só: o segundo "Ir para" sobrescreve o retrato do primeiro. */
  it('a guarda seguinte sobrescreve a anterior', () => {
    useSceneStashStore.getState().stashScene(cena('antes', 35))
    useSceneStashStore.getState().stashScene(cena('depois', 50))

    expect(useSceneStashStore.getState().stash?.camera.focalMm).toBe(50)
  })

  /**
   * Recuperar TROCA (decisão do usuário): devolve o que estava guardado e
   * guarda no lugar o que veio — é o que faz o botão alternar entre a cena que
   * se estava montando e o keyframe que se foi ver.
   */
  it('trocar devolve a guardada e guarda a que veio', () => {
    useSceneStashStore.getState().stashScene(cena('antes', 35))

    const devolvida = useSceneStashStore.getState().swapScene(cena('agora', 50))

    expect(devolvida?.camera.focalMm).toBe(35)
    expect(useSceneStashStore.getState().stash?.camera.focalMm).toBe(50)
  })

  /** Sem guarda não há troca: a bancada não pode ser substituída por nada. */
  it('trocar com a guarda vazia devolve null e não guarda nada', () => {
    const devolvida = useSceneStashStore.getState().swapScene(cena('agora', 50))

    expect(devolvida).toBeNull()
    expect(useSceneStashStore.getState().stash).toBeNull()
  })

  it('limpar esvazia a guarda', () => {
    useSceneStashStore.getState().stashScene(cena('antes', 35))
    useSceneStashStore.getState().clearStash()

    expect(useSceneStashStore.getState().stash).toBeNull()
  })
})
