import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface ShopBuildingProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  shopType?: 'general' | 'tech' | 'cafe'
  animated?: boolean
}

// Shop Building - represents Skills/Tools
export const ShopBuilding: React.FC<ShopBuildingProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  shopType = 'general',
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = VOXEL_COLORS.shop
    const width = 4
    const depth = 3
    const height = 4

    // Foundation with rounded corners
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        result.push({ x, y: 0, z, color: '#f5f5f4' }) // Light stone color
      }
    }

    // Walls with rounded edges
    for (let y = 1; y <= height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          const isCorner = (x === 0 || x === width - 1) && (z === 0 || z === depth - 1)
          const isSurface =
            x === 0 || x === width - 1 ||
            z === 0 || z === depth - 1

          if (isSurface && !isCorner) {
            result.push({ x, y, z, color: colors.base })
          }
        }
      }
    }

    // Cute dome roof with layers
    for (let layer = 0; layer < 3; layer++) {
      const roofY = height + 1 + layer
      const shrink = layer
      for (let x = shrink; x < width - shrink; x++) {
        for (let z = shrink; z < depth - shrink; z++) {
          if (layer < 2 || (x === 1 && z === 1)) { // Top has just center
            result.push({ x, y: roofY, z, color: colors.roof })
          }
        }
      }
    }

    // Shop front - Large display window with cute frame
    result.push({ x: 0, y: 1, z: depth, color: '#fef08a' }) // Yellow frame
    result.push({ x: 0, y: 2, z: depth, color: '#fef08a' })
    result.push({ x: 0, y: 3, z: depth, color: '#fef08a' })
    result.push({ x: width - 1, y: 1, z: depth, color: '#fef08a' })
    result.push({ x: width - 1, y: 2, z: depth, color: '#fef08a' })
    result.push({ x: width - 1, y: 3, z: depth, color: '#fef08a' })

    for (let x = 1; x < width - 1; x++) {
      result.push({ x, y: 1, z: depth, color: colors.window })
      result.push({ x, y: 2, z: depth, color: colors.window })
    }

    // Cute door with heart
    const doorX = Math.floor(width / 2)
    result.push({ x: doorX, y: 1, z: depth, color: '#f9a8d4' }) // Pink door
    result.push({ x: doorX, y: 2, z: depth, color: '#f9a8d4' })

    // Cute sign with star above entrance
    for (let x = 0; x < width; x++) {
      result.push({ x, y: 3, z: depth, color: colors.sign })
    }
    // Star on top of sign
    result.push({ x: Math.floor(width / 2), y: 4, z: depth, color: '#fef08a' })

    // Striped awning (alternating colors)
    for (let x = -1; x <= width; x++) {
      const stripeColor = x % 2 === 0 ? '#fda4af' : '#fef3c7'
      result.push({ x, y: 3, z: depth + 1, color: stripeColor })
    }

    // Flower decorations on sides
    result.push({ x: -1, y: 1, z: 0, color: '#86efac' }) // Stem
    result.push({ x: -1, y: 2, z: 0, color: '#fb7185' }) // Pink flower
    result.push({ x: width, y: 1, z: 0, color: '#86efac' })
    result.push({ x: width, y: 2, z: 0, color: '#c4b5fd' }) // Purple flower

    // Shop items display (based on type)
    if (shopType === 'tech') {
      // Cute computer displays
      result.push({ x: 1, y: 1, z: depth - 1, color: VOXEL_COLORS.typescript })
      result.push({ x: 2, y: 1, z: depth - 1, color: VOXEL_COLORS.react })
      // Heart decoration
      result.push({ x: 1, y: 2, z: depth - 1, color: '#fb7185' })
    } else if (shopType === 'cafe') {
      // Cute coffee cup
      result.push({ x: 1, y: 1, z: depth - 1, color: '#fef3c7' }) // Cup
      result.push({ x: 2, y: 1, z: depth - 1, color: '#fda4af' }) // Heart latte art
    }

    // Candy/lollipop decorations at entrance
    result.push({ x: -1, y: 1, z: depth, color: '#d4d4d8' }) // Stick
    result.push({ x: -1, y: 2, z: depth, color: '#fb7185' }) // Candy
    result.push({ x: width, y: 1, z: depth, color: '#d4d4d8' })
    result.push({ x: width, y: 2, z: depth, color: '#a5f3fc' }) // Blue candy

    return result
  }, [shopType])

  useFrame((state) => {
    if (!animated || !groupRef.current) return
    // Subtle sign flickering effect
    const flicker = Math.sin(state.clock.elapsedTime * 3) > 0.8
    if (flicker) {
      groupRef.current.scale.setScalar(scale * 1.001)
    } else {
      groupRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.25} castShadow receiveShadow />
    </group>
  )
}
