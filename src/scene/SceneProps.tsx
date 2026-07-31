import { useEffect, useMemo, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { buildPropGeometry, controlPointPositions } from '../props/propGeometry'
import type { SceneProp } from '../props/sceneProp'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'
import { EDITOR_HIDDEN_FLAG } from './constants'

/**
 * Os OBJETOS DE CENA (item 42), renderizados **de dentro** do `<Canvas>` —
 * pelo mesmo motivo do `SceneFigures.tsx`: assinar as lojas aqui dentro é o
 * que permite ao exportador de vídeo commitar cada quadro de forma síncrona
 * (DECISOES.md #55).
 *
 * Aqui moram também os gizmos do objeto, e não no `Viewport`, seguindo o
 * `SceneCameraGizmo`: as alças de vértice precisam ser FILHAS do grupo que
 * carrega a colocação do objeto (é o que faz o `TransformControls` devolver
 * posição já no espaço local, sem conversão à mão), e separar a malha das
 * alças em dois arquivos só espalharia a mesma transformação por dois lugares.
 *
 * Nada aqui olha para a pré-visualização da animação: objeto de cena é
 * CENÁRIO ESTÁTICO (decisão do usuário) — não entra no retrato dos keyframes,
 * e por isso não muda enquanto a animação toca.
 */
export interface ScenePropsProps {
  /** Avisa o `Viewport` para suspender a órbita enquanto um gizmo é arrastado — mesmo contrato dos demais gizmos. */
  onDraggingChange?: (dragging: boolean) => void
}

export function SceneProps({ onDraggingChange }: ScenePropsProps) {
  const props = useFiguresStore((state) => state.props)
  const selectedPropId = useFiguresStore((state) => state.selectedPropId)

  return (
    <>
      {props.map((prop) => (
        <PropObject
          key={prop.id}
          prop={prop}
          selected={prop.id === selectedPropId}
          onDraggingChange={onDraggingChange}
        />
      ))}
    </>
  )
}

interface PropObjectProps {
  prop: SceneProp
  selected: boolean
  onDraggingChange?: (dragging: boolean) => void
}

/** Amarelo do destaque de seleção — o mesmo do `Figure.tsx`, e apagado na captura por `muteJointHighlight`. */
const HIGHLIGHT_COLOR = '#ffd54a'

function PropObject({ prop, selected, onDraggingChange }: PropObjectProps) {
  const selectProp = useFiguresStore((state) => state.selectProp)
  const mode = useUIStore((state) => state.propGizmoMode)
  const viewMode = useCameraStore((state) => state.viewMode)

  const [object, setObject] = useState<THREE.Mesh | null>(null)

  // Refeita só quando a FORMA da malha muda — mover ou girar o objeto é
  // transformação de nó e não custa geometria nova.
  const geometry = useMemo(
    () => buildPropGeometry(prop),
    [prop.shape, prop.size, prop.vertexOffsets], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Geometria é recurso de GPU: sem isto, cada arrasto de vértice deixaria a
  // anterior para trás (um arrasto emite dezenas de geometrias por segundo).
  useEffect(() => () => geometry.dispose(), [geometry])

  // "Oculto na bancada" vale só no modo de EDIÇÃO: no modo visão-câmera se
  // está conferindo o quadro, e o quadro tem o cenário. A marca de `userData` é
  // o que faz a captura reacendê-lo (ver `sceneCapture.revealEditorHidden`).
  const hiddenHere = prop.hiddenInEditor && viewMode === 'edit'
  const gizmoVisible = selected && !prop.locked && !hiddenHere

  return (
    <>
      <mesh
        ref={setObject}
        name={`prop-${prop.id}`}
        geometry={geometry}
        visible={prop.visible && !hiddenHere}
        userData={{ [EDITOR_HIDDEN_FLAG]: prop.visible && hiddenHere }}
        position={[...prop.position]}
        rotation={[
          THREE.MathUtils.degToRad(prop.rotation.x),
          THREE.MathUtils.degToRad(prop.rotation.y),
          THREE.MathUtils.degToRad(prop.rotation.z),
        ]}
        castShadow
        receiveShadow
        // Objeto TRAVADO não recebe o clique — é exatamente o que a trava
        // promete: não selecionar o cenário por engano ao posar. Sem handler, o
        // raycast do R3F simplesmente não tem o que chamar.
        onClick={
          prop.locked
            ? undefined
            : (event) => {
                event.stopPropagation()
                selectProp(prop.id)
              }
        }
      >
        <meshStandardMaterial
          color={prop.color}
          // O plano é uma folha sem espessura: sem os dois lados, ele
          // desaparece quando a câmera passa para trás dele.
          side={prop.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide}
          emissive={selected ? HIGHLIGHT_COLOR : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>

      {gizmoVisible && mode === 'vertex' && (
        <PropVertexHandles prop={prop} onDraggingChange={onDraggingChange} />
      )}
      {gizmoVisible && mode !== 'vertex' && object && (
        <PropTransformGizmo prop={prop} object={object} mode={mode} onDraggingChange={onDraggingChange} />
      )}
    </>
  )
}

interface PropTransformGizmoProps {
  prop: SceneProp
  object: THREE.Object3D
  mode: 'translate' | 'rotate' | 'scale'
  onDraggingChange?: (dragging: boolean) => void
}

/**
 * Mover, girar e **medir** o objeto.
 *
 * O modo `scale` é o único que não escreve o que o `TransformControls` produz:
 * ele produz um FATOR, e o modelo guarda METRO. A conversão acontece contra o
 * tamanho capturado no início do arrasto (`sizeAtDragStart`) — usar o tamanho
 * corrente daria composição a cada evento de mouse, e um arrasto curto
 * multiplicaria o objeto até o infinito.
 *
 * A escala do nó é devolvida a 1 ao soltar: a geometria já foi reconstruída no
 * tamanho novo (`buildPropGeometry`), então manter o fator no nó dobraria o
 * efeito. Durante o arrasto ela fica como o gizmo a deixou — é o mesmo
 * "snap-back ao soltar" do `JointDragGizmo`.
 */
function PropTransformGizmo({ prop, object, mode, onDraggingChange }: PropTransformGizmoProps) {
  const setPropPosition = useFiguresStore((state) => state.setPropPosition)
  const setPropRotation = useFiguresStore((state) => state.setPropRotation)
  const setPropSize = useFiguresStore((state) => state.setPropSize)

  const [sizeAtDragStart, setSizeAtDragStart] = useState(prop.size)

  const handleObjectChange = () => {
    if (mode === 'translate') {
      setPropPosition(prop.id, [object.position.x, object.position.y, object.position.z])
      return
    }

    if (mode === 'rotate') {
      setPropRotation(prop.id, {
        x: THREE.MathUtils.radToDeg(object.rotation.x),
        y: THREE.MathUtils.radToDeg(object.rotation.y),
        z: THREE.MathUtils.radToDeg(object.rotation.z),
      })
      return
    }

    setPropSize(prop.id, [
      sizeAtDragStart[0] * object.scale.x,
      sizeAtDragStart[1] * object.scale.y,
      sizeAtDragStart[2] * object.scale.z,
    ])
  }

  return (
    <TransformControls
      object={object}
      mode={mode}
      space="local"
      onObjectChange={handleObjectChange}
      onMouseDown={() => {
        setSizeAtDragStart(prop.size)
        onDraggingChange?.(true)
      }}
      onMouseUp={() => {
        object.scale.set(1, 1, 1)
        onDraggingChange?.(false)
      }}
    />
  )
}

/** Raio da bolinha VISÍVEL da alça, em metros — pequena de propósito, para não esconder a forma. */
const HANDLE_RADIUS_M = 0.03

/**
 * Raio do volume de CLIQUE, bem maior que o da bolinha (pedido do usuário: os
 * vértices estavam difíceis de acertar).
 *
 * São duas esferas porque as duas medidas querem coisas opostas: a visível
 * precisa ser pequena para não tapar o objeto que se está deformando, e o alvo
 * precisa ser grande para o mouse acertar. A de clique é uma esfera FILHA, com
 * material transparente em vez de `visible={false}` — objeto invisível é
 * ignorado pelo raycast, e aí o alvo maior não existiria. Como o evento do R3F
 * borbulha para o pai, o `onClick` continua sendo um só, na alça.
 *
 * Alvos vizinhos podem se sobrepor nas formas mais subdivididas (a esfera tem
 * 114 pontos), e isso é aceitável: o raycast entrega os alcançados em ordem de
 * distância e o `stopPropagation` fica com o PRIMEIRO — ou seja, com o vértice
 * mais próximo do cursor, que é o que se queria pegar.
 */
const HANDLE_PICK_RADIUS_M = 0.075

const HANDLE_COLOR = '#4fc3f7'
const HANDLE_SELECTED_COLOR = '#ffd54a'

/**
 * O "vértice livre": uma alça por ponto de controle, dentro do grupo que
 * carrega a colocação do objeto.
 *
 * As ALÇAS estarem dentro desse grupo é o truque que dispensa matemática: o
 * `TransformControls` arrasta no mundo, mas grava `position` no espaço do pai
 * — que é exatamente o espaço local em que `setPropVertex` espera receber o
 * ponto. Girar ou mover o objeto não muda uma linha desta conta.
 *
 * **O `TransformControls`, ao contrário, fica FORA do grupo** — e isso não é
 * organização, é correção de um bug real. O drei renderiza o próprio controle
 * como nó da árvore (`<primitive object={controls} />`), e o gizmo se coloca na
 * posição de MUNDO do objeto anexado. Dentro do grupo, essa posição de mundo
 * ainda era multiplicada pela matriz do grupo, e o gizmo aparecia deslocado do
 * vértice exatamente pela colocação do objeto. Fora dele o pai é a raiz da
 * cena, que é identidade — a mesma situação em que `SelectionGizmo` e
 * `JointDragGizmo` sempre estiveram, por serem renderizados no `Viewport`.
 *
 * As alças NÃO entram em `OVERLAY_NAMES` porque nunca chegam à captura: elas
 * só existem com o objeto selecionado e com a ferramenta de vértice ativa, e
 * a captura acontece com a cena como está.
 */
function PropVertexHandles({
  prop,
  onDraggingChange,
}: {
  prop: SceneProp
  onDraggingChange?: (dragging: boolean) => void
}) {
  const setPropVertex = useFiguresStore((state) => state.setPropVertex)

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [handle, setHandle] = useState<THREE.Mesh | null>(null)

  // Trocar de objeto (ou de forma) invalida o índice: o ponto 7 de um cubo não
  // é o ponto 7 de uma esfera. Ajustado DURANTE a renderização, e não num
  // efeito — é o padrão que o `FiguresPanel` já usa para estado derivado, e o
  // que evita o quadro intermediário com a alça errada acesa.
  const handleKey = `${prop.id}:${prop.shape}`
  const [lastHandleKey, setLastHandleKey] = useState(handleKey)
  if (handleKey !== lastHandleKey) {
    setLastHandleKey(handleKey)
    setActiveIndex(null)
  }

  const positions = useMemo(() => controlPointPositions(prop), [prop])

  return (
    <>
      <group
        position={[...prop.position]}
        rotation={[
          THREE.MathUtils.degToRad(prop.rotation.x),
          THREE.MathUtils.degToRad(prop.rotation.y),
          THREE.MathUtils.degToRad(prop.rotation.z),
        ]}
      >
        {positions.map((position, index) => (
          <mesh
            key={index}
            ref={index === activeIndex ? setHandle : undefined}
            position={[...position]}
            onClick={(event) => {
              event.stopPropagation()
              setActiveIndex(index)
            }}
          >
            <sphereGeometry args={[HANDLE_RADIUS_M, 8, 6]} />
            <meshBasicMaterial color={index === activeIndex ? HANDLE_SELECTED_COLOR : HANDLE_COLOR} />

            {/* O alvo de clique (ver `HANDLE_PICK_RADIUS_M`): invisível ao olho,
                presente para o raycast. `depthWrite` desligado para não recortar
                o que está atrás dele no buffer de profundidade. */}
            <mesh>
              <sphereGeometry args={[HANDLE_PICK_RADIUS_M, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </mesh>
        ))}
      </group>

      {/* FORA do grupo acima — ver o cabeçalho: dentro dele o gizmo aparecia
          deslocado do vértice pela colocação do objeto. A alça continua sendo
          filha do grupo, então `handle.position` segue em espaço local. */}
      {handle && activeIndex !== null && (
        <TransformControls
          object={handle}
          mode="translate"
          onObjectChange={() =>
            setPropVertex(prop.id, activeIndex, [handle.position.x, handle.position.y, handle.position.z])
          }
          onMouseDown={() => onDraggingChange?.(true)}
          onMouseUp={() => onDraggingChange?.(false)}
        />
      )}
    </>
  )
}
