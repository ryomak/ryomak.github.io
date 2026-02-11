import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { type VoxelPosition } from './VoxelUtils'

interface VoxelProps {
  position: [number, number, number]
  color: string
  size?: number
  radius?: number
}

// Single voxel component with rounded corners for cute look
export const Voxel: React.FC<VoxelProps> = ({
  position,
  color,
  size = 1,
  radius = 0.1,
}) => {
  return (
    <RoundedBox
      position={position}
      args={[size, size, size]}
      radius={radius * size}
      smoothness={2}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.1}
      />
    </RoundedBox>
  )
}

interface InstancedVoxelsProps {
  voxels: VoxelPosition[]
  size?: number
  basePosition?: [number, number, number]
}

// Instanced voxels for better performance
export const InstancedVoxels: React.FC<InstancedVoxelsProps> = ({
  voxels,
  size = 1,
  basePosition = [0, 0, 0],
}) => {
  const { geometry, colorArray, matrices } = useMemo(() => {
    const geo = new THREE.BoxGeometry(size, size, size)
    const colors: number[] = []
    const mats: THREE.Matrix4[] = []
    const tempColor = new THREE.Color()
    const tempMatrix = new THREE.Matrix4()

    voxels.forEach((voxel) => {
      tempColor.set(voxel.color ?? '#ffffff')
      colors.push(tempColor.r, tempColor.g, tempColor.b)

      tempMatrix.setPosition(
        voxel.x * size + basePosition[0],
        voxel.y * size + basePosition[1],
        voxel.z * size + basePosition[2]
      )
      mats.push(tempMatrix.clone())
    })

    return {
      geometry: geo,
      colorArray: new Float32Array(colors),
      matrices: mats,
    }
  }, [voxels, size, basePosition])

  return (
    <instancedMesh
      args={[geometry, undefined, voxels.length]}
      frustumCulled
    >
      <boxGeometry args={[size, size, size]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colorArray, 3]}
        />
      </boxGeometry>
      <meshStandardMaterial vertexColors />
      {matrices.map((matrix, i) => (
        <primitive
          key={i}
          object={(() => {
            const mesh = new THREE.Object3D()
            mesh.applyMatrix4(matrix)
            return mesh
          })()}
        />
      ))}
    </instancedMesh>
  )
}

interface VoxelGroupProps {
  voxels: VoxelPosition[]
  size?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
}

// Group of voxels with shared material per color
export const VoxelGroup: React.FC<VoxelGroupProps> = ({
  voxels,
  size = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  castShadow = false,
  receiveShadow = false,
}) => {
  const groupedByColor = useMemo(() => {
    const groups: Record<string, VoxelPosition[]> = {}
    voxels.forEach((voxel) => {
      const color = voxel.color ?? '#ffffff'
      if (!groups[color]) {
        groups[color] = []
      }
      groups[color].push(voxel)
    })
    return groups
  }, [voxels])

  return (
    <group position={position} rotation={rotation}>
      {Object.entries(groupedByColor).map(([color, colorVoxels]) => (
        <ColoredVoxelBatch
          key={color}
          voxels={colorVoxels}
          color={color}
          size={size}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      ))}
    </group>
  )
}

interface ColoredVoxelBatchProps {
  voxels: VoxelPosition[]
  color: string
  size: number
  castShadow: boolean
  receiveShadow: boolean
}

// Batch of voxels with same color using instancing - cute rounded style
const ColoredVoxelBatch: React.FC<ColoredVoxelBatchProps> = ({
  voxels,
  color,
  size,
  castShadow,
  receiveShadow,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tempObject = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!meshRef.current) return
    voxels.forEach((voxel, i) => {
      tempObject.position.set(
        voxel.x * size,
        voxel.y * size,
        voxel.z * size
      )
      tempObject.updateMatrix()
      meshRef.current!.setMatrixAt(i, tempObject.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [voxels, size, tempObject])

  const count = voxels.length

  // Create rounded box geometry for cute appearance
  const geometry = useMemo(() => {
    const voxelSize = size * 0.95
    const geo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize, 2, 2, 2)
    // Apply slight edge softening by scaling vertices near edges
    const positions = geo.attributes.position
    const vertex = new THREE.Vector3()
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i)
      const halfSize = voxelSize / 2
      const edgeSoftness = 0.15
      // Soften corners
      const distFromCenter = vertex.length()
      const maxDist = Math.sqrt(3) * halfSize
      if (distFromCenter > halfSize * 1.2) {
        const scale = 1 - (distFromCenter / maxDist) * edgeSoftness
        vertex.multiplyScalar(scale)
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z)
      }
    }
    geo.computeVertexNormals()
    return geo
  }, [size])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.05}
      />
    </instancedMesh>
  )
}
