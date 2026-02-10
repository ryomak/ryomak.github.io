import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ParticlesProps {
  count?: number
  sphereRadius?: number
  colorPrimary?: string
  colorSecondary?: string
  colorAccent?: string
  mouseX?: number
  mouseY?: number
}

export const Particles: React.FC<ParticlesProps> = ({
  count = 800,
  sphereRadius = 4.5,
  colorPrimary = '#00F5D4',
  colorSecondary = '#9B5DE5',
  colorAccent = '#FF006E',
  mouseX = 0,
  mouseY = 0,
}) => {
  const pointsRef = useRef<THREE.Points>(null)
  const timeRef = useRef(0)

  const { positions, colors, originalPositions, velocities, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    const colorA = new THREE.Color(colorPrimary)
    const colorB = new THREE.Color(colorSecondary)
    const colorC = new THREE.Color(colorAccent)

    for (let i = 0; i < count; i++) {
      // Distribute particles in a wider area
      const spread = 12
      const x = (Math.random() - 0.5) * spread
      const y = (Math.random() - 0.5) * spread
      const z = (Math.random() - 0.5) * spread * 0.5 - 2

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z

      // Random velocities for flowing effect
      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01

      // Random sizes
      sizes[i] = Math.random() * 0.08 + 0.02

      // Color gradient based on position
      const colorMix = Math.random()
      let mixedColor: THREE.Color
      if (colorMix < 0.5) {
        mixedColor = new THREE.Color().lerpColors(colorA, colorB, colorMix * 2)
      } else {
        mixedColor = new THREE.Color().lerpColors(colorB, colorC, (colorMix - 0.5) * 2)
      }

      colors[i * 3] = mixedColor.r
      colors[i * 3 + 1] = mixedColor.g
      colors[i * 3 + 2] = mixedColor.b
    }

    return { positions, colors, originalPositions, velocities, sizes }
  }, [count, colorPrimary, colorSecondary, colorAccent])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    timeRef.current += delta

    const positionAttribute = pointsRef.current.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute

    const time = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const idx = i * 3

      // Get current position
      let x = positionAttribute.array[idx] as number
      let y = positionAttribute.array[idx + 1] as number
      let z = positionAttribute.array[idx + 2] as number

      // Flow movement with noise
      const noiseX = Math.sin(time * 0.5 + i * 0.1) * 0.02
      const noiseY = Math.cos(time * 0.3 + i * 0.15) * 0.015

      x += velocities[idx] + noiseX + mouseX * 0.01
      y += velocities[idx + 1] + noiseY + mouseY * 0.01
      z += velocities[idx + 2]

      // Wrap around boundaries
      const bound = 6
      if (x > bound) x = -bound
      if (x < -bound) x = bound
      if (y > bound) y = -bound
      if (y < -bound) y = bound
      if (z > 2) z = -4
      if (z < -4) z = 2

      positionAttribute.array[idx] = x
      positionAttribute.array[idx + 1] = y
      positionAttribute.array[idx + 2] = z
    }

    positionAttribute.needsUpdate = true

    // Gentle rotation
    pointsRef.current.rotation.z += 0.0002
  })

  const positionAttribute = useMemo(() => {
    return new THREE.BufferAttribute(positions, 3)
  }, [positions])

  const colorAttribute = useMemo(() => {
    return new THREE.BufferAttribute(colors, 3)
  }, [colors])

  const sizeAttribute = useMemo(() => {
    return new THREE.BufferAttribute(sizes, 1)
  }, [sizes])

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <primitive object={positionAttribute} attach="attributes-position" />
        <primitive object={colorAttribute} attach="attributes-color" />
        <primitive object={sizeAttribute} attach="attributes-size" />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
