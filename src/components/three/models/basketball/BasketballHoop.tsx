import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition } from '../VoxelUtils'

// ゴール高さ 3.05m = 61voxels (1voxel = 5cm)
// バックボード: 1.8m x 1.05m = 36 x 21 voxels
// リム直径: 45cm = 9 voxels
export const HOOP_HEIGHT_VOXELS = 61

interface BasketballHoopProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  animated?: boolean
}

export const BasketballHoop: React.FC<BasketballHoopProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  animated = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []

    // Colors
    const pole = '#c0c0c0'      // Silver pole
    const backboard = '#ffffff' // White backboard
    const backboardEdge = '#ff6b00' // Orange edge
    const rim = '#ff4500'       // Orange-red rim
    const net = '#ffffff'       // White net
    const poleBase = '#333333'  // Dark base

    // === ポール (地面からバックボードまで) ===
    // メインポール (太さ4x4voxels)
    for (let y = 0; y <= 65; y++) {
      for (let x = -1; x <= 2; x++) {
        for (let z = -6; z <= -3; z++) {
          result.push({ x, y, z, color: pole })
        }
      }
    }

    // ポールベース
    for (let x = -4; x <= 5; x++) {
      for (let z = -10; z <= 0; z++) {
        result.push({ x, y: 0, z, color: poleBase })
        result.push({ x, y: 1, z, color: poleBase })
      }
    }

    // 水平サポートアーム
    for (let z = -6; z <= 5; z++) {
      for (let x = -1; x <= 2; x++) {
        result.push({ x, y: 65, z, color: pole })
        result.push({ x, y: 64, z, color: pole })
      }
    }

    // === バックボード (36 x 21 voxels = 1.8m x 1.05m) ===
    const boardCenterY = 63
    const boardHalfWidth = 18
    const boardHalfHeight = 10

    for (let x = -boardHalfWidth; x <= boardHalfWidth; x++) {
      for (let y = boardCenterY - boardHalfHeight; y <= boardCenterY + boardHalfHeight; y++) {
        result.push({ x, y, z: 5, color: backboard })
      }
    }

    // バックボードのオレンジ枠
    for (let x = -boardHalfWidth; x <= boardHalfWidth; x++) {
      result.push({ x, y: boardCenterY + boardHalfHeight, z: 6, color: backboardEdge })
      result.push({ x, y: boardCenterY - boardHalfHeight, z: 6, color: backboardEdge })
    }
    for (let y = boardCenterY - boardHalfHeight; y <= boardCenterY + boardHalfHeight; y++) {
      result.push({ x: -boardHalfWidth, y, z: 6, color: backboardEdge })
      result.push({ x: boardHalfWidth, y, z: 6, color: backboardEdge })
    }

    // バックボードの四角 (シュートターゲット 59cm x 45cm = 12 x 9 voxels)
    const squareHalfWidth = 6
    const squareHalfHeight = 4
    const squareCenterY = 59 // リムの少し上

    for (let x = -squareHalfWidth; x <= squareHalfWidth; x++) {
      result.push({ x, y: squareCenterY + squareHalfHeight, z: 6, color: backboardEdge })
      result.push({ x, y: squareCenterY - squareHalfHeight, z: 6, color: backboardEdge })
    }
    for (let y = squareCenterY - squareHalfHeight; y <= squareCenterY + squareHalfHeight; y++) {
      result.push({ x: -squareHalfWidth, y, z: 6, color: backboardEdge })
      result.push({ x: squareHalfWidth, y, z: 6, color: backboardEdge })
    }

    // === リム (直径45cm = 9voxels, つまり半径4.5) ===
    const rimY = 61 // 3.05m
    const rimRadius = 5
    const rimCenterZ = 10

    // リムの輪
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = (angle * Math.PI) / 180
      const rx = Math.round(Math.cos(rad) * rimRadius)
      const rz = Math.round(rimCenterZ + Math.sin(rad) * rimRadius)
      result.push({ x: rx, y: rimY, z: rz, color: rim })
      result.push({ x: rx, y: rimY - 1, z: rz, color: rim })
    }

    // リムをバックボードに接続するブラケット
    for (let z = 6; z <= rimCenterZ - rimRadius; z++) {
      result.push({ x: 0, y: rimY, z, color: pole })
      result.push({ x: 0, y: rimY - 1, z, color: pole })
    }

    // === ネット ===
    for (let y = rimY - 15; y < rimY; y++) {
      const netRadius = rimRadius - (rimY - y) * 0.2
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180
        const nx = Math.round(Math.cos(rad) * netRadius)
        const nz = Math.round(rimCenterZ + Math.sin(rad) * netRadius)
        result.push({ x: nx, y, z: nz, color: net })
      }
    }
    // ネットの底
    result.push({ x: 0, y: rimY - 16, z: rimCenterZ, color: net })

    return result
  }, [])

  useFrame((state) => {
    if (!animated) return
    // ネットの揺れは実際にはnetRefで制御するが、ここでは省略
  })

  // voxel size 0.04 (統一サイズ)
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <VoxelGroup voxels={voxels} size={0.04} castShadow receiveShadow />
    </group>
  )
}
