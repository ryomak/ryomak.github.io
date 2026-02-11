import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface WireframeSphereProps {
  radius?: number
  wireframeOpacity?: number
  rotationSpeed?: number
  colorPrimary?: string
  colorSecondary?: string
  colorAccent?: string
  mouseX?: number
  mouseY?: number
  enableMouseTracking?: boolean
}

export const WireframeSphere: React.FC<WireframeSphereProps> = ({
  radius = 4.5,
  wireframeOpacity = 0.5,
  rotationSpeed = 0.003,
  colorPrimary = '#00F5D4',
  colorSecondary = '#9B5DE5',
  colorAccent = '#FF006E',
  mouseX = 0,
  mouseY = 0,
  enableMouseTracking = true,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const layer1Ref = useRef<THREE.Mesh>(null)
  const layer2Ref = useRef<THREE.Mesh>(null)
  const layer3Ref = useRef<THREE.Mesh>(null)
  const layer4Ref = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  const targetRotationX = useRef(0)
  const baseSpeed = useRef(rotationSpeed)

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const mouseIntensity = Math.sqrt(mouseX * mouseX + mouseY * mouseY)
    const speedMultiplier = 1 + mouseIntensity * 2

    if (layer1Ref.current) {
      layer1Ref.current.rotation.y += rotationSpeed * speedMultiplier
      layer1Ref.current.rotation.x += rotationSpeed * 0.3 * speedMultiplier
    }
    if (layer2Ref.current) {
      layer2Ref.current.rotation.y -= rotationSpeed * 0.7 * speedMultiplier
      layer2Ref.current.rotation.z += rotationSpeed * 0.5 * speedMultiplier
    }
    if (layer3Ref.current) {
      layer3Ref.current.rotation.y += rotationSpeed * 0.5 * speedMultiplier
      layer3Ref.current.rotation.x -= rotationSpeed * 0.4 * speedMultiplier
    }
    if (layer4Ref.current) {
      layer4Ref.current.rotation.z -= rotationSpeed * 0.8 * speedMultiplier
      layer4Ref.current.rotation.y += rotationSpeed * 0.3 * speedMultiplier
    }

    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1
      glowRef.current.scale.setScalar(pulse)
    }

    if (enableMouseTracking) {
      targetRotationX.current = mouseY * 0.5
      const targetRotationY = mouseX * 0.5

      groupRef.current.rotation.x +=
        (targetRotationX.current - groupRef.current.rotation.x) * 0.08
      groupRef.current.rotation.y +=
        (targetRotationY - groupRef.current.rotation.y) * 0.08
    }
  })

  return (
    <group ref={groupRef}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.2, 32, 32]} />
        <meshBasicMaterial
          color={colorPrimary}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Layer 1 - Outermost */}
      <mesh ref={layer1Ref}>
        <icosahedronGeometry args={[radius, 2]} />
        <meshBasicMaterial
          color={colorPrimary}
          wireframe
          transparent
          opacity={wireframeOpacity}
        />
      </mesh>

      {/* Layer 2 */}
      <mesh ref={layer2Ref} rotation={[Math.PI / 6, Math.PI / 4, 0]}>
        <icosahedronGeometry args={[radius * 0.85, 2]} />
        <meshBasicMaterial
          color={colorSecondary}
          wireframe
          transparent
          opacity={wireframeOpacity * 0.8}
        />
      </mesh>

      {/* Layer 3 */}
      <mesh ref={layer3Ref} rotation={[Math.PI / 3, 0, Math.PI / 5]}>
        <icosahedronGeometry args={[radius * 0.7, 1]} />
        <meshBasicMaterial
          color={colorAccent}
          wireframe
          transparent
          opacity={wireframeOpacity * 0.6}
        />
      </mesh>

      {/* Layer 4 - Core */}
      <mesh ref={layer4Ref} rotation={[0, Math.PI / 3, Math.PI / 4]}>
        <octahedronGeometry args={[radius * 0.4]} />
        <meshBasicMaterial
          color={colorPrimary}
          wireframe
          transparent
          opacity={wireframeOpacity * 0.9}
        />
      </mesh>

      {/* Inner glow core */}
      <mesh>
        <sphereGeometry args={[radius * 0.15, 16, 16]} />
        <meshBasicMaterial
          color={colorPrimary}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Point lights for glow effect */}
      <pointLight color={colorPrimary} intensity={0.5} distance={10} />
      <pointLight color={colorSecondary} intensity={0.3} distance={8} position={[2, 2, 2]} />
    </group>
  )
}
