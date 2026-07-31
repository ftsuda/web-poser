import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useDepthStore } from '../store/depthStore'
import {
  DEFAULT_DEPTH_RANGE,
  applyDepthMaterials,
  createDepthMaterials,
  disposeDepthMaterials,
  resolveDepthRange,
  restoreDepthMaterials,
  updateDepthMaterials,
} from './depthMap'

/**
 * A visualização de profundidade **na tela** (fase 13), no molde do
 * `CameraRig`/`SnapshotCapture`: componente sem visual (`return null`) dentro
 * do `<Canvas>`, porque o que ele faz depende da árvore viva de `Object3D`.
 *
 * Vale sempre que estiver ligada — posando, navegando pela linha do tempo ou
 * com a animação tocando (decisão do usuário) —, e é SÓ a vista: o que sai no
 * PNG e no MP4 é escolha própria de cada painel, e a captura força o seu modo
 * independentemente do que estiver na tela (ver `depthMap.suspendDepthMaterial`).
 *
 * **O fundo não é daqui.** Quem o define é o `Viewport`, por React — dois donos
 * para a mesma propriedade deixariam a vista presa no preto ao desligar o modo,
 * porque a ordem entre o commit do R3F e a limpeza do efeito não está sob nosso
 * controle. Aqui ficam só o material e a elipse de contato.
 *
 * Sem teste automatizado, como os outros habitantes do canvas; a lógica que dá
 * para testar sem GPU está em `depthMap.ts`, e está.
 */
export function DepthPreview() {
  const enabled = useDepthStore((state) => state.previewEnabled)
  const scene = useThree((state) => state.scene)
  const getThree = useThree((state) => state.get)

  const groundMode = useDepthStore((state) => state.groundMode)

  // Um par de materiais para a sessão inteira: cada `ShaderMaterial` novo
  // custaria uma compilação de shader, e a faixa muda por uniforme, não por
  // material.
  const materials = useMemo(() => createDepthMaterials(DEFAULT_DEPTH_RANGE), [])
  useEffect(() => () => disposeDepthMaterials(materials), [materials])

  useEffect(() => {
    if (!enabled) return undefined
    return () => restoreDepthMaterials(scene)
  }, [enabled, scene])

  // Reaplicar A CADA QUADRO, e não uma vez ao ligar: a árvore muda por baixo
  // (boneco novo, objeto novo, troca de casca), e o `applyDepthMaterials` é
  // idempotente justamente para isto — a marca de `userData` guarda o material
  // original na primeira passada e as seguintes não a sobrescrevem.
  //
  // A faixa automática se remede junto: é o que faz a vista acompanhar o boneco
  // andando e a câmera se aproximando.
  useFrame(() => {
    if (!enabled) return
    updateDepthMaterials(
      materials,
      resolveDepthRange(scene, getThree().camera, useDepthStore.getState()),
    )
    applyDepthMaterials(scene, materials, groundMode)
  })

  return null
}
