import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { MONOLITH_COLORS } from '../constants'

interface SlabData {
  name: string
  desc: string
  url: string
}

interface FracturedSlabsProps {
  position?: [number, number, number]
  visible?: boolean
  opacity?: number
  scale?: number
  yOffset?: number
}

const PROJECTS: SlabData[] = [
  { name: 'serrs', desc: 'Go error handling', url: 'https://github.com/ryomak/serrs' },
  { name: 'gogener', desc: 'Go generics codegen', url: 'https://github.com/ryomak/gogener' },
  { name: 'p5go', desc: 'Processing for Go', url: 'https://github.com/ryomak/p5go' },
]

interface SlabProps {
  data: SlabData
  index: number
  totalCount: number
  hovered: boolean
  onHover: (hover: boolean) => void
  time: number
  transitionOpacity: number
}

const Slab: React.FC<SlabProps> = ({ data, index, totalCount, hovered, onHover, time, transitionOpacity }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const baseY = (index - (totalCount - 1) / 2) * 1.8

  useFrame(() => {
    if (!meshRef.current) return

    // 有機的な浮遊（複数波合成）
    const float1 = Math.sin(time * 0.6 + index * 1.2) * 0.15
    const float2 = Math.cos(time * 0.4 + index * 0.8) * 0.08
    const floatOffset = float1 + float2

    // ホバー時は広がる
    const targetY = hovered ? baseY * 1.5 : baseY
    meshRef.current.position.y = THREE.MathUtils.lerp(
      meshRef.current.position.y,
      targetY + floatOffset,
      0.04
    )

    // ホバー時は少し前に出る
    const targetZ = hovered ? 0.8 : 0
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetZ,
      0.06
    )

    // ぬるっとした回転
    const targetRotX = Math.sin(time * 0.3 + index) * 0.05 + (hovered ? 0.05 : 0)
    const targetRotZ = Math.cos(time * 0.25 + index * 0.5) * 0.03
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.03)
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotZ, 0.03)

    // スケールの脈動
    const pulse = 1 + Math.sin(time * 1.5 + index * 0.7) * 0.02
    const hoverScale = hovered ? 1.05 : 1
    meshRef.current.scale.setScalar(pulse * hoverScale)

    // マテリアルの不透明度
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    if (material) {
      material.opacity = transitionOpacity
      material.transparent = true
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, baseY, 0]}
      castShadow
      receiveShadow
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
      onClick={() => window.open(data.url, '_blank')}
    >
      <boxGeometry args={[4, 0.15, 2]} />
      <meshStandardMaterial
        color={hovered ? MONOLITH_COLORS.lightGray : MONOLITH_COLORS.midGray}
        roughness={0.8}
        metalness={0.1}
        emissive={hovered ? MONOLITH_COLORS.accent : '#000000'}
        emissiveIntensity={hovered ? 0.3 : 0}
      />

      {/* プロジェクト名（HTML overlay） */}
      <Html
        position={[0, 0.2, 0]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: transitionOpacity,
        }}
      >
        <div
          style={{
            color: hovered ? MONOLITH_COLORS.accent : MONOLITH_COLORS.offWhite,
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transition: 'all 0.3s ease',
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {data.name}
        </div>
      </Html>
    </mesh>
  )
}

export const FracturedSlabs: React.FC<FracturedSlabsProps> = ({
  position = [0, 0, 0],
  visible = true,
  opacity = 1,
  scale = 1,
  yOffset = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const edgeRef = useRef<THREE.Mesh>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const timeRef = useRef(0)

  // 遷移用の現在値
  const currentValues = useRef({ opacity: 1, scale: 1, yOffset: 0 })

  useFrame((state) => {
    if (!groupRef.current || !visible) return

    timeRef.current = state.clock.elapsedTime
    const time = timeRef.current

    // スムーズな遷移値の補間
    currentValues.current.opacity = THREE.MathUtils.lerp(currentValues.current.opacity, opacity, 0.08)
    currentValues.current.scale = THREE.MathUtils.lerp(currentValues.current.scale, scale, 0.06)
    currentValues.current.yOffset = THREE.MathUtils.lerp(currentValues.current.yOffset, yOffset, 0.05)

    // グループ全体のぬるっとした動き
    const targetRotY = Math.sin(time * 0.15) * 0.15
    const targetRotX = Math.sin(time * 0.1) * 0.05
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.02)
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.02)

    // 全体の浮遊 + Y位置オフセット
    groupRef.current.position.y = Math.sin(time * 0.25) * 0.15 + currentValues.current.yOffset

    // グループにスケール適用
    groupRef.current.scale.setScalar(currentValues.current.scale)

    // エッジの脈動
    if (edgeRef.current) {
      const edgePulse = 1 + Math.sin(time * 2) * 0.1
      edgeRef.current.scale.y = edgePulse

      // エッジの不透明度
      const edgeMaterial = edgeRef.current.material as THREE.MeshStandardMaterial
      if (edgeMaterial) {
        edgeMaterial.opacity = currentValues.current.opacity
        edgeMaterial.transparent = true
      }
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {PROJECTS.map((project, i) => (
        <Slab
          key={project.name}
          data={project}
          index={i}
          totalCount={PROJECTS.length}
          hovered={hoveredIndex === i}
          onHover={(hover) => setHoveredIndex(hover ? i : null)}
          time={timeRef.current}
          transitionOpacity={currentValues.current.opacity}
        />
      ))}

      {/* アクセントエッジ */}
      <mesh ref={edgeRef} position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 6, 8]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.accent}
          emissive={MONOLITH_COLORS.accent}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  )
}
