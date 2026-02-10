import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FirefliesProps {
  count?: number
  mouseX?: number
  mouseY?: number
}

export const Fireflies: React.FC<FirefliesProps> = ({
  count = 200,
  mouseX = 0,
  mouseY = 0,
}) => {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, phases, speeds, colors, basePositions } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const basePositions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Spread across screen
      const x = (Math.random() - 0.5) * 20
      const y = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 10 - 3

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.5 + Math.random() * 1.5

      // FF7/FF10 color palette - greens, cyans, whites
      const colorChoice = Math.random()
      if (colorChoice < 0.4) {
        // Lifestream green
        colors[i * 3] = 0
        colors[i * 3 + 1] = 1
        colors[i * 3 + 2] = 0.5
      } else if (colorChoice < 0.7) {
        // Cyan/teal
        colors[i * 3] = 0
        colors[i * 3 + 1] = 0.9
        colors[i * 3 + 2] = 1
      } else if (colorChoice < 0.9) {
        // Soft white
        colors[i * 3] = 0.8
        colors[i * 3 + 1] = 1
        colors[i * 3 + 2] = 0.9
      } else {
        // Golden accent
        colors[i * 3] = 1
        colors[i * 3 + 1] = 0.9
        colors[i * 3 + 2] = 0.5
      }
    }

    return { positions, phases, speeds, colors, basePositions }
  }, [count])

  useFrame((state) => {
    if (!pointsRef.current) return

    const time = state.clock.elapsedTime
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const phase = phases[i]
      const speed = speeds[i]

      // Gentle floating movement like fireflies
      const floatX = Math.sin(time * speed * 0.3 + phase) * 0.5
      const floatY = Math.sin(time * speed * 0.2 + phase * 1.5) * 0.8 +
                     Math.sin(time * speed * 0.5 + phase) * 0.3
      const floatZ = Math.cos(time * speed * 0.25 + phase * 0.8) * 0.3

      // Rising movement (like FF10 pyreflies)
      const rise = (time * 0.1 * speed) % 20 - 10

      posAttr.array[idx] = basePositions[idx] + floatX + mouseX * 0.5
      posAttr.array[idx + 1] = basePositions[idx + 1] + floatY + rise + mouseY * 0.3
      posAttr.array[idx + 2] = basePositions[idx + 2] + floatZ

      // Wrap around
      if (posAttr.array[idx + 1] > 10) {
        posAttr.array[idx + 1] = -10
      }
    }

    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
