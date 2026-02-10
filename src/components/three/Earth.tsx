import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface EarthProps {
  scrollProgress: number
}

// Convert lat/lng to 3D position on sphere
const latLngToVector3 = (lat: number, lng: number, radius: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Location data for each section
export const LOCATIONS = [
  { id: 'intro', lat: 35.6762, lng: 139.6503, label: 'Tokyo', section: 0 }, // Tokyo - Intro
  { id: 'about', lat: 34.6937, lng: 135.5023, label: 'Osaka', section: 1 }, // Osaka - About
  { id: 'career', lat: 35.0116, lng: 135.7681, label: 'Kyoto', section: 2 }, // Kyoto - Career
  { id: 'skills', lat: 43.0618, lng: 141.3545, label: 'Sapporo', section: 3 }, // Sapporo - Skills
  { id: 'works', lat: 33.5904, lng: 130.4017, label: 'Fukuoka', section: 4 }, // Fukuoka - Works
]

export const Earth: React.FC<EarthProps> = ({ scrollProgress }) => {
  const earthRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const markersRef = useRef<THREE.Group>(null)

  // Create grid lines for earth (latitude/longitude)
  const gridLines = useMemo(() => {
    const lines: THREE.Vector3[][] = []
    const radius = 2

    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = []
      for (let lng = 0; lng <= 360; lng += 5) {
        points.push(latLngToVector3(lat, lng, radius))
      }
      lines.push(points)
    }

    // Longitude lines
    for (let lng = 0; lng < 360; lng += 30) {
      const points: THREE.Vector3[] = []
      for (let lat = -90; lat <= 90; lat += 5) {
        points.push(latLngToVector3(lat, lng, radius))
      }
      lines.push(points)
    }

    return lines
  }, [])

  useFrame((state) => {
    if (!earthRef.current) return

    // Slow rotation
    earthRef.current.rotation.y += 0.001

    // Glow pulsing
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 1
      glowRef.current.scale.setScalar(pulse * 2.3)
    }

    // Animate markers
    if (markersRef.current) {
      markersRef.current.children.forEach((marker, i) => {
        const markerMesh = marker as THREE.Mesh
        const baseScale = 0.08
        const activeSection = Math.floor(scrollProgress * LOCATIONS.length)

        if (i === activeSection) {
          const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.02 + baseScale * 1.5
          markerMesh.scale.setScalar(pulse)
        } else {
          markerMesh.scale.setScalar(baseScale)
        }
      })
    }
  })

  return (
    <group ref={earthRef}>
      {/* Earth glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.3, 32, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Earth core sphere */}
      <mesh>
        <sphereGeometry args={[1.98, 64, 64]} />
        <meshBasicMaterial
          color="#001a0d"
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Grid lines - using points for compatibility */}
      {gridLines.map((points, i) => (
        <points key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial color="#00ff88" transparent opacity={0.3} size={0.02} sizeAttenuation />
        </points>
      ))}

      {/* Location markers */}
      <group ref={markersRef}>
        {LOCATIONS.map((loc, i) => {
          const pos = latLngToVector3(loc.lat, loc.lng, 2.05)
          return (
            <mesh key={loc.id} position={pos}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial
                color={i === Math.floor(scrollProgress * LOCATIONS.length) ? '#00ffaa' : '#00ff88'}
                transparent
                opacity={0.9}
              />
            </mesh>
          )
        })}
      </group>

      {/* Atmosphere ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.15, 64]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Lights */}
      <pointLight color="#00ff88" intensity={1} distance={20} />
    </group>
  )
}
