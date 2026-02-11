import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

interface DataBit {
  position: THREE.Vector3
  progress: number
  speed: number
  direction: number
}

interface ConnectionLineProps {
  start: [number, number, number]
  end: [number, number, number]
  color: string
  opacity?: number
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  start,
  end,
  color,
  opacity = 0.3,
}) => {
  const points = useMemo(() => {
    return [start, end] as [number, number, number][]
  }, [start, end])

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={opacity}
    />
  )
}

interface DataBitsProps {
  start: [number, number, number]
  end: [number, number, number]
  color: string
  count?: number
}

const DataBits: React.FC<DataBitsProps> = ({
  start,
  end,
  color,
  count = 5,
}) => {
  const pointsRef = useRef<THREE.Points>(null)
  const startVec = useMemo(() => new THREE.Vector3(...start), [start])
  const endVec = useMemo(() => new THREE.Vector3(...end), [end])

  const { positions, bits } = useMemo(() => {
    const posArray = new Float32Array(count * 3)
    const bitsArray: DataBit[] = []

    for (let i = 0; i < count; i++) {
      const progress = i / count
      const pos = new THREE.Vector3().lerpVectors(startVec, endVec, progress)
      posArray[i * 3] = pos.x
      posArray[i * 3 + 1] = pos.y
      posArray[i * 3 + 2] = pos.z

      bitsArray.push({
        position: pos,
        progress,
        speed: 0.3 + Math.random() * 0.2,
        direction: Math.random() > 0.5 ? 1 : -1,
      })
    }

    return { positions: posArray, bits: bitsArray }
  }, [startVec, endVec, count])

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    const positionAttribute = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute

    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i]
      bit.progress += delta * bit.speed * bit.direction

      if (bit.progress > 1) {
        bit.progress = 0
      } else if (bit.progress < 0) {
        bit.progress = 1
      }

      const pos = new THREE.Vector3().lerpVectors(startVec, endVec, bit.progress)
      positionAttribute.setXYZ(i, pos.x, pos.y, pos.z)
    }

    positionAttribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  )
}

interface DataStreamProps {
  colorPrimary?: string
  colorSecondary?: string
}

export const DataStream: React.FC<DataStreamProps> = ({
  colorPrimary = '#00F5D4',
  colorSecondary = '#9B5DE5',
}) => {
  const connections = useMemo(() => [
    {
      start: [-2.2, 0.8, -1] as [number, number, number],
      end: [2.2, -0.5, -0.5] as [number, number, number],
      color: colorPrimary,
    },
    {
      start: [2.2, -0.5, -0.5] as [number, number, number],
      end: [0, 1.8, -1.5] as [number, number, number],
      color: colorSecondary,
    },
    {
      start: [0, 1.8, -1.5] as [number, number, number],
      end: [-2.2, 0.8, -1] as [number, number, number],
      color: colorPrimary,
    },
  ], [colorPrimary, colorSecondary])

  return (
    <group>
      {connections.map((conn, index) => (
        <group key={index}>
          <ConnectionLine
            start={conn.start}
            end={conn.end}
            color={conn.color}
            opacity={0.2}
          />
          <DataBits
            start={conn.start}
            end={conn.end}
            color={conn.color}
            count={4}
          />
        </group>
      ))}
    </group>
  )
}
