import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface VoxelParticlesProps {
  position?: [number, number, number]
  count?: number
  size?: number
  color?: string
  spread?: number
  speed?: number
  type?: 'float' | 'rise' | 'orbit' | 'sparkle'
}

// Voxel-style particle system
export const VoxelParticles: React.FC<VoxelParticlesProps> = ({
  position = [0, 0, 0],
  count = 50,
  size = 0.1,
  color = '#00F5D4',
  spread = 5,
  speed = 1,
  type = 'float',
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tempObject = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      phase: Math.random() * Math.PI * 2,
      orbitRadius: 2 + Math.random() * 3,
      orbitSpeed: 0.2 + Math.random() * 0.3,
    }))
  }, [count, spread])

  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime * speed

    particles.forEach((particle, i) => {
      switch (type) {
        case 'float':
          // Gentle floating motion
          tempObject.position.set(
            particle.position.x + Math.sin(time + particle.phase) * 0.3,
            particle.position.y + Math.cos(time * 0.7 + particle.phase) * 0.5,
            particle.position.z + Math.sin(time * 0.5 + particle.phase) * 0.3
          )
          break

        case 'rise':
          // Rising particles (like sparks/embers)
          particle.position.y += 0.02 * speed
          if (particle.position.y > spread) {
            particle.position.y = -spread
            particle.position.x = (Math.random() - 0.5) * spread * 2
            particle.position.z = (Math.random() - 0.5) * spread * 2
          }
          tempObject.position.copy(particle.position)
          break

        case 'orbit':
          // Orbiting particles
          tempObject.position.set(
            Math.cos(time * particle.orbitSpeed + particle.phase) * particle.orbitRadius,
            Math.sin(time * 0.5 + particle.phase) * 1,
            Math.sin(time * particle.orbitSpeed + particle.phase) * particle.orbitRadius
          )
          break

        case 'sparkle':
          // Twinkling/sparkling effect
          tempObject.position.copy(particle.position)
          const scale = 0.5 + Math.sin(time * 3 + particle.phase) * 0.5
          tempObject.scale.setScalar(scale)
          break
      }

      tempObject.updateMatrix()
      meshRef.current?.setMatrixAt(i, tempObject.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </instancedMesh>
    </group>
  )
}

interface GlowParticlesProps {
  position?: [number, number, number]
  count?: number
  colors?: string[]
  spread?: number
}

// Glowing particles with multiple colors
export const GlowParticles: React.FC<GlowParticlesProps> = ({
  position = [0, 0, 0],
  count = 30,
  colors = ['#00F5D4', '#9B5DE5', '#F15BB5'],
  spread = 10,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * spread * 2,
        Math.random() * spread,
        (Math.random() - 0.5) * spread * 2,
      ] as [number, number, number],
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 0.05 + Math.random() * 0.1,
      phase: Math.random() * Math.PI * 2,
    }))
  }, [count, colors, spread])

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime

    groupRef.current.children.forEach((child, i) => {
      const particle = particles[i]
      if (child instanceof THREE.Mesh) {
        // Pulsing glow
        const pulse = 0.5 + Math.sin(time * 2 + particle.phase) * 0.5
        child.scale.setScalar(pulse)
        // Gentle drift
        child.position.y = particle.position[1] + Math.sin(time + particle.phase) * 0.5
      }
    })
  })

  return (
    <group ref={groupRef} position={position}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
          <boxGeometry args={[particle.size, particle.size, particle.size]} />
          <meshBasicMaterial color={particle.color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

interface DataFlowParticlesProps {
  position?: [number, number, number]
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  count?: number
  color?: string
}

// Data flow effect (like network traffic)
export const DataFlowParticles: React.FC<DataFlowParticlesProps> = ({
  position = [0, 0, 0],
  startPoint = [-5, 0, 0],
  endPoint = [5, 0, 0],
  count = 20,
  color = '#00F5D4',
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tempObject = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      progress: Math.random(),
      speed: 0.005 + Math.random() * 0.01,
      offset: (Math.random() - 0.5) * 0.5,
    }))
  }, [count])

  useFrame(() => {
    if (!meshRef.current) return

    particles.forEach((particle, i) => {
      particle.progress += particle.speed
      if (particle.progress > 1) {
        particle.progress = 0
      }

      // Interpolate between start and end
      const x = startPoint[0] + (endPoint[0] - startPoint[0]) * particle.progress
      const y = startPoint[1] + (endPoint[1] - startPoint[1]) * particle.progress + particle.offset
      const z = startPoint[2] + (endPoint[2] - startPoint[2]) * particle.progress + particle.offset

      tempObject.position.set(x, y, z)
      tempObject.updateMatrix()
      meshRef.current?.setMatrixAt(i, tempObject.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  )
}
