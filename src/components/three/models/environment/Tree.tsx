import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface TreeProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  variant?: 'oak' | 'pine' | 'sakura' | 'small'
  animated?: boolean
}

// Voxel Tree
export const Tree: React.FC<TreeProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  variant = 'oak',
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const trunkColor = VOXEL_COLORS.tree.trunk
    const leafColor = variant === 'sakura' ? '#FFB7C5' : VOXEL_COLORS.tree.leaves

    switch (variant) {
      case 'oak': {
        // Trunk
        for (let y = 0; y < 4; y++) {
          result.push({ x: 0, y, z: 0, color: trunkColor })
          result.push({ x: 1, y, z: 0, color: trunkColor })
          result.push({ x: 0, y, z: 1, color: trunkColor })
          result.push({ x: 1, y, z: 1, color: trunkColor })
        }

        // Leaves - layered spherical shape
        const leafLayers = [
          { y: 4, radius: 3, offset: -1 },
          { y: 5, radius: 3, offset: -1 },
          { y: 6, radius: 2, offset: 0 },
          { y: 7, radius: 2, offset: 0 },
          { y: 8, radius: 1, offset: 0 },
        ]

        leafLayers.forEach(layer => {
          for (let x = -layer.radius; x <= layer.radius; x++) {
            for (let z = -layer.radius; z <= layer.radius; z++) {
              const dist = Math.sqrt(x * x + z * z)
              if (dist <= layer.radius) {
                result.push({
                  x: x + layer.offset,
                  y: layer.y,
                  z: z + layer.offset,
                  color: leafColor,
                })
              }
            }
          }
        })
        break
      }

      case 'pine': {
        // Trunk
        for (let y = 0; y < 3; y++) {
          result.push({ x: 0, y, z: 0, color: trunkColor })
        }

        // Conical leaves
        const pineLayers = [
          { y: 3, radius: 3 },
          { y: 4, radius: 3 },
          { y: 5, radius: 2 },
          { y: 6, radius: 2 },
          { y: 7, radius: 1 },
          { y: 8, radius: 1 },
          { y: 9, radius: 0 },
        ]

        pineLayers.forEach(layer => {
          for (let x = -layer.radius; x <= layer.radius; x++) {
            for (let z = -layer.radius; z <= layer.radius; z++) {
              const dist = Math.abs(x) + Math.abs(z)
              if (dist <= layer.radius) {
                result.push({
                  x,
                  y: layer.y,
                  z,
                  color: '#1B4D3E', // Darker green for pine
                })
              }
            }
          }
        })
        break
      }

      case 'sakura': {
        // Trunk with branches
        for (let y = 0; y < 3; y++) {
          result.push({ x: 0, y, z: 0, color: trunkColor })
        }
        result.push({ x: -1, y: 3, z: 0, color: trunkColor })
        result.push({ x: 1, y: 3, z: 0, color: trunkColor })
        result.push({ x: 0, y: 3, z: -1, color: trunkColor })
        result.push({ x: 0, y: 3, z: 1, color: trunkColor })

        // Cherry blossom clusters
        const blossomPositions = [
          { x: -2, y: 4, z: 0 },
          { x: 2, y: 4, z: 0 },
          { x: 0, y: 4, z: -2 },
          { x: 0, y: 4, z: 2 },
          { x: 0, y: 5, z: 0 },
          { x: -1, y: 5, z: -1 },
          { x: 1, y: 5, z: 1 },
        ]

        blossomPositions.forEach(pos => {
          // Each cluster
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.random() > 0.3) {
                result.push({
                  x: pos.x + dx,
                  y: pos.y,
                  z: pos.z + dz,
                  color: Math.random() > 0.5 ? '#FFB7C5' : '#FFC0CB',
                })
              }
            }
          }
        })
        break
      }

      case 'small': {
        // Small shrub/bush
        result.push({ x: 0, y: 0, z: 0, color: trunkColor })
        result.push({ x: 0, y: 1, z: 0, color: trunkColor })

        // Small leaf cluster
        for (let x = -1; x <= 1; x++) {
          for (let z = -1; z <= 1; z++) {
            result.push({ x, y: 2, z, color: leafColor })
          }
        }
        result.push({ x: 0, y: 3, z: 0, color: leafColor })
        break
      }
    }

    return result
  }, [variant])

  useFrame((state) => {
    if (!animated || !groupRef.current) return
    // Gentle swaying
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.3) * 0.01
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.5} castShadow receiveShadow />
    </group>
  )
}

interface TreeClusterProps {
  position?: [number, number, number]
  count?: number
  spread?: number
  variants?: Array<'oak' | 'pine' | 'sakura' | 'small'>
}

// Cluster of trees
export const TreeCluster: React.FC<TreeClusterProps> = ({
  position = [0, 0, 0],
  count = 5,
  spread = 4,
  variants = ['oak', 'pine', 'small'],
}) => {
  const trees = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * spread * 2,
        0,
        (Math.random() - 0.5) * spread * 2,
      ] as [number, number, number],
      rotation: [0, Math.random() * Math.PI * 2, 0] as [number, number, number],
      scale: 0.8 + Math.random() * 0.4,
      variant: variants[Math.floor(Math.random() * variants.length)],
    }))
  }, [count, spread, variants])

  return (
    <group position={position}>
      {trees.map((tree, i) => (
        <Tree
          key={i}
          position={tree.position}
          rotation={tree.rotation}
          scale={tree.scale}
          variant={tree.variant}
          animated
        />
      ))}
    </group>
  )
}
