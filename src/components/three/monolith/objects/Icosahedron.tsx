import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface IcosahedronProps {
  position?: [number, number, number]
  visible?: boolean
  opacity?: number
  scale?: number
  yOffset?: number
}

export const Icosahedron: React.FC<IcosahedronProps> = ({
  position = [0, 0, 0],
  visible = true,
  opacity = 1,
  scale = 1,
  yOffset = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const innerSphereRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.LineSegments>(null)
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

    // ぬるっとした回転
    const targetRotX = Math.sin(time * 0.2) * 0.3
    const targetRotY = time * 0.08
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.015)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.015)

    // 全体の浮遊 + Y位置オフセット
    groupRef.current.position.y = Math.sin(time * 0.35) * 0.25 + currentValues.current.yOffset

    // グループ全体にスケール適用
    groupRef.current.scale.setScalar(transitionScale)

    // 外殻の頂点変形（呼吸するように）
    if (outerRef.current) {
      const geometry = outerRef.current.geometry
      const positions = geometry.attributes.position

      if (!originalPositions.current) {
        originalPositions.current = new Float32Array(positions.array)
      }

      for (let i = 0; i < positions.count; i++) {
        const ox = originalPositions.current[i * 3]
        const oy = originalPositions.current[i * 3 + 1]
        const oz = originalPositions.current[i * 3 + 2]

        // 放射状のうねり
        const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
        const wave = Math.sin(dist * 2 + time * 0.8) * 0.05 + Math.sin(time * 1.2) * 0.03
        const waveScale = 1 + wave

        positions.setXYZ(i, ox * waveScale, oy * waveScale, oz * waveScale)
      }
      positions.needsUpdate = true
      geometry.computeVertexNormals()

      // 外殻の不透明度
      const outerMaterial = outerRef.current.material as THREE.MeshStandardMaterial
      if (outerMaterial) {
        outerMaterial.opacity = currentValues.current.opacity * 0.25
      }
    }

    // ワイヤーフレームの逆回転 + 不透明度
    if (wireRef.current) {
      wireRef.current.rotation.x = -groupRef.current.rotation.x * 0.5
      wireRef.current.rotation.y = -groupRef.current.rotation.y * 0.5
      wireRef.current.rotation.z = Math.sin(time * 0.3) * 0.2

      const wireMaterial = wireRef.current.material as THREE.LineBasicMaterial
      if (wireMaterial) {
        wireMaterial.opacity = currentValues.current.opacity * 0.5
      }
    }

    // 内部球のパルス（より有機的に）
    if (innerSphereRef.current) {
      const pulse1 = Math.sin(time * 1.5) * 0.15
      const pulse2 = Math.sin(time * 2.3) * 0.1
      const pulse3 = Math.sin(time * 0.7) * 0.05
      const pulseScale = 0.9 + pulse1 + pulse2 + pulse3
      innerSphereRef.current.scale.setScalar(pulseScale)

      // 内部球の微妙な位置変動
      innerSphereRef.current.position.x = Math.sin(time * 0.5) * 0.1
      innerSphereRef.current.position.y = Math.cos(time * 0.4) * 0.1

      // 内部球の不透明度
      const innerMaterial = innerSphereRef.current.material as THREE.MeshStandardMaterial
      if (innerMaterial) {
        innerMaterial.opacity = currentValues.current.opacity
        innerMaterial.transparent = true
      }
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {/* 外殻ワイヤーフレーム（逆回転） */}
      <lineSegments ref={wireRef}>
        <icosahedronGeometry args={[3.2, 1]} />
        <lineBasicMaterial color={MONOLITH_COLORS.offWhite} transparent opacity={0.5} />
      </lineSegments>

      {/* 外殻ソリッド（半透明、変形あり） */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[2.9, 2]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.midGray}
          roughness={0.9}
          metalness={0}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 内部発光球 */}
      <mesh ref={innerSphereRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.accent}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={1}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>

      {/* 内部ポイントライト */}
      <pointLight
        color={MONOLITH_COLORS.accent}
        intensity={0.6}
        distance={12}
      />
    </group>
  )
}
