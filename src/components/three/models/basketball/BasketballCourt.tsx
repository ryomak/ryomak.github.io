import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition } from '../VoxelUtils'

// NBA Court Colors
const COURT_COLORS = {
  wood: '#deb887',      // Burlywood - court wood
  woodDark: '#cd853f',  // Peru - wood grain
  woodLight: '#f5deb3', // Wheat - light wood
  line: '#ffffff',      // White lines
  paint: '#c41e3a',     // Red paint area (can be team color)
  centerCircle: '#1e90ff', // Team accent
  threePoint: '#ffffff',
}

// NBA規格: コート 28.65m x 15.24m (94ft x 50ft)
// 1voxel = 0.15m (15cm) として計算
// コート長 = 28.65m / 0.15m = 191 voxels
// コート幅 = 15.24m / 0.15m = 102 voxels
export const VOXEL_SIZE_M = 0.15 // 1voxelが表す実際のメートル数
export const COURT_LENGTH_VOXELS = 191 // ハーフは95.5
export const COURT_WIDTH_VOXELS = 102  // ハーフは51

interface BasketballCourtProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  teamColor?: string
  animated?: boolean
}

export const BasketballCourt: React.FC<BasketballCourtProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  teamColor = '#c41e3a',
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []

    // より細かいドットでコートを表現
    // 実際のNBAコート: 28.65m x 15.24m
    // 1voxel = 15cm として計算
    const halfLength = 96 // 約14.4m (コート半分)
    const halfWidth = 51  // 約7.6m (コート半分)

    // Court floor - wood pattern (間引いて描画、パフォーマンス考慮)
    for (let x = -halfLength; x <= halfLength; x += 2) {
      for (let z = -halfWidth; z <= halfWidth; z += 2) {
        // Wood grain pattern
        const isGrain = (x + z) % 8 === 0
        const color = isGrain ? COURT_COLORS.woodDark :
                      ((x + z) % 4 === 0 ? COURT_COLORS.wood : COURT_COLORS.woodLight)
        result.push({ x, y: 0, z, color })
        result.push({ x: x + 1, y: 0, z, color })
        result.push({ x, y: 0, z: z + 1, color })
        result.push({ x: x + 1, y: 0, z: z + 1, color })
      }
    }

    // Court boundary lines (白線 - 5cm幅を2voxelで表現)
    // Sidelines
    for (let x = -halfLength; x <= halfLength; x++) {
      result.push({ x, y: 0.5, z: -halfWidth, color: COURT_COLORS.line })
      result.push({ x, y: 0.5, z: -halfWidth + 1, color: COURT_COLORS.line })
      result.push({ x, y: 0.5, z: halfWidth, color: COURT_COLORS.line })
      result.push({ x, y: 0.5, z: halfWidth - 1, color: COURT_COLORS.line })
    }
    // Baselines
    for (let z = -halfWidth; z <= halfWidth; z++) {
      result.push({ x: -halfLength, y: 0.5, z, color: COURT_COLORS.line })
      result.push({ x: -halfLength + 1, y: 0.5, z, color: COURT_COLORS.line })
      result.push({ x: halfLength, y: 0.5, z, color: COURT_COLORS.line })
      result.push({ x: halfLength - 1, y: 0.5, z, color: COURT_COLORS.line })
    }

    // Center line
    for (let z = -halfWidth; z <= halfWidth; z++) {
      result.push({ x: 0, y: 0.5, z, color: COURT_COLORS.line })
      result.push({ x: 1, y: 0.5, z, color: COURT_COLORS.line })
    }

    // Center circle (直径3.66m = 24voxels, 半径12voxels)
    const centerRadius = 12
    for (let angle = 0; angle < 360; angle += 3) {
      const rad = (angle * Math.PI) / 180
      const cx = Math.round(Math.cos(rad) * centerRadius)
      const cz = Math.round(Math.sin(rad) * centerRadius)
      result.push({ x: cx, y: 0.5, z: cz, color: COURT_COLORS.centerCircle })
    }
    // Fill center circle
    for (let x = -centerRadius + 2; x <= centerRadius - 2; x++) {
      for (let z = -centerRadius + 2; z <= centerRadius - 2; z++) {
        if (x * x + z * z <= (centerRadius - 2) * (centerRadius - 2)) {
          result.push({ x, y: 0.3, z, color: teamColor })
        }
      }
    }

    // Three-point line (両サイド)
    // NBA 3ポイントライン: アーク部分7.24m(48voxels), コーナー6.7m(45voxels)
    const threePointRadius = 48
    const threePointCornerDistance = 9 // コーナーからの距離
    for (const side of [-1, 1]) {
      const basketX = side * (halfLength - 10) // バスケット位置

      // Arc (3ポイントアーク)
      for (let angle = -68; angle <= 68; angle += 2) {
        const rad = (angle * Math.PI) / 180
        const tx = basketX + Math.round(Math.cos(rad) * threePointRadius * side * -1)
        const tz = Math.round(Math.sin(rad) * threePointRadius)
        if (Math.abs(tx) <= halfLength && Math.abs(tz) <= halfWidth) {
          result.push({ x: tx, y: 0.5, z: tz, color: COURT_COLORS.threePoint })
        }
      }

      // Corner lines
      for (let z = -halfWidth; z <= -threePointRadius + 5; z++) {
        result.push({ x: basketX + side * threePointCornerDistance, y: 0.5, z, color: COURT_COLORS.threePoint })
      }
      for (let z = threePointRadius - 5; z <= halfWidth; z++) {
        result.push({ x: basketX + side * threePointCornerDistance, y: 0.5, z, color: COURT_COLORS.threePoint })
      }
    }

    // Paint area (key) - 両サイド
    // ペイントエリア: 4.88m x 5.79m (32 x 39 voxels)
    const paintHalfWidth = 16
    const paintLength = 39
    for (const side of [-1, 1]) {
      const paintStart = side * halfLength
      const paintEnd = side * (halfLength - paintLength)

      // Paint fill
      for (let x = Math.min(paintStart, paintEnd); x <= Math.max(paintStart, paintEnd); x++) {
        for (let z = -paintHalfWidth; z <= paintHalfWidth; z++) {
          result.push({ x, y: 0.2, z, color: teamColor })
        }
      }

      // Free throw line
      for (let z = -paintHalfWidth; z <= paintHalfWidth; z++) {
        result.push({ x: paintEnd, y: 0.5, z, color: COURT_COLORS.line })
      }

      // Free throw circle (直径3.66m = 24voxels)
      const ftRadius = 12
      for (let angle = 0; angle < 360; angle += 5) {
        const rad = (angle * Math.PI) / 180
        const fx = Math.round(paintEnd + Math.cos(rad) * ftRadius * side * -1)
        const fz = Math.round(Math.sin(rad) * ftRadius)
        result.push({ x: fx, y: 0.5, z: fz, color: COURT_COLORS.line })
      }
    }

    return result
  }, [teamColor])

  useFrame((state) => {
    if (!animated || !groupRef.current) return
    // Subtle animation
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02
  })

  // voxel size 0.04 (統一サイズ)
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.04} receiveShadow />
    </group>
  )
}
