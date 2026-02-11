import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

type TechType = 'go' | 'typescript' | 'react' | 'python' | 'rust' | 'kubernetes' | 'docker' | 'aws'

interface TechLogoProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  tech: TechType
  animated?: boolean
  floating?: boolean
}

// Generate voxel pattern for each tech logo
const generateTechVoxels = (tech: TechType): VoxelPosition[] => {
  const result: VoxelPosition[] = []

  switch (tech) {
    case 'go': {
      // Go Gopher simplified - blue mascot shape
      const goColor = VOXEL_COLORS.go
      // Body (oval)
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 4; y++) {
          result.push({ x, y, z: 0, color: goColor })
        }
      }
      // Eyes
      result.push({ x: 0, y: 3, z: 1, color: '#FFFFFF' })
      result.push({ x: 2, y: 3, z: 1, color: '#FFFFFF' })
      // Pupils
      result.push({ x: 0, y: 3, z: 2, color: '#000000' })
      result.push({ x: 2, y: 3, z: 2, color: '#000000' })
      // Ears
      result.push({ x: -1, y: 4, z: 0, color: goColor })
      result.push({ x: 3, y: 4, z: 0, color: goColor })
      break
    }

    case 'typescript': {
      // TS logo - blue square with TS
      const tsColor = VOXEL_COLORS.typescript
      // Background square
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          result.push({ x, y, z: 0, color: tsColor })
        }
      }
      // T shape (white)
      result.push({ x: 1, y: 3, z: 1, color: '#FFFFFF' })
      result.push({ x: 2, y: 3, z: 1, color: '#FFFFFF' })
      result.push({ x: 2, y: 2, z: 1, color: '#FFFFFF' })
      result.push({ x: 2, y: 1, z: 1, color: '#FFFFFF' })
      // S shape (simplified)
      result.push({ x: 3, y: 3, z: 1, color: '#FFFFFF' })
      result.push({ x: 4, y: 3, z: 1, color: '#FFFFFF' })
      result.push({ x: 3, y: 2, z: 1, color: '#FFFFFF' })
      result.push({ x: 4, y: 1, z: 1, color: '#FFFFFF' })
      result.push({ x: 3, y: 1, z: 1, color: '#FFFFFF' })
      break
    }

    case 'react': {
      // React atom logo
      const reactColor = VOXEL_COLORS.react
      // Center nucleus
      result.push({ x: 2, y: 2, z: 0, color: reactColor })
      // Orbital rings (simplified)
      // Horizontal ring
      for (let x = 0; x < 5; x++) {
        if (x !== 2) {
          result.push({ x, y: 2, z: 0, color: reactColor })
        }
      }
      // Diagonal ring 1
      result.push({ x: 0, y: 0, z: 0, color: reactColor })
      result.push({ x: 1, y: 1, z: 0, color: reactColor })
      result.push({ x: 3, y: 3, z: 0, color: reactColor })
      result.push({ x: 4, y: 4, z: 0, color: reactColor })
      // Diagonal ring 2
      result.push({ x: 4, y: 0, z: 0, color: reactColor })
      result.push({ x: 3, y: 1, z: 0, color: reactColor })
      result.push({ x: 1, y: 3, z: 0, color: reactColor })
      result.push({ x: 0, y: 4, z: 0, color: reactColor })
      break
    }

    case 'python': {
      // Python logo - two snakes
      const pyBlue = VOXEL_COLORS.python
      const pyYellow = '#FFD43B'
      // Blue snake
      result.push({ x: 0, y: 3, z: 0, color: pyBlue })
      result.push({ x: 1, y: 3, z: 0, color: pyBlue })
      result.push({ x: 2, y: 3, z: 0, color: pyBlue })
      result.push({ x: 2, y: 2, z: 0, color: pyBlue })
      result.push({ x: 1, y: 2, z: 0, color: pyBlue })
      result.push({ x: 0, y: 2, z: 0, color: pyBlue })
      // Yellow snake
      result.push({ x: 2, y: 1, z: 0, color: pyYellow })
      result.push({ x: 3, y: 1, z: 0, color: pyYellow })
      result.push({ x: 4, y: 1, z: 0, color: pyYellow })
      result.push({ x: 2, y: 0, z: 0, color: pyYellow })
      result.push({ x: 3, y: 0, z: 0, color: pyYellow })
      result.push({ x: 4, y: 0, z: 0, color: pyYellow })
      break
    }

    case 'rust': {
      // Rust gear logo (simplified)
      const rustColor = VOXEL_COLORS.rust
      // Central R
      result.push({ x: 1, y: 1, z: 0, color: rustColor })
      result.push({ x: 1, y: 2, z: 0, color: rustColor })
      result.push({ x: 1, y: 3, z: 0, color: rustColor })
      result.push({ x: 2, y: 3, z: 0, color: rustColor })
      result.push({ x: 2, y: 2, z: 0, color: rustColor })
      result.push({ x: 3, y: 1, z: 0, color: rustColor })
      // Gear teeth
      result.push({ x: 0, y: 2, z: 0, color: '#2D2D2D' })
      result.push({ x: 4, y: 2, z: 0, color: '#2D2D2D' })
      result.push({ x: 2, y: 0, z: 0, color: '#2D2D2D' })
      result.push({ x: 2, y: 4, z: 0, color: '#2D2D2D' })
      break
    }

    case 'kubernetes': {
      // K8s helm wheel (simplified)
      const k8sColor = '#326CE5'
      // Center
      result.push({ x: 2, y: 2, z: 0, color: k8sColor })
      // Spokes
      result.push({ x: 2, y: 4, z: 0, color: k8sColor })
      result.push({ x: 2, y: 0, z: 0, color: k8sColor })
      result.push({ x: 0, y: 2, z: 0, color: k8sColor })
      result.push({ x: 4, y: 2, z: 0, color: k8sColor })
      result.push({ x: 0, y: 4, z: 0, color: k8sColor })
      result.push({ x: 4, y: 4, z: 0, color: k8sColor })
      result.push({ x: 0, y: 0, z: 0, color: k8sColor })
      result.push({ x: 4, y: 0, z: 0, color: k8sColor })
      break
    }

    case 'docker': {
      // Docker whale
      const dockerColor = '#2496ED'
      // Whale body
      for (let x = 0; x < 5; x++) {
        result.push({ x, y: 0, z: 0, color: dockerColor })
        result.push({ x, y: 1, z: 0, color: dockerColor })
      }
      // Containers on top
      result.push({ x: 1, y: 2, z: 0, color: '#FFFFFF' })
      result.push({ x: 2, y: 2, z: 0, color: '#FFFFFF' })
      result.push({ x: 3, y: 2, z: 0, color: '#FFFFFF' })
      result.push({ x: 2, y: 3, z: 0, color: '#FFFFFF' })
      // Tail
      result.push({ x: -1, y: 1, z: 0, color: dockerColor })
      break
    }

    case 'aws': {
      // AWS logo (simplified)
      const awsOrange = '#FF9900'
      // A shape
      result.push({ x: 0, y: 0, z: 0, color: awsOrange })
      result.push({ x: 0, y: 1, z: 0, color: awsOrange })
      result.push({ x: 0, y: 2, z: 0, color: awsOrange })
      result.push({ x: 1, y: 3, z: 0, color: awsOrange })
      result.push({ x: 2, y: 2, z: 0, color: awsOrange })
      result.push({ x: 2, y: 1, z: 0, color: awsOrange })
      result.push({ x: 2, y: 0, z: 0, color: awsOrange })
      result.push({ x: 1, y: 1, z: 0, color: awsOrange })
      // Arrow
      result.push({ x: 3, y: 1, z: 0, color: awsOrange })
      result.push({ x: 4, y: 1, z: 0, color: awsOrange })
      result.push({ x: 4, y: 2, z: 0, color: awsOrange })
      break
    }
  }

  return result
}

// Individual tech logo
export const TechLogo: React.FC<TechLogoProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  tech,
  animated = false,
  floating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const timeOffset = useRef(Math.random() * Math.PI * 2)

  const voxels = useMemo(() => generateTechVoxels(tech), [tech])

  useFrame((state) => {
    if (!groupRef.current) return

    if (animated) {
      groupRef.current.rotation.y += 0.01
    }

    if (floating) {
      groupRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime + timeOffset.current) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.3} castShadow />
    </group>
  )
}

interface TechLogosGridProps {
  position?: [number, number, number]
  techs?: TechType[]
  spacing?: number
  columns?: number
  animated?: boolean
}

// Grid of tech logos
export const TechLogosGrid: React.FC<TechLogosGridProps> = ({
  position = [0, 0, 0],
  techs = ['go', 'typescript', 'react', 'python'],
  spacing = 3,
  columns = 4,
  animated = true,
}) => {
  const logos = useMemo(() => {
    return techs.map((tech, i) => ({
      tech,
      position: [
        (i % columns) * spacing,
        0,
        Math.floor(i / columns) * spacing,
      ] as [number, number, number],
    }))
  }, [techs, spacing, columns])

  return (
    <group position={position}>
      {logos.map((logo, i) => (
        <TechLogo
          key={i}
          tech={logo.tech}
          position={logo.position}
          animated={animated}
          floating
        />
      ))}
    </group>
  )
}

interface FloatingTechIconProps {
  position?: [number, number, number]
  tech: TechType
  orbitRadius?: number
  orbitSpeed?: number
}

// Single floating/orbiting tech icon
export const FloatingTechIcon: React.FC<FloatingTechIconProps> = ({
  position = [0, 0, 0],
  tech,
  orbitRadius = 3,
  orbitSpeed = 0.5,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const phaseOffset = useRef(Math.random() * Math.PI * 2)

  const voxels = useMemo(() => generateTechVoxels(tech), [tech])

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime * orbitSpeed + phaseOffset.current

    groupRef.current.position.x = position[0] + Math.cos(time) * orbitRadius
    groupRef.current.position.z = position[2] + Math.sin(time) * orbitRadius
    groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.5

    // Always face center
    groupRef.current.rotation.y = -time
  })

  return (
    <group ref={groupRef}>
      <VoxelGroup voxels={voxels} size={0.25} castShadow />
    </group>
  )
}
