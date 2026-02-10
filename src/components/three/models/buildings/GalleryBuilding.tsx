import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface GalleryBuildingProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  artworkCount?: number
  animated?: boolean
}

// Gallery Building - represents Works/Portfolio (Kawaii style)
export const GalleryBuilding: React.FC<GalleryBuildingProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  artworkCount = 3,
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const spotlightRefs = useRef<THREE.PointLight[]>([])

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = VOXEL_COLORS.gallery
    const width = 6
    const depth = 5
    const height = 5

    // Foundation - cream colored base
    for (let x = -1; x <= width; x++) {
      for (let z = -1; z <= depth; z++) {
        // Skip corners for rounded effect
        const isCorner = (x === -1 || x === width) && (z === -1 || z === depth)
        if (!isCorner) {
          result.push({ x, y: 0, z, color: '#fef3c7' }) // Cream
        }
      }
    }

    // Main structure - soft pastel walls
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
    }

    // Cute dome-style roof - coral pink layers
    for (let x = -1; x <= width; x++) {
      for (let z = -1; z <= depth; z++) {
        result.push({ x, y: height + 1, z, color: '#fda4af' })
      }
    }
    // Second layer (smaller)
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        result.push({ x, y: height + 2, z, color: '#fda4af' })
      }
    }

    // Large entrance (pastel glass doors)
    const entranceX = Math.floor(width / 2)
    for (let x = entranceX - 1; x <= entranceX; x++) {
      result.push({ x, y: 1, z: depth, color: '#a5f3fc' }) // Light cyan
      result.push({ x, y: 2, z: depth, color: '#a5f3fc' })
      result.push({ x, y: 3, z: depth, color: '#a5f3fc' })
    }

    // Cute awning above entrance
    for (let x = entranceX - 2; x <= entranceX + 1; x++) {
      result.push({ x, y: 4, z: depth, color: '#c4b5fd' }) // Lavender
      result.push({ x, y: 4, z: depth + 1, color: '#c4b5fd' })
    }

    // Large windows on sides - soft pastel
    for (let y = 2; y <= 4; y++) {
      // Left side
      for (let z = 1; z < depth - 1; z++) {
        result.push({ x: -1, y, z, color: '#a5f3fc' }) // Light cyan
      }
      // Right side
      for (let z = 1; z < depth - 1; z++) {
        result.push({ x: width, y, z, color: '#a5f3fc' })
      }
    }

    // Interior artwork displays - pastel art pieces
    const artColors = ['#f9a8d4', '#a5f3fc', '#fef08a', '#c4b5fd', '#86efac']
    for (let i = 0; i < Math.min(artworkCount, 3); i++) {
      const artX = 1 + i * 2
      // Art frame - pink
      result.push({ x: artX, y: 2, z: 1, color: '#fda4af' })
      result.push({ x: artX, y: 3, z: 1, color: '#fda4af' })
      result.push({ x: artX, y: 4, z: 1, color: '#fda4af' })
      // Art itself - colorful pastel
      result.push({ x: artX, y: 2, z: 0, color: artColors[i % artColors.length] })
      result.push({ x: artX, y: 3, z: 0, color: artColors[(i + 1) % artColors.length] })
      result.push({ x: artX, y: 4, z: 0, color: artColors[(i + 2) % artColors.length] })
    }

    // Decorative columns at entrance - pastel lavender
    for (let y = 1; y <= 4; y++) {
      result.push({ x: entranceX - 2, y, z: depth, color: '#d8b4fe' })
      result.push({ x: entranceX + 1, y, z: depth, color: '#d8b4fe' })
    }

    // Heart decorations on roof
    const centerX = Math.floor(width / 2)
    const centerZ = Math.floor(depth / 2)
    result.push({ x: centerX, y: height + 3, z: centerZ, color: '#fb7185' }) // Heart center
    result.push({ x: centerX - 1, y: height + 3, z: centerZ, color: '#fb7185' })
    result.push({ x: centerX + 1, y: height + 3, z: centerZ, color: '#fb7185' })
    result.push({ x: centerX, y: height + 4, z: centerZ, color: '#fb7185' })

    // Star decorations on corners
    result.push({ x: 0, y: height + 3, z: 0, color: '#fef08a' })
    result.push({ x: width - 1, y: height + 3, z: 0, color: '#fef08a' })
    result.push({ x: 0, y: height + 3, z: depth - 1, color: '#fef08a' })
    result.push({ x: width - 1, y: height + 3, z: depth - 1, color: '#fef08a' })

    // Cute flower pots at entrance
    result.push({ x: entranceX - 3, y: 1, z: depth + 1, color: '#86efac' }) // Green pot
    result.push({ x: entranceX - 3, y: 2, z: depth + 1, color: '#f9a8d4' }) // Pink flower
    result.push({ x: entranceX + 2, y: 1, z: depth + 1, color: '#86efac' })
    result.push({ x: entranceX + 2, y: 2, z: depth + 1, color: '#fef08a' }) // Yellow flower

    // Skylight on roof - soft cyan
    for (let x = 1; x < width - 1; x++) {
      for (let z = 1; z < depth - 1; z++) {
        result.push({ x, y: height + 2, z, color: '#a5f3fc' })
      }
    }

    // Bunting flags above entrance
    for (let x = entranceX - 2; x <= entranceX + 1; x++) {
      const flagColors = ['#f9a8d4', '#a5f3fc', '#fef08a', '#c4b5fd']
      result.push({ x, y: 5, z: depth + 1, color: flagColors[x % flagColors.length] })
    }

    return result
  }, [artworkCount])

  useFrame((state) => {
    if (!animated || !groupRef.current) return
    // Gentle rotation for showcase effect
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02

    // Animate spotlights
    spotlightRefs.current.forEach((light, i) => {
      if (light) {
        light.intensity = 0.5 + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.2
      }
    })
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.25} castShadow receiveShadow />
      {/* Interior spotlights for artwork */}
      {Array.from({ length: Math.min(artworkCount, 3) }).map((_, i) => (
        <pointLight
          key={i}
          ref={(el) => { if (el) spotlightRefs.current[i] = el }}
          position={[(1 + i * 2) * 0.25, 1.5, 0.25]}
          color="#fff5f5"
          intensity={0.5}
          distance={2}
        />
      ))}
    </group>
  )
}
