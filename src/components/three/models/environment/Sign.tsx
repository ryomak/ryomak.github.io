import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition } from '../VoxelUtils'

interface SignProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  type?: 'direction' | 'shop' | 'info' | 'neon'
  text?: string
  color?: string
  animated?: boolean
}

// Various sign types
export const Sign: React.FC<SignProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  type = 'direction',
  color = '#4A90D9',
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const neonRef = useRef<THREE.PointLight>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const poleColor = '#4A4A4A'

    switch (type) {
      case 'direction': {
        // Pole
        for (let y = 0; y < 4; y++) {
          result.push({ x: 0, y, z: 0, color: poleColor })
        }
        // Arrow-shaped sign pointing right
        result.push({ x: 1, y: 3, z: 0, color })
        result.push({ x: 2, y: 3, z: 0, color })
        result.push({ x: 3, y: 3, z: 0, color })
        result.push({ x: 4, y: 3, z: 0, color })
        result.push({ x: 5, y: 3, z: 0, color })
        // Arrow point
        result.push({ x: 4, y: 4, z: 0, color })
        result.push({ x: 4, y: 2, z: 0, color })
        break
      }

      case 'shop': {
        // Pole
        for (let y = 0; y < 3; y++) {
          result.push({ x: 0, y, z: 0, color: poleColor })
          result.push({ x: 4, y, z: 0, color: poleColor })
        }
        // Sign board
        for (let x = 0; x <= 4; x++) {
          result.push({ x, y: 3, z: 0, color })
          result.push({ x, y: 4, z: 0, color })
          result.push({ x, y: 5, z: 0, color })
        }
        // Border
        for (let x = 0; x <= 4; x++) {
          result.push({ x, y: 6, z: 0, color: '#FFFFFF' })
          result.push({ x, y: 2, z: 0, color: '#FFFFFF' })
        }
        break
      }

      case 'info': {
        // Standing info board
        result.push({ x: 0, y: 0, z: 0, color: poleColor })
        result.push({ x: 2, y: 0, z: 0, color: poleColor })
        // Board
        for (let x = 0; x <= 2; x++) {
          for (let y = 1; y <= 3; y++) {
            result.push({ x, y, z: 0, color: '#F5F5F5' })
          }
        }
        // Info icon (i)
        result.push({ x: 1, y: 3, z: 1, color })
        result.push({ x: 1, y: 2, z: 1, color })
        result.push({ x: 1, y: 1, z: 1, color })
        break
      }

      case 'neon': {
        // Mounting bracket
        result.push({ x: 0, y: 3, z: 0, color: poleColor })
        result.push({ x: 0, y: 4, z: 0, color: poleColor })
        // Neon frame
        for (let x = 1; x <= 5; x++) {
          result.push({ x, y: 5, z: 0, color })
          result.push({ x, y: 2, z: 0, color })
        }
        result.push({ x: 1, y: 3, z: 0, color })
        result.push({ x: 1, y: 4, z: 0, color })
        result.push({ x: 5, y: 3, z: 0, color })
        result.push({ x: 5, y: 4, z: 0, color })
        // Inner glow blocks
        for (let x = 2; x <= 4; x++) {
          result.push({ x, y: 3, z: 0, color })
          result.push({ x, y: 4, z: 0, color })
        }
        break
      }
    }

    return result
  }, [type, color])

  useFrame((state) => {
    if (!animated) return

    if (type === 'neon' && neonRef.current) {
      // Neon flickering effect
      const flicker = Math.sin(state.clock.elapsedTime * 8) > 0.7 ? 0.3 : 1
      neonRef.current.intensity = flicker * 0.5
    }

    if (groupRef.current && type === 'direction') {
      // Slight wobble for direction signs
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.02
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.5} castShadow />
      {type === 'neon' && (
        <pointLight
          ref={neonRef}
          position={[1.5, 2, 0.5]}
          color={color}
          intensity={0.5}
          distance={4}
        />
      )}
    </group>
  )
}

interface StreetSignsProps {
  position?: [number, number, number]
}

// Pre-configured street corner signs
export const StreetSigns: React.FC<StreetSignsProps> = ({
  position = [0, 0, 0],
}) => {
  return (
    <group position={position}>
      <Sign
        type="direction"
        position={[0, 0, 0]}
        color="#4A90D9"
        animated
      />
      <Sign
        type="direction"
        position={[0, 0, 0]}
        rotation={[0, Math.PI, 0]}
        color="#E74C3C"
      />
    </group>
  )
}
