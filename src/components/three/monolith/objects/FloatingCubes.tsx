import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONOLITH_COLORS } from '../constants'

interface CubeData {
  position: [number, number, number]
  size: number
  rotationSpeed: number
  floatSpeed: number
  floatOffset: number
  orbitSpeed: number
  orbitRadius: number
  isAccent: boolean
}

interface FloatingCubesProps {
  position?: [number, number, number]
  visible?: boolean
  opacity?: number
  scale?: number
  yOffset?: number
}

export const FloatingCubes: React.FC<FloatingCubesProps> = ({
  position = [0, 0, 0],
  visible = true,
  opacity = 1,
  scale = 1,
  yOffset = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])

  // 遷移用の現在値
  const currentValues = useRef({ opacity: 1, scale: 1, yOffset: 0 })

  const cubes = useMemo<CubeData[]>(() => {
    const data: CubeData[] = []
    const count = 8

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 2 + Math.random() * 1.5
      const height = (Math.random() - 0.5) * 3

      data.push({
        position: [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        ],
        size: 0.4 + Math.random() * 0.6,
        rotationSpeed: 0.003 + Math.random() * 0.005,
        floatSpeed: 0.8 + Math.random() * 0.4,
        floatOffset: Math.random() * Math.PI * 2,
        orbitSpeed: 0.1 + Math.random() * 0.1,
        orbitRadius: radius,
        isAccent: i === 0,
      })
    }

    return data
  }, [])

  useFrame((state) => {
    if (!groupRef.current || !visible) return

    const time = state.clock.elapsedTime

    // スムーズな遷移値の補間
    currentValues.current.opacity = THREE.MathUtils.lerp(currentValues.current.opacity, opacity, 0.08)
    currentValues.current.scale = THREE.MathUtils.lerp(currentValues.current.scale, scale, 0.06)
    currentValues.current.yOffset = THREE.MathUtils.lerp(currentValues.current.yOffset, yOffset, 0.05)

    const transitionScale = currentValues.current.scale

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const cube = cubes[i]

      // スムーズな軌道運動
      const angle = (i / cubes.length) * Math.PI * 2 + time * cube.orbitSpeed
      const targetX = Math.cos(angle) * cube.orbitRadius
      const targetZ = Math.sin(angle) * cube.orbitRadius

      // ぬるっとした位置補間
      mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, targetX, 0.02)
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, targetZ, 0.02)

      // 有機的な浮遊（複数のsin波を合成）
      const float1 = Math.sin(time * cube.floatSpeed + cube.floatOffset) * 0.3
      const float2 = Math.sin(time * cube.floatSpeed * 0.7 + cube.floatOffset * 2) * 0.15
      const targetY = cube.position[1] + float1 + float2
      mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, targetY, 0.03)

      // ぬるっとした回転
      mesh.rotation.x += cube.rotationSpeed
      mesh.rotation.y += cube.rotationSpeed * 0.7
      mesh.rotation.z = Math.sin(time * 0.5 + i) * 0.1

      // スケールの脈動 + 遷移スケール
      const pulse = 1 + Math.sin(time * 2 + i * 0.5) * 0.05
      mesh.scale.setScalar(cube.size * pulse * transitionScale)

      // マテリアルの不透明度更新
      const material = mesh.material as THREE.MeshStandardMaterial
      if (material) {
        material.opacity = currentValues.current.opacity
        material.transparent = true
      }
    })

    // グループ全体のうねり + Y位置オフセット
    groupRef.current.rotation.y = Math.sin(time * 0.1) * 0.2
    groupRef.current.position.y = Math.sin(time * 0.3) * 0.1 + currentValues.current.yOffset
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {cubes.map((cube, i) => (
        <mesh
          key={i}
          ref={(el) => (meshRefs.current[i] = el)}
          position={cube.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1, 2, 2, 2]} />
          <meshStandardMaterial
            color={cube.isAccent ? MONOLITH_COLORS.accent : MONOLITH_COLORS.midGray}
            roughness={cube.isAccent ? 0.3 : 0.85}
            metalness={cube.isAccent ? 0.2 : 0.05}
            emissive={cube.isAccent ? MONOLITH_COLORS.accent : '#000000'}
            emissiveIntensity={cube.isAccent ? 0.4 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}
