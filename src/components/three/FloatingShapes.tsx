import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FloatingShapeProps {
  position: [number, number, number]
  color: string
  geometry: 'box' | 'tetrahedron' | 'octahedron'
  size?: number
  rotationSpeed?: { x: number; y: number }
  mouseX?: number
  mouseY?: number
  enableMouseTracking?: boolean
}

const FloatingShape: React.FC<FloatingShapeProps> = ({
  position,
  color,
  geometry,
  size = 0.4,
  rotationSpeed = { x: 0.005, y: 0.008 },
  mouseX = 0,
  mouseY = 0,
  enableMouseTracking = true,
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const basePosition = useRef(new THREE.Vector3(...position))
  const time = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!meshRef.current) return

    meshRef.current.rotation.x += rotationSpeed.x
    meshRef.current.rotation.y += rotationSpeed.y

    time.current += delta * 0.5
    const floatOffset = Math.sin(time.current) * 0.1
    meshRef.current.position.y = basePosition.current.y + floatOffset

    if (enableMouseTracking) {
      const targetX = basePosition.current.x + mouseX * 0.3
      const targetZ = basePosition.current.z + mouseY * 0.2
      meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.05
      meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.05
    }
  })

  const GeometryComponent = useMemo(() => {
    switch (geometry) {
      case 'box':
        return <boxGeometry args={[size, size, size]} />
      case 'tetrahedron':
        return <tetrahedronGeometry args={[size * 0.8]} />
      case 'octahedron':
        return <octahedronGeometry args={[size * 0.7]} />
      default:
        return <boxGeometry args={[size, size, size]} />
    }
  }, [geometry, size])

  return (
    <mesh ref={meshRef} position={position}>
      {GeometryComponent}
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

interface FloatingShapesProps {
  mouseX?: number
  mouseY?: number
  enableMouseTracking?: boolean
  colorPrimary?: string
  colorSecondary?: string
}

export const FloatingShapes: React.FC<FloatingShapesProps> = ({
  mouseX = 0,
  mouseY = 0,
  enableMouseTracking = true,
  colorPrimary = '#00F5D4',
  colorSecondary = '#9B5DE5',
}) => {
  const shapes = useMemo(() => [
    {
      position: [-2.2, 0.8, -1] as [number, number, number],
      color: colorPrimary,
      geometry: 'box' as const,
      rotationSpeed: { x: 0.005, y: 0.008 },
    },
    {
      position: [2.2, -0.5, -0.5] as [number, number, number],
      color: colorSecondary,
      geometry: 'tetrahedron' as const,
      rotationSpeed: { x: 0.006, y: -0.007 },
    },
    {
      position: [0, 1.8, -1.5] as [number, number, number],
      color: colorPrimary,
      geometry: 'octahedron' as const,
      rotationSpeed: { x: 0.004, y: 0.005 },
    },
  ], [colorPrimary, colorSecondary])

  return (
    <group>
      {shapes.map((shape, index) => (
        <FloatingShape
          key={index}
          {...shape}
          mouseX={mouseX}
          mouseY={mouseY}
          enableMouseTracking={enableMouseTracking}
        />
      ))}
    </group>
  )
}
