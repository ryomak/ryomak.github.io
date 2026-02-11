import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface HomeBuildingProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  hasGarden?: boolean
  animated?: boolean
}

// Home Building - represents About/Personal
export const HomeBuilding: React.FC<HomeBuildingProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  hasGarden = true,
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const chimneyRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = VOXEL_COLORS.home
    const width = 4
    const depth = 4
    const height = 3

    // Ground/Garden with cute pastel colors
    if (hasGarden) {
      for (let x = -2; x <= width + 1; x++) {
        for (let z = -2; z <= depth + 1; z++) {
          result.push({ x, y: 0, z, color: '#bbf7d0' }) // Mint green grass
        }
      }
      // Garden path - cute cream colored stones
      for (let z = depth; z <= depth + 2; z++) {
        result.push({ x: Math.floor(width / 2), y: 0, z, color: '#fef3c7' })
        result.push({ x: Math.floor(width / 2) - 1, y: 0, z, color: '#fef3c7' })
      }
    }

    // Foundation - warm beige
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        result.push({ x, y: 0, z, color: '#d6b498' })
      }
    }

    // Main house walls
    for (let y = 1; y <= height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          const isSurface =
            x === 0 || x === width - 1 ||
            z === 0 || z === depth - 1

          if (isSurface) {
            result.push({ x, y, z, color: colors.base })
          }
        }
      }
    }

    // Roof (triangular/peaked)
    for (let layer = 0; layer <= 2; layer++) {
      const roofY = height + 1 + layer
      const shrinkX = layer
      const shrinkZ = 0

      for (let x = shrinkX; x < width - shrinkX; x++) {
        for (let z = shrinkZ; z < depth - shrinkZ; z++) {
          if (layer === 2) {
            // Peak - only center
            if (x === Math.floor(width / 2) || x === Math.floor(width / 2) - 1) {
              result.push({ x, y: roofY, z, color: colors.roof })
            }
          } else {
            result.push({ x, y: roofY, z, color: colors.roof })
          }
        }
      }
    }

    // Front door
    const doorX = Math.floor(width / 2)
    result.push({ x: doorX, y: 1, z: depth, color: colors.door })
    result.push({ x: doorX, y: 2, z: depth, color: colors.door })

    // Windows
    // Front window (beside door)
    result.push({ x: doorX - 2, y: 2, z: depth, color: colors.window })
    result.push({ x: doorX + 1, y: 2, z: depth, color: colors.window })

    // Side windows
    result.push({ x: -1, y: 2, z: Math.floor(depth / 2), color: colors.window })
    result.push({ x: width, y: 2, z: Math.floor(depth / 2), color: colors.window })

    // Cute chimney - coral pink
    const chimneyX = width - 1
    for (let y = height + 2; y <= height + 4; y++) {
      result.push({ x: chimneyX, y, z: 1, color: '#fda4af' })
    }
    // Heart on top of chimney
    result.push({ x: chimneyX, y: height + 5, z: 1, color: '#fb7185' })

    // Cute mailbox - pink
    if (hasGarden) {
      result.push({ x: -1, y: 1, z: depth + 1, color: '#f9a8d4' })
      result.push({ x: -1, y: 2, z: depth + 1, color: '#fda4af' }) // Flag
    }

    // Cute garden decorations
    if (hasGarden) {
      // Flower pots with pastel flowers
      result.push({ x: -1, y: 1, z: 0, color: '#86efac' }) // Green pot
      result.push({ x: -1, y: 2, z: 0, color: '#f9a8d4' }) // Pink flower

      result.push({ x: width, y: 1, z: 0, color: '#86efac' })
      result.push({ x: width, y: 2, z: 0, color: '#fef08a' }) // Yellow flower

      result.push({ x: -1, y: 1, z: depth - 1, color: '#86efac' })
      result.push({ x: -1, y: 2, z: depth - 1, color: '#c4b5fd' }) // Lavender flower

      result.push({ x: width, y: 1, z: depth - 1, color: '#86efac' })
      result.push({ x: width, y: 2, z: depth - 1, color: '#7dd3fc' }) // Blue flower

      // Tiny fence around garden
      for (let x = -2; x <= width + 1; x++) {
        result.push({ x, y: 1, z: -2, color: '#fef3c7' })
        result.push({ x, y: 1, z: depth + 2, color: '#fef3c7' })
      }
      for (let z = -1; z <= depth + 1; z++) {
        result.push({ x: -2, y: 1, z, color: '#fef3c7' })
        result.push({ x: width + 1, y: 1, z, color: '#fef3c7' })
      }

      // Heart decoration on roof
      const centerX = Math.floor(width / 2)
      result.push({ x: centerX, y: height + 4, z: 2, color: '#fb7185' })

      // Stars on corners
      result.push({ x: 0, y: height + 3, z: 0, color: '#fef08a' })
      result.push({ x: width - 1, y: height + 3, z: 0, color: '#fef08a' })
    }

    return result
  }, [hasGarden])

  useFrame((state) => {
    if (!animated) return

    // Smoke effect from chimney (subtle scale pulsing)
    if (chimneyRef.current) {
      chimneyRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02
    }

    // Gentle sway
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.01
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.25} castShadow receiveShadow />
      {/* Warm light from windows */}
      <pointLight
        position={[1, 1.5, 2.5]}
        color="#FFE4B5"
        intensity={0.3}
        distance={3}
      />
      {/* Chimney smoke particles placeholder */}
      <group ref={chimneyRef} position={[1.75, 3.5, 0.5]}>
        <mesh>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#A9A9A9" transparent opacity={0.3} />
        </mesh>
      </group>
    </group>
  )
}
