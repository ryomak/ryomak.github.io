import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface TorusKnotProps {
  position?: [number, number, number]
  visible?: boolean
  opacity?: number
  scale?: number
  yOffset?: number
}

export const TorusKnot: React.FC<TorusKnotProps> = ({
  position = [0, 0, 0],
  visible = true,
  opacity = 1,
  scale = 1,
  yOffset = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const solidRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const originalPositions = useRef<Float32Array | null>(null)

  // 遷移用の現在値
  const currentValues = useRef({ opacity: 1, scale: 1, yOffset: 0 })

  useFrame((state) => {
    if (!groupRef.current || !visible) return

    const time = state.clock.elapsedTime

    // スムーズな遷移値の補間
    currentValues.current.opacity = THREE.MathUtils.lerp(currentValues.current.opacity, opacity, 0.08)
    currentValues.current.scale = THREE.MathUtils.lerp(currentValues.current.scale, scale, 0.06)
    currentValues.current.yOffset = THREE.MathUtils.lerp(currentValues.current.yOffset, yOffset, 0.05)

    const transitionScale = currentValues.current.scale

    // ぬるっとした複合回転
    const targetRotX = Math.sin(time * 0.3) * 0.3
    const targetRotY = time * 0.1
    const targetRotZ = Math.cos(time * 0.25) * 0.15

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.02)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.02)
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, 0.02)

    // 全体の浮遊 + Y位置オフセット
    groupRef.current.position.y = Math.sin(time * 0.4) * 0.2 + currentValues.current.yOffset

    // メッシュの頂点変形
    if (solidRef.current) {
      const geometry = solidRef.current.geometry
      const positions = geometry.attributes.position

      if (!originalPositions.current) {
        originalPositions.current = new Float32Array(positions.array)
      }

      for (let i = 0; i < positions.count; i++) {
        const ox = originalPositions.current[i * 3]
        const oy = originalPositions.current[i * 3 + 1]
        const oz = originalPositions.current[i * 3 + 2]

        // ノイズのようなうねり
        const noise = Math.sin(ox * 2 + time * 0.5) * Math.cos(oy * 2 + time * 0.3) * 0.03

        positions.setXYZ(
          i,
          ox * (1 + noise),
          oy * (1 + noise * 0.5),
          oz * (1 + noise)
        )
      }
      positions.needsUpdate = true
      geometry.computeVertexNormals()

      // スケールの脈動 + 遷移スケール
      const pulse = 1 + Math.sin(time * 1.5) * 0.03
      solidRef.current.scale.setScalar(pulse * transitionScale)

      // マテリアルの不透明度
      const material = solidRef.current.material as THREE.MeshStandardMaterial
      if (material) {
        material.opacity = currentValues.current.opacity
        material.transparent = true
      }
    }

    // リングのアニメーション
    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.5
      const ringPulse = 1 + Math.sin(time * 2) * 0.1
      ringRef.current.scale.setScalar(ringPulse * transitionScale)

      // リングの不透明度
      const ringMaterial = ringRef.current.material as THREE.MeshStandardMaterial
      if (ringMaterial) {
        ringMaterial.opacity = currentValues.current.opacity
        ringMaterial.transparent = true
      }
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {/* ソリッドメッシュ */}
      <mesh ref={solidRef} castShadow receiveShadow>
        <torusKnotGeometry args={[2, 0.5, 128, 32, 2, 3]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.midGray}
          roughness={0.8}
          metalness={0.1}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* ワイヤーフレーム（外殻） */}
      <lineSegments>
        <edgesGeometry args={[new THREE.TorusKnotGeometry(2.05, 0.55, 64, 16, 2, 3)]} />
        <lineBasicMaterial color={MONOLITH_COLORS.lightGray} transparent opacity={0.3} />
      </lineSegments>

      {/* アクセントリング */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.5, 0.02, 16, 64]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.accent}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  )
}
