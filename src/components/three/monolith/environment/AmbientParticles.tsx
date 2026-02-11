import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface AmbientParticlesProps {
  count?: number
  spread?: number
  speed?: number
}

export const AmbientParticles: React.FC<AmbientParticlesProps> = ({
  count = 500,
  spread = 50,
  speed = 0.02,
}) => {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, velocities, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const siz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // ランダムな初期位置
      pos[i3] = (Math.random() - 0.5) * spread
      pos[i3 + 1] = Math.random() * spread * 0.5 - 5
      pos[i3 + 2] = (Math.random() - 0.5) * spread

      // ランダムな速度
      vel[i3] = (Math.random() - 0.5) * speed * 0.5
      vel[i3 + 1] = Math.random() * speed + speed * 0.5
      vel[i3 + 2] = (Math.random() - 0.5) * speed * 0.5

      // ランダムなサイズ
      siz[i] = Math.random() * 0.03 + 0.01
    }

    return { positions: pos, velocities: vel, sizes: siz }
  }, [count, spread, speed])

  useFrame(() => {
    if (!pointsRef.current) return

    const positionAttribute = pointsRef.current.geometry.attributes.position
    const posArray = positionAttribute.array as Float32Array

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // 位置を更新
      posArray[i3] += velocities[i3]
      posArray[i3 + 1] += velocities[i3 + 1]
      posArray[i3 + 2] += velocities[i3 + 2]

      // 上端に達したらリセット
      if (posArray[i3 + 1] > spread * 0.3) {
        posArray[i3] = (Math.random() - 0.5) * spread
        posArray[i3 + 1] = -5
        posArray[i3 + 2] = (Math.random() - 0.5) * spread
      }
    }

    positionAttribute.needsUpdate = true
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
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color={MONOLITH_COLORS.offWhite}
        size={0.05}
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
