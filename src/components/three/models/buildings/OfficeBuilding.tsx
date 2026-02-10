import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface OfficeBuildingProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  floors?: number
  width?: number
  depth?: number
  animated?: boolean
  label?: string
}

// Office Building - represents Company/Work
export const OfficeBuilding: React.FC<OfficeBuildingProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  floors = 6,
  width = 5,
  depth = 4,
  animated = false,
  label,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = VOXEL_COLORS.office
    const height = floors * 3

    // Base/Foundation with rounded corners
    for (let x = -1; x <= width; x++) {
      for (let z = -1; z <= depth; z++) {
        // Skip corners for rounded effect
        const isCorner = (x === -1 || x === width) && (z === -1 || z === depth)
        if (!isCorner) {
          result.push({ x, y: 0, z, color: colors.accent })
        }
      }
    }

    // Main building structure with rounded edges
    for (let y = 1; y <= height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          // Skip corners for rounded effect
          const isCorner = (x === 0 || x === width - 1) && (z === 0 || z === depth - 1)
          const isSurface =
            x === 0 || x === width - 1 ||
            z === 0 || z === depth - 1

          if (isSurface && !isCorner) {
            result.push({ x, y, z, color: colors.base })
          }
        }
      }
      // Top floor
      if (y === height) {
        for (let x = 0; x < width; x++) {
          for (let z = 0; z < depth; z++) {
            result.push({ x, y, z, color: colors.base })
          }
        }
      }
    }

    // Windows - pattern on each floor with cute frames
    for (let floor = 0; floor < floors; floor++) {
      const floorY = floor * 3 + 2

      // Front windows with alternating colors
      for (let x = 1; x < width - 1; x++) {
        const isLit = Math.random() > 0.4
        const windowColor = isLit ? colors.windowLit : colors.window
        result.push({ x, y: floorY, z: depth, color: windowColor })
        result.push({ x, y: floorY + 1, z: depth, color: windowColor })
      }

      // Back windows
      for (let x = 1; x < width - 1; x++) {
        const isLit = Math.random() > 0.4
        const windowColor = isLit ? colors.windowLit : colors.window
        result.push({ x, y: floorY, z: -1, color: windowColor })
        result.push({ x, y: floorY + 1, z: -1, color: windowColor })
      }

      // Side windows
      for (let z = 1; z < depth - 1; z++) {
        const isLit = Math.random() > 0.4
        const windowColor = isLit ? colors.windowLit : colors.window
        result.push({ x: -1, y: floorY, z, color: windowColor })
        result.push({ x: width, y: floorY, z, color: windowColor })
      }
    }

    // Cute roof with dome shape
    const roofY = height + 1
    // Dome layers
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        result.push({ x, y: roofY, z, color: '#fda4af' }) // Coral pink roof
      }
    }
    // Second layer (smaller)
    for (let x = 1; x < width - 1; x++) {
      for (let z = 1; z < depth - 1; z++) {
        result.push({ x, y: roofY + 1, z, color: '#fda4af' })
      }
    }

    // Heart decoration on roof
    const centerX = Math.floor(width / 2)
    const centerZ = Math.floor(depth / 2)
    result.push({ x: centerX, y: roofY + 2, z: centerZ, color: '#fb7185' }) // Heart center
    result.push({ x: centerX - 1, y: roofY + 2, z: centerZ, color: '#fb7185' })
    result.push({ x: centerX + 1, y: roofY + 2, z: centerZ, color: '#fb7185' })
    result.push({ x: centerX, y: roofY + 3, z: centerZ, color: '#fb7185' })

    // Star decorations on corners
    result.push({ x: 0, y: roofY + 2, z: 0, color: '#fef08a' }) // Yellow stars
    result.push({ x: width - 1, y: roofY + 2, z: 0, color: '#fef08a' })
    result.push({ x: 0, y: roofY + 2, z: depth - 1, color: '#fef08a' })
    result.push({ x: width - 1, y: roofY + 2, z: depth - 1, color: '#fef08a' })

    // Cute entrance with awning
    const doorX = Math.floor(width / 2)
    result.push({ x: doorX, y: 1, z: depth, color: '#f9a8d4' }) // Pink door
    result.push({ x: doorX, y: 2, z: depth, color: '#f9a8d4' })
    // Awning above door
    result.push({ x: doorX - 1, y: 3, z: depth + 1, color: '#c4b5fd' })
    result.push({ x: doorX, y: 3, z: depth + 1, color: '#c4b5fd' })
    result.push({ x: doorX + 1, y: 3, z: depth + 1, color: '#c4b5fd' })

    // Flower boxes at base
    result.push({ x: -1, y: 1, z: 1, color: '#86efac' }) // Green base
    result.push({ x: -1, y: 2, z: 1, color: '#fb7185' }) // Pink flower
    result.push({ x: width, y: 1, z: 1, color: '#86efac' })
    result.push({ x: width, y: 2, z: 1, color: '#fef08a' }) // Yellow flower

    return result
  }, [floors, width, depth])

  useFrame((state) => {
    if (!animated || !groupRef.current) return
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.05
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.25} castShadow receiveShadow />
      {label && (
        <mesh position={[width * 0.25, floors * 1.5 + 2, depth * 0.25 + 0.5]}>
          <planeGeometry args={[2, 0.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}
