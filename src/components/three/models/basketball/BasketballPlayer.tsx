import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition } from '../VoxelUtils'

// Player team colors
const TEAM_COLORS = {
  lakers: { jersey: '#552583', shorts: '#FDB927', trim: '#FDB927' },
  bulls: { jersey: '#CE1141', shorts: '#CE1141', trim: '#000000' },
  warriors: { jersey: '#1D428A', shorts: '#1D428A', trim: '#FFC72C' },
  celtics: { jersey: '#007A33', shorts: '#007A33', trim: '#FFFFFF' },
  heat: { jersey: '#98002E', shorts: '#000000', trim: '#F9A01B' },
}

const SKIN_TONES = {
  light: '#ffdbac',
  medium: '#c68642',
  dark: '#8d5524',
}

// NBA選手の平均身長 約2m = 40voxels (1voxel = 5cm)
// より細かいドットで人体を表現
export const PLAYER_HEIGHT_VOXELS = 40

interface BasketballPlayerProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  team?: keyof typeof TEAM_COLORS
  skinTone?: keyof typeof SKIN_TONES
  pose?: 'standing' | 'shooting' | 'dribbling' | 'jumping' | 'running'
  number?: number
  animated?: boolean
}

export const BasketballPlayer: React.FC<BasketballPlayerProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  team = 'lakers',
  skinTone = 'medium',
  pose = 'standing',
  number = 23,
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const animationOffset = useRef(Math.random() * Math.PI * 2)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const colors = TEAM_COLORS[team]
    const skin = SKIN_TONES[skinTone]
    const hair = '#1a1a1a'
    const shoes = '#ffffff'
    const shoeSole = '#222222'

    // Height offset based on pose
    let heightOffset = 0
    if (pose === 'jumping') {
      heightOffset = 8
    }

    // より細かい人体表現 (40voxels高 = 約2m)
    // 頭: y=34-39 (6voxels = 30cm)
    // 首: y=33
    // 上半身: y=22-32 (11voxels = 55cm)
    // 下半身(ショーツ): y=16-21 (6voxels = 30cm)
    // 脚: y=4-15 (12voxels = 60cm)
    // 足: y=0-3 (4voxels = 20cm)

    // === 頭 (より丸い形に) ===
    // 頭部ベース (5x5x5の球形に近い形)
    for (let x = -2; x <= 2; x++) {
      for (let y = 34; y <= 39; y++) {
        for (let z = -2; z <= 2; z++) {
          // 球形に近づけるためエッジを削る
          const distSq = x * x + (y - 36.5) * (y - 36.5) * 0.5 + z * z
          if (distSq <= 6) {
            result.push({ x, y: y + heightOffset, z, color: skin })
          }
        }
      }
    }

    // 髪の毛 (頭頂部)
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (x * x + z * z <= 4) {
          result.push({ x, y: 40 + heightOffset, z, color: hair })
          result.push({ x, y: 39 + heightOffset, z, color: hair })
        }
      }
    }
    // 髪の毛サイド
    for (let y = 37; y <= 39; y++) {
      for (let x = -2; x <= 2; x++) {
        result.push({ x, y: y + heightOffset, z: -3, color: hair })
      }
    }

    // 目
    result.push({ x: -1, y: 36 + heightOffset, z: 3, color: '#ffffff' })
    result.push({ x: 1, y: 36 + heightOffset, z: 3, color: '#ffffff' })
    result.push({ x: -1, y: 36 + heightOffset, z: 4, color: '#1a1a1a' })
    result.push({ x: 1, y: 36 + heightOffset, z: 4, color: '#1a1a1a' })

    // 口
    result.push({ x: 0, y: 35 + heightOffset, z: 3, color: '#cc6666' })

    // === 首 ===
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        result.push({ x, y: 33 + heightOffset, z, color: skin })
      }
    }

    // === 上半身 (ジャージ) ===
    // 肩幅を広く、腰を細く
    for (let y = 22; y <= 32; y++) {
      // 肩から腰にかけて幅を変える
      const width = y >= 30 ? 4 : (y >= 26 ? 3 : 2)
      for (let x = -width; x <= width; x++) {
        for (let z = -2; z <= 2; z++) {
          // 胴体の丸みを出す
          if (x * x + z * z <= width * width + 2) {
            result.push({ x, y: y + heightOffset, z, color: colors.jersey })
          }
        }
      }
    }

    // ジャージの番号 (背中)
    if (number >= 10) {
      // 二桁
      result.push({ x: -1, y: 28 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: -1, y: 27 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: -1, y: 26 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: 1, y: 28 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: 1, y: 27 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: 1, y: 26 + heightOffset, z: -3, color: colors.trim })
    } else {
      // 一桁
      result.push({ x: 0, y: 28 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: 0, y: 27 + heightOffset, z: -3, color: colors.trim })
      result.push({ x: 0, y: 26 + heightOffset, z: -3, color: colors.trim })
    }

    // === 腕 ===
    const armPose = {
      standing: { leftY: [25, 26, 27, 28, 29, 30], rightY: [25, 26, 27, 28, 29, 30], leftX: -5, rightX: 5, leftZ: 0, rightZ: 0 },
      shooting: { leftY: [27, 28, 29, 30, 31], rightY: [30, 31, 32, 33, 34], leftX: -5, rightX: 5, leftZ: 1, rightZ: 3 },
      dribbling: { leftY: [25, 26, 27, 28, 29, 30], rightY: [20, 21, 22, 23, 24], leftX: -5, rightX: 5, leftZ: 0, rightZ: 2 },
      jumping: { leftY: [28, 29, 30, 31, 32], rightY: [28, 29, 30, 31, 32], leftX: -6, rightX: 6, leftZ: 0, rightZ: 0 },
      running: { leftY: [26, 27, 28, 29, 30], rightY: [24, 25, 26, 27, 28], leftX: -5, rightX: 5, leftZ: 2, rightZ: -2 },
    }

    const arm = armPose[pose]
    // Left arm
    arm.leftY.forEach((y, i) => {
      result.push({ x: arm.leftX, y: y + heightOffset, z: arm.leftZ + Math.floor(i / 3), color: skin })
      result.push({ x: arm.leftX - 1, y: y + heightOffset, z: arm.leftZ + Math.floor(i / 3), color: skin })
    })
    // Right arm
    arm.rightY.forEach((y, i) => {
      result.push({ x: arm.rightX, y: y + heightOffset, z: arm.rightZ + Math.floor(i / 3), color: skin })
      result.push({ x: arm.rightX + 1, y: y + heightOffset, z: arm.rightZ + Math.floor(i / 3), color: skin })
    })

    // 手 (肌色)
    const handLY = arm.leftY[arm.leftY.length - 1] - 1
    const handRY = arm.rightY[arm.rightY.length - 1] - 1
    result.push({ x: arm.leftX - 1, y: handLY + heightOffset, z: arm.leftZ + 2, color: skin })
    result.push({ x: arm.rightX + 1, y: handRY + heightOffset, z: arm.rightZ + 2, color: skin })

    // === バスケットボール ===
    if (pose === 'shooting' || pose === 'dribbling') {
      const ballY = pose === 'shooting' ? 36 + heightOffset : 18
      const ballX = pose === 'shooting' ? 6 : 6
      const ballZ = pose === 'shooting' ? 4 : 3
      // オレンジのバスケットボール (3x3x3)
      for (let bx = 0; bx < 3; bx++) {
        for (let by = 0; by < 3; by++) {
          for (let bz = 0; bz < 3; bz++) {
            const distSq = (bx - 1) * (bx - 1) + (by - 1) * (by - 1) + (bz - 1) * (bz - 1)
            if (distSq <= 2) {
              result.push({ x: ballX + bx, y: ballY + by, z: ballZ + bz, color: '#ff6b00' })
            }
          }
        }
      }
      // ボールのライン
      result.push({ x: ballX + 1, y: ballY + 1, z: ballZ + 3, color: '#1a1a1a' })
      result.push({ x: ballX + 1, y: ballY + 2, z: ballZ + 2, color: '#1a1a1a' })
    }

    // === ショーツ ===
    for (let y = 16; y <= 21; y++) {
      const width = 3
      for (let x = -width; x <= width; x++) {
        for (let z = -2; z <= 2; z++) {
          if (x * x + z * z <= width * width + 1) {
            result.push({ x, y: y + heightOffset, z, color: colors.shorts })
          }
        }
      }
    }
    // トリムライン
    for (let x = -3; x <= 3; x++) {
      result.push({ x, y: 16 + heightOffset, z: 2, color: colors.trim })
      result.push({ x, y: 16 + heightOffset, z: -2, color: colors.trim })
    }

    // === 脚 ===
    const legPose = {
      standing: { leftZ: 0, rightZ: 0 },
      shooting: { leftZ: 0, rightZ: 1 },
      dribbling: { leftZ: 1, rightZ: -1 },
      jumping: { leftZ: -1, rightZ: 1 },
      running: { leftZ: 3, rightZ: -3 },
    }
    const leg = legPose[pose]

    // Left leg
    for (let y = 4; y <= 15; y++) {
      const zOff = pose === 'running' ? Math.sin((y - 4) * 0.5) * leg.leftZ * 0.3 : 0
      result.push({ x: -2, y: y + heightOffset, z: Math.round(zOff), color: skin })
      result.push({ x: -1, y: y + heightOffset, z: Math.round(zOff), color: skin })
    }
    // Right leg
    for (let y = 4; y <= 15; y++) {
      const zOff = pose === 'running' ? Math.sin((y - 4) * 0.5) * leg.rightZ * 0.3 : 0
      result.push({ x: 1, y: y + heightOffset, z: Math.round(zOff), color: skin })
      result.push({ x: 2, y: y + heightOffset, z: Math.round(zOff), color: skin })
    }

    // === シューズ ===
    // Left shoe
    for (let x = -3; x <= 0; x++) {
      for (let z = -1; z <= 3; z++) {
        result.push({ x, y: 0 + heightOffset, z, color: shoeSole })
        result.push({ x, y: 1 + heightOffset, z, color: shoes })
        if (z <= 1) {
          result.push({ x, y: 2 + heightOffset, z, color: shoes })
          result.push({ x, y: 3 + heightOffset, z, color: shoes })
        }
      }
    }
    // Right shoe
    for (let x = 0; x <= 3; x++) {
      for (let z = -1; z <= 3; z++) {
        result.push({ x, y: 0 + heightOffset, z, color: shoeSole })
        result.push({ x, y: 1 + heightOffset, z, color: shoes })
        if (z <= 1) {
          result.push({ x, y: 2 + heightOffset, z, color: shoes })
          result.push({ x, y: 3 + heightOffset, z, color: shoes })
        }
      }
    }

    return result
  }, [team, skinTone, pose, number])

  useFrame((state) => {
    if (!animated || !groupRef.current) return

    const time = state.clock.elapsedTime + animationOffset.current

    if (pose === 'dribbling') {
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(time * 4)) * 0.1
    } else if (pose === 'running') {
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(time * 6)) * 0.05
    } else if (pose === 'shooting') {
      groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.15
    }
  })

  // voxel size 0.04 (統一サイズ、選手高さ40voxels = 1.6 units)
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.04} castShadow />
    </group>
  )
}
