import * as THREE from 'three'
import { getJointChildren } from '../figure/skeleton'
import { buildJointFrames } from '../figure/jointFrames'
import type { Figure } from '../store/figuresStore'

/**
 * Constrói, sem depender de React/`@react-three/fiber`, a mesma hierarquia
 * de `Group`s do `skeleton.ts` (posição/rotação local por junta, via
 * `jointFrames.ts`) usada por `Figure.tsx`, só que com geometria simples
 * (esfera por junta + cilindro por osso) em vez do visual "manequim
 * torneado" completo — o bastante para servir de referência de layout/pose
 * ao abrir no Blender (ver PLANO.md > "Persistência"). Usado por
 * `gltfIO`/exportação de cena, sem precisar montar o `<Canvas>` — por isso é
 * 100% testável sem WebGL.
 *
 * Nomes de nó usam `_` como separador (nunca `.`, `:`, `/`, `[`, `]`): o
 * `GLTFLoader` sanitiza esses caracteres ao reimportar (`PropertyBinding.
 * sanitizeNodeName`, removidos, não substituídos), então um nome como
 * `figure-1.shoulder.L` viraria `figure-1shoulderL` — quebrando qualquer
 * busca por nome depois de um round-trip (ver DECISOES.md #11).
 */

const JOINT_MARKER_RADIUS = 0.03
const BONE_RADIUS = 0.015

function sanitizeNamePart(value: string): string {
  return value.replace(/\./g, '_')
}

function buildBone(to: readonly [number, number, number], color: string): THREE.Mesh {
  const target = new THREE.Vector3(...to)
  const length = target.length()
  const geometry = new THREE.CylinderGeometry(BONE_RADIUS, BONE_RADIUS, Math.max(length, 0.001), 6)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }))
  mesh.position.copy(target).multiplyScalar(0.5)
  if (length > 1e-6) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.clone().normalize())
  }
  return mesh
}

/** Monta a hierarquia completa de um boneco (grupo externo escalado/posicionado + juntas) com geometria de referência. */
export function buildFigureObject3D(figure: Figure): THREE.Group {
  const { outer, joints } = buildJointFrames(figure)
  outer.name = `figure_${sanitizeNamePart(figure.id)}`
  outer.visible = figure.visible

  for (const [jointName, group] of joints) {
    const sanitizedName = `${sanitizeNamePart(figure.id)}_${sanitizeNamePart(jointName)}`
    group.name = sanitizedName

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(JOINT_MARKER_RADIUS, 8, 6),
      new THREE.MeshStandardMaterial({ color: figure.color }),
    )
    marker.name = `${sanitizedName}_joint`
    group.add(marker)

    for (const child of getJointChildren(jointName)) {
      const bone = buildBone(child.position, figure.color)
      bone.name = `${sanitizedName}_bone_${sanitizeNamePart(child.name)}`
      group.add(bone)
    }
  }

  return outer
}
