import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Figure } from '../store/figuresStore'
import {
  GESTURE_ACTION_COLOR,
  GESTURE_LINE_RADIUS_M,
  GESTURE_TRANSVERSE_COLOR,
  OVERLAY_NAMES,
} from './constants'
import { buildGestureLines, type GestureSegment } from './gestureLines'

/**
 * As linhas de gesto sobre o boneco selecionado (PLANO.md item 9). O cálculo
 * mora no `gestureLines.ts`, puro e testado sem Canvas; aqui é só a malha.
 *
 * **Tubos, não `lineSegments`.** `lineBasicMaterial` ignora espessura em WebGL
 * — sai sempre com 1 px, e uma linha de ação de um pixel some por cima do
 * boneco. É o mesmo motivo pelo qual a régua vertical (`VerticalRuler`) é feita
 * de cilindros e caixas.
 *
 * **`depthTest={false}` e `renderOrder`**, também como a régua: a linha existe
 * para ser lida POR CIMA do corpo. Enterrada no volume ela não serviria para
 * nada — e a linha de ação atravessa o tronco por definição.
 *
 * O sufixo `Overlay` no nome não é enfeite: o módulo puro ao lado chama-se
 * `gestureLines.ts`, e no Windows o sistema de arquivos é INSENSÍVEL a caixa —
 * um `GestureLines.tsx` faria `import … from './GestureLines'` resolver para o
 * módulo puro, que não exporta componente nenhum. Mesmo par do `frameMask.ts` /
 * `FrameMaskOverlay.tsx` (`DECISOES.md` #122).
 */
interface GestureLinesOverlayProps {
  figure: Figure | null
}

export function GestureLinesOverlay({ figure }: GestureLinesOverlayProps) {
  const lines = useMemo(() => buildGestureLines(figure), [figure])

  const actionGeometry = useMemo(() => {
    if (!lines) return null
    // Curva, e não duas retas: a quebra na pelve é justamente o que a linha de
    // ação mostra. `CatmullRomCurve3` com os três pontos de controle dá o arco
    // que quem desenha traçaria à mão.
    const curve = new THREE.CatmullRomCurve3(
      lines.action.map((point) => new THREE.Vector3(...point)),
    )
    return new THREE.TubeGeometry(curve, 32, GESTURE_LINE_RADIUS_M, 6, false)
  }, [lines])

  const transverseGeometries = useMemo(() => {
    if (!lines) return null
    const tube = (segment: GestureSegment) =>
      new THREE.TubeGeometry(
        new THREE.LineCurve3(new THREE.Vector3(...segment[0]), new THREE.Vector3(...segment[1])),
        1,
        GESTURE_LINE_RADIUS_M,
        6,
        false,
      )
    return { shoulders: tube(lines.shoulders), hips: tube(lines.hips) }
  }, [lines])

  // Geometria é recurso de GPU: o coletor de lixo não a devolve, e os três
  // tubos são refeitos a CADA pose nova — num arrasto de gizmo, dezenas por
  // segundo. Sem isto, cada uma delas ficava para trás. Mesma proteção (e mesma
  // razão) do objeto de cena em `SceneProps.tsx`.
  useEffect(
    () => () => {
      actionGeometry?.dispose()
      transverseGeometries?.shoulders.dispose()
      transverseGeometries?.hips.dispose()
    },
    [actionGeometry, transverseGeometries],
  )

  if (!actionGeometry || !transverseGeometries) return null

  return (
    <group name={OVERLAY_NAMES.gestureLines} renderOrder={2}>
      <mesh geometry={actionGeometry}>
        <meshBasicMaterial color={GESTURE_ACTION_COLOR} depthTest={false} />
      </mesh>
      <mesh geometry={transverseGeometries.shoulders}>
        <meshBasicMaterial color={GESTURE_TRANSVERSE_COLOR} depthTest={false} />
      </mesh>
      <mesh geometry={transverseGeometries.hips}>
        <meshBasicMaterial color={GESTURE_TRANSVERSE_COLOR} depthTest={false} />
      </mesh>
    </group>
  )
}
