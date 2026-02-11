import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface AbstractMonolithProps {
  position?: [number, number, number]
  visible?: boolean
  opacity?: number
  scale?: number
  yOffset?: number
}

export const AbstractMonolith: React.FC<AbstractMonolithProps> = ({
  position = [0, 0, 0],
  visible = true,
  opacity = 1,
  scale = 1,
  yOffset = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const edgesRef = useRef<THREE.LineSegments>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial>(null)

  // 頂点アニメーション用のオリジナル位置を保存
  const originalPositions = useRef<Float32Array | null>(null)

  // 遷移用の現在値
  const currentValues = useRef({ opacity: 1, scale: 1, yOffset: 0 })

  useFrame((state) => {
    if (!meshRef.current || !visible) return

    // スムーズな遷移値の補間
    currentValues.current.opacity = THREE.MathUtils.lerp(currentValues.current.opacity, opacity, 0.08)
    currentValues.current.scale = THREE.MathUtils.lerp(currentValues.current.scale, scale, 0.06)
    currentValues.current.yOffset = THREE.MathUtils.lerp(currentValues.current.yOffset, yOffset, 0.05)

    // グループにスケールとY位置を適用
    if (groupRef.current) {
      groupRef.current.position.y = currentValues.current.yOffset
    }

    const time = state.clock.elapsedTime

    // ゆっくり回転
    meshRef.current.rotation.y = Math.sin(time * 0.2) * 0.3

    // 呼吸するような有機的なスケール変動 + 遷移スケール
    const transitionScale = currentValues.current.scale
    const breatheX = transitionScale * (1 + Math.sin(time * 0.5) * 0.03)
    const breatheY = transitionScale * (1 + Math.sin(time * 0.4 + 0.5) * 0.02)
    const breatheZ = transitionScale * (1 + Math.sin(time * 0.6 + 1) * 0.025)
    meshRef.current.scale.set(breatheX, breatheY, breatheZ)

    // 頂点のうねりアニメーション
    const geometry = meshRef.current.geometry as THREE.BoxGeometry
    const positions = geometry.attributes.position

    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positions.array)
    }

    for (let i = 0; i < positions.count; i++) {
      const ox = originalPositions.current[i * 3]
      const oy = originalPositions.current[i * 3 + 1]
      const oz = originalPositions.current[i * 3 + 2]

      // 波のようなうねり
      const waveX = Math.sin(oy * 0.5 + time * 0.8) * 0.05
      const waveZ = Math.cos(oy * 0.5 + time * 0.6) * 0.05

      positions.setXYZ(i, ox + waveX, oy, oz + waveZ)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()

    if (edgesRef.current) {
      edgesRef.current.rotation.y = meshRef.current.rotation.y
      edgesRef.current.scale.copy(meshRef.current.scale)
    }

    // マテリアルの微妙な変化 + 不透明度
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.02 + Math.sin(time) * 0.02
      materialRef.current.opacity = currentValues.current.opacity
      materialRef.current.transparent = true
    }

    // エッジの不透明度
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity = currentValues.current.opacity * 0.6
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {/* メインのモノリス */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[3, 8, 2, 8, 16, 8]} />
        <meshStandardMaterial
          ref={materialRef}
          color={MONOLITH_COLORS.midGray}
          roughness={0.85}
          metalness={0.05}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={0.02}
          transparent
        />
      </mesh>

      {/* エッジライン（アクセントカラー） */}
      <lineSegments ref={edgesRef}>
        <edgesGeometry args={[new THREE.BoxGeometry(3.02, 8.02, 2.02)]} />
        <lineBasicMaterial ref={edgeMaterialRef} color={MONOLITH_COLORS.accent} linewidth={1} transparent opacity={0.6} />
      </lineSegments>

      {/* 上部スポットライト */}
      <spotLight
        position={[0, 10, 0]}
        angle={0.4}
        penumbra={0.8}
        intensity={0.5}
        color={MONOLITH_COLORS.offWhite}
        castShadow
      />
    </group>
  )
}
