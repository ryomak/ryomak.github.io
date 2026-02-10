import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface StreetLightProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  isOn?: boolean
  style?: 'classic' | 'modern'
  animated?: boolean
}

// Street Light
export const StreetLight: React.FC<StreetLightProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isOn = true,
  style = 'classic',
  animated = false,
}) => {
  const lightRef = useRef<THREE.PointLight>(null)
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = VOXEL_COLORS.streetLight
    const lightColor = isOn ? colors.light : '#333333'

    if (style === 'classic') {
      // Base
      result.push({ x: 0, y: 0, z: 0, color: colors.pole })
      result.push({ x: 1, y: 0, z: 0, color: colors.pole })
      result.push({ x: 0, y: 0, z: 1, color: colors.pole })
      result.push({ x: 1, y: 0, z: 1, color: colors.pole })

      // Pole
      for (let y = 1; y <= 6; y++) {
        result.push({ x: 0, y, z: 0, color: colors.pole })
      }

      // Arm
      result.push({ x: 1, y: 6, z: 0, color: colors.pole })
      result.push({ x: 2, y: 6, z: 0, color: colors.pole })

      // Lamp housing
      result.push({ x: 2, y: 5, z: 0, color: colors.pole })
      result.push({ x: 2, y: 5, z: -1, color: lightColor })
      result.push({ x: 2, y: 5, z: 1, color: lightColor })
      result.push({ x: 3, y: 5, z: 0, color: lightColor })

    } else {
      // Modern style - sleek pole
      // Base
      result.push({ x: 0, y: 0, z: 0, color: '#2C2C2C' })

      // Slim pole
      for (let y = 1; y <= 8; y++) {
        result.push({ x: 0, y, z: 0, color: '#3C3C3C' })
      }

      // Curved top
      result.push({ x: 1, y: 8, z: 0, color: '#3C3C3C' })
      result.push({ x: 2, y: 8, z: 0, color: '#3C3C3C' })

      // LED panel
      result.push({ x: 2, y: 7, z: -1, color: lightColor })
      result.push({ x: 2, y: 7, z: 0, color: lightColor })
      result.push({ x: 2, y: 7, z: 1, color: lightColor })
    }

    return result
  }, [isOn, style])

  useFrame((state) => {
    if (!animated || !lightRef.current) return

    // Subtle flickering
    const flicker = Math.sin(state.clock.elapsedTime * 10) * 0.1 + 0.9
    lightRef.current.intensity = isOn ? flicker * 0.8 : 0
  })

  const lightPosition: [number, number, number] = style === 'classic'
    ? [1.25, 2.5, 0]
    : [1, 3.5, 0]

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.5} castShadow />
      {isOn && (
        <>
          <pointLight
            ref={lightRef}
            position={lightPosition}
            color={VOXEL_COLORS.streetLight.light}
            intensity={0.8}
            distance={8}
            castShadow
          />
          {/* Light cone effect */}
          <mesh position={[lightPosition[0], lightPosition[1] - 1, lightPosition[2]]}>
            <coneGeometry args={[1.5, 3, 8, 1, true]} />
            <meshBasicMaterial
              color={VOXEL_COLORS.streetLight.light}
              transparent
              opacity={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  )
}

interface StreetLightRowProps {
  position?: [number, number, number]
  count?: number
  spacing?: number
  direction?: 'x' | 'z'
  style?: 'classic' | 'modern'
}

// Row of street lights
export const StreetLightRow: React.FC<StreetLightRowProps> = ({
  position = [0, 0, 0],
  count = 4,
  spacing = 6,
  direction = 'x',
  style = 'classic',
}) => {
  const lights = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      position: direction === 'x'
        ? [i * spacing, 0, 0] as [number, number, number]
        : [0, 0, i * spacing] as [number, number, number],
      rotation: direction === 'z'
        ? [0, Math.PI / 2, 0] as [number, number, number]
        : [0, 0, 0] as [number, number, number],
    }))
  }, [count, spacing, direction])

  return (
    <group position={position}>
      {lights.map((light, i) => (
        <StreetLight
          key={i}
          position={light.position}
          rotation={light.rotation}
          style={style}
          animated
        />
      ))}
    </group>
  )
}
