import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface MorphingShapeProps {
  scrollProgress: number
}

// 各セクションの形状を定義
const SHAPE_COUNT = 4

// 各形状の固有スケール（見た目のバランス調整）
const SHAPE_SCALES: Record<string, [number, number, number]> = {
  monolith: [1, 1, 1],        // 縦長モノリス (Intro)
  torusKnot: [1, 1, 1],       // トーラスノット (Career)
  sphere: [1.3, 1.3, 1.3],    // 球体 (Skills)
  cone: [1.2, 1.2, 1.2],      // コーン (Works)
}

export const MorphingShape: React.FC<MorphingShapeProps> = ({ scrollProgress }) => {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.LineSegments>(null)
  const glowRef = useRef<THREE.PointLight>(null)

  // 現在のセクションと遷移進捗
  const currentSection = Math.floor(scrollProgress * SHAPE_COUNT)
  const sectionProgress = (scrollProgress * SHAPE_COUNT) % 1

  // より特徴的なジオメトリを生成
  const geometries = useMemo(() => {
    return {
      // 0: モノリス - 縦長の直方体 (Intro)
      monolith: new THREE.BoxGeometry(1.2, 5, 0.8, 4, 10, 4),
      // 1: トーラスノット - 複雑な結び目 (Career)
      torusKnot: new THREE.TorusKnotGeometry(1.8, 0.5, 100, 24, 2, 3),
      // 2: 球体 - スムーズな形 (Skills)
      sphere: new THREE.SphereGeometry(2, 32, 32),
      // 3: コーン - 円錐形 (Works)
      cone: new THREE.ConeGeometry(2, 4, 6, 1),
    }
  }, [])

  // エッジジオメトリ
  const edgeGeometries = useMemo(() => {
    return {
      monolith: new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, 5.05, 0.85)),
      torusKnot: new THREE.EdgesGeometry(new THREE.TorusKnotGeometry(1.85, 0.55, 50, 12, 2, 3)),
      sphere: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.05, 2)),
      cone: new THREE.EdgesGeometry(new THREE.ConeGeometry(2.05, 4.05, 6, 1)),
    }
  }, [])

  const geometryKeys = ['monolith', 'torusKnot', 'sphere', 'cone'] as const

  // 頂点変形用のオリジナル位置
  const originalPositions = useRef<Map<string, Float32Array>>(new Map())

  // 現在のスケール値を保持
  const currentScale = useRef<[number, number, number]>([1, 1, 1])

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return

    const time = state.clock.elapsedTime
    const safeSection = Math.min(currentSection, SHAPE_COUNT - 1)
    const currentKey = geometryKeys[safeSection]

    // ジオメトリの切り替え（セクション変更時）
    const currentGeom = geometries[currentKey]
    if (meshRef.current.geometry !== currentGeom) {
      meshRef.current.geometry = currentGeom
      originalPositions.current.delete(currentKey)
    }

    // エッジジオメトリの更新
    if (wireRef.current) {
      const currentEdgeGeom = edgeGeometries[currentKey]
      if (wireRef.current.geometry !== currentEdgeGeom) {
        wireRef.current.geometry = currentEdgeGeom
      }
    }

    // 形状固有のスケールを取得
    const targetScale = SHAPE_SCALES[currentKey] || [1, 1, 1]

    // スムーズなスケール遷移
    currentScale.current[0] = THREE.MathUtils.lerp(currentScale.current[0], targetScale[0], 0.05)
    currentScale.current[1] = THREE.MathUtils.lerp(currentScale.current[1], targetScale[1], 0.05)
    currentScale.current[2] = THREE.MathUtils.lerp(currentScale.current[2], targetScale[2], 0.05)

    // 形状ごとに異なる回転パターン
    let targetRotX: number
    let targetRotY: number
    let targetRotZ: number

    switch (safeSection) {
      case 0: // モノリス - ゆっくり揺れる (Intro)
        targetRotX = Math.sin(time * 0.2) * 0.1
        targetRotY = Math.sin(time * 0.15) * 0.3
        targetRotZ = Math.sin(time * 0.1) * 0.05
        break
      case 1: // トーラスノット - 複雑な回転 (Career)
        targetRotX = Math.sin(time * 0.5) * 0.5
        targetRotY = time * 0.25
        targetRotZ = Math.sin(time * 0.35) * 0.2
        break
      case 2: // 球体 - 滑らかな回転 (Skills)
        targetRotX = Math.sin(time * 0.3) * 0.2
        targetRotY = time * 0.1
        targetRotZ = Math.cos(time * 0.2) * 0.1
        break
      case 3: // コーン - 傾いた回転 (Works)
        targetRotX = 0.3 + Math.sin(time * 0.25) * 0.15
        targetRotY = time * 0.15
        targetRotZ = Math.sin(time * 0.2) * 0.1
        break
      default:
        targetRotX = Math.sin(time * 0.3) * 0.2
        targetRotY = time * 0.15
        targetRotZ = Math.cos(time * 0.25) * 0.1
    }

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.02)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.02)
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, 0.02)

    // 浮遊アニメーション
    groupRef.current.position.y = Math.sin(time * 0.4) * 0.3

    // 頂点変形（呼吸するような動き）
    const positions = meshRef.current.geometry.attributes.position
    if (!originalPositions.current.has(currentKey)) {
      originalPositions.current.set(currentKey, new Float32Array(positions.array))
    }
    const original = originalPositions.current.get(currentKey)!

    for (let i = 0; i < positions.count; i++) {
      const ox = original[i * 3]
      const oy = original[i * 3 + 1]
      const oz = original[i * 3 + 2]

      // 波のようなうねり
      const dist = Math.sqrt(ox * ox + oy * oy + oz * oz)
      const wave1 = Math.sin(dist * 2 + time * 0.8) * 0.06
      const wave2 = Math.sin(oy * 3 + time * 0.6) * 0.04
      const wave3 = Math.cos(ox * 2 + time * 0.5) * 0.03
      const morphScale = 1 + wave1 + wave2 + wave3

      // セクション遷移時のスケール変動（形が縮んで広がる）
      const transitionPulse = Math.sin(sectionProgress * Math.PI) * 0.2
      const finalScale = morphScale * (1 - transitionPulse)

      positions.setXYZ(i, ox * finalScale, oy * finalScale, oz * finalScale)
    }
    positions.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()

    // スケールの脈動 + 形状固有スケール
    const basePulse = 1 + Math.sin(time * 1.5) * 0.03
    const transitionScale = 1 - Math.sin(sectionProgress * Math.PI) * 0.2
    meshRef.current.scale.set(
      currentScale.current[0] * basePulse * transitionScale,
      currentScale.current[1] * basePulse * transitionScale,
      currentScale.current[2] * basePulse * transitionScale
    )

    // ワイヤーフレームの逆回転
    if (wireRef.current) {
      wireRef.current.rotation.x = -groupRef.current.rotation.x * 0.3
      wireRef.current.rotation.y = -groupRef.current.rotation.y * 0.3
      wireRef.current.scale.set(
        currentScale.current[0] * basePulse * transitionScale * 1.02,
        currentScale.current[1] * basePulse * transitionScale * 1.02,
        currentScale.current[2] * basePulse * transitionScale * 1.02
      )
    }

    // グローの脈動
    if (glowRef.current) {
      glowRef.current.intensity = 0.5 + Math.sin(time * 2) * 0.3
    }
  })

  return (
    <group ref={groupRef}>
      {/* メインメッシュ */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <meshStandardMaterial
          color={MONOLITH_COLORS.accent}
          roughness={0.3}
          metalness={0.2}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* ワイヤーフレーム */}
      <lineSegments ref={wireRef}>
        <lineBasicMaterial
          color={MONOLITH_COLORS.offWhite}
          transparent
          opacity={0.4}
        />
      </lineSegments>

      {/* 内部グロー */}
      <pointLight
        ref={glowRef}
        color={MONOLITH_COLORS.accent}
        intensity={0.5}
        distance={10}
      />
    </group>
  )
}
