import { useEffect, useMemo, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCameraStore } from '../store/cameraStore'
import { useUIStore } from '../store/uiStore'
import { applyFrameMaskFit, fitFrameRect, frameMaskResolution } from './frameMask'

/**
 * Metade de dentro do `<Canvas>` da máscara de enquadramento: mede a tela de
 * desenho, resolve o retângulo da saída escolhida e afasta a câmera para que o
 * quadro inteiro caiba nela. Sem visual próprio (`return null`) — quem pinta as
 * barras é o `FrameMaskOverlay`, que é DOM.
 *
 * A divisão existe porque as duas metades precisam do MESMO número: o tamanho
 * da tela de desenho. Aqui ele vem do R3F, que já observa o redimensionamento;
 * medir de novo lá fora com um segundo observador abriria a chance de as barras
 * e a câmera discordarem por um quadro (ou por um pixel).
 *
 * Como o `CameraRig`, o efeito real é imperativo sobre a câmera viva e não tem
 * teste automatizado — a matemática está coberta em `frameMask.ts`, e o
 * comportamento foi conferido no navegador.
 */
export interface FrameMaskCameraProps {
  controlsRef: RefObject<OrbitControlsImpl | null>
}

export function FrameMaskCamera({ controlsRef }: FrameMaskCameraProps) {
  const rawSource = useUIStore((state) => state.frameMaskSource)
  const viewMode = useCameraStore((state) => state.viewMode)
  const setFrameMaskRect = useUIStore((state) => state.setFrameMaskRect)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  // A máscara só existe no modo visão-câmera (fase 11): no modo edição o
  // viewport é bancada de trabalho, não o quadro da saída — ali um recorte
  // seria mentira.
  const source = viewMode === 'camera' ? rawSource : 'off'

  // Com a máscara desligada os lados ficam em zero, e `fitFrameRect` devolve
  // `null` — o mesmo caminho de "ainda não há retângulo".
  const resolution = frameMaskResolution(source)
  const outputWidth = resolution?.width ?? 0
  const outputHeight = resolution?.height ?? 0

  // Memorizado para que os efeitos abaixo só reajam a uma mudança de verdade:
  // um retângulo novo a cada render redesenharia a máscara e mexeria na câmera
  // sem motivo.
  const rect = useMemo(
    () => fitFrameRect(size.width, size.height, outputWidth, outputHeight),
    [size.width, size.height, outputWidth, outputHeight],
  )

  useEffect(() => {
    setFrameMaskRect(rect)
  }, [rect, setFrameMaskRect])

  // Sair de cena apaga a máscara: o retângulo é derivado desta tela de desenho.
  useEffect(() => () => useUIStore.getState().setFrameMaskRect(null), [])

  useEffect(() => {
    if (!rect) return
    if (!(camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera)) return
    // O restaurador é a limpeza do efeito: trocar de projeção (o `CameraRig`
    // mantém as duas câmeras vivas) devolve a câmera que sai ao estado dela.
    return applyFrameMaskFit(camera, size.width, size.height, rect.fit)
  }, [camera, rect, size.width, size.height])

  // Compensação do arrasto de deslocamento: o `OrbitControls` calcula quanto
  // andar a partir do `fov` e da altura do elemento, e não consulta o
  // deslocamento de vista — então, com a câmera afastada, a cena andaria `fit`
  // vezes MENOS que o cursor, e o ponto sob o mouse escorregaria. `panSpeed`
  // multiplica o delta em pixels antes dessa conta, então `1/fit` cancela o
  // afastamento exatamente. Girar e aproximar não precisam: um é em radianos
  // por pixel e o outro é um fator de escala, nenhum dos dois depende da
  // extensão do quadro.
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !rect) return
    controls.panSpeed = 1 / rect.fit
    return () => {
      controls.panSpeed = 1
    }
  }, [controlsRef, rect])

  return null
}
