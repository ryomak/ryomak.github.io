import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CrystalProps {
  mouseX?: number
  mouseY?: number
}

export const Crystal: React.FC<CrystalProps> = ({
  mouseX = 0,
  mouseY = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const layer1Ref = useRef<THREE.Mesh>(null)
  const layer2Ref = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // Slow, elegant rotation
    if (layer1Ref.current) {
      layer1Ref.current.rotation.y += 0.001
      layer1Ref.current.rotation.x += 0.0005
    }
    if (layer2Ref.current) {
      layer2Ref.current.rotation.y -= 0.0008
      layer2Ref.current.rotation.z += 0.0006
    }

    // Core pulsing (breathing effect like Materia)
    if (coreRef.current) {
      const pulse = Math.sin(time * 0.5) * 0.15 + 1
      coreRef.current.scale.setScalar(pulse)
    }

    // Rotating aura rings (like FF10 sending scene)
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += 0.002
      ring1Ref.current.rotation.z += 0.001
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += 0.0015
      ring2Ref.current.rotation.x -= 0.001
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z -= 0.0012
      ring3Ref.current.rotation.y += 0.0008
    }

    // Mouse tracking - gentle movement
    if (groupRef.current) {
      groupRef.current.rotation.x += (mouseY * 0.2 - groupRef.current.rotation.x) * 0.02
      groupRef.current.rotation.y += (mouseX * 0.2 - groupRef.current.rotation.y) * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      {/* Outer glow sphere */}
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Layer 1 - Outer crystal (Lifestream green) */}
      <mesh ref={layer1Ref}>
        <icosahedronGeometry args={[2.5, 1]} />
        <meshBasicMaterial
          color="#00ff88"
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Layer 2 - Inner crystal (Blue) */}
      <mesh ref={layer2Ref} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
        <icosahedronGeometry args={[2.0, 1]} />
        <meshBasicMaterial
          color="#00ddff"
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Core - Materia-like glowing orb */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial
          color="#00ff99"
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Core inner glow */}
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Aura Ring 1 - like FF10 sending */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.02, 16, 64]} />
        <meshBasicMaterial
          color="#00ffaa"
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Aura Ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[3.5, 0.015, 16, 64]} />
        <meshBasicMaterial
          color="#00ddff"
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Aura Ring 3 */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 4, 0, Math.PI / 3]}>
        <torusGeometry args={[3.8, 0.01, 16, 64]} />
        <meshBasicMaterial
          color="#88ffcc"
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Point lights for glow */}
      <pointLight color="#00ff88" intensity={1} distance={15} />
      <pointLight color="#00ddff" intensity={0.5} distance={10} position={[2, 2, 0]} />
    </group>
  )
}
