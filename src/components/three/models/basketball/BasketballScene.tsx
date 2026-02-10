import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { BasketballCourt } from './BasketballCourt'
import { BasketballPlayer } from './BasketballPlayer'
import { BasketballHoop } from './BasketballHoop'

interface BasketballSceneProps {
  position?: [number, number, number]
  scale?: number
  highlightedSection?: 'intro' | 'about' | 'career' | 'skills' | 'works' | null
}

// シンプルな観客 (boxで軽量化)
const SimpleSpectator: React.FC<{
  position: [number, number, number]
  color: string
}> = ({ position, color }) => {
  return (
    <group position={position}>
      {/* 頭 */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="#c68642" />
      </mesh>
      {/* 体 */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.4, 0.15]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 下半身 */}
      <mesh position={[0, 0.1, 0.05]}>
        <boxGeometry args={[0.25, 0.2, 0.2]} />
        <meshStandardMaterial color="#2a2a4a" />
      </mesh>
    </group>
  )
}

// 観客席セクション (軽量版)
const AudienceSection: React.FC<{
  position: [number, number, number]
  rotation?: [number, number, number]
  rows: number
  seatsPerRow: number
  seatColor: string
}> = ({ position, rotation = [0, 0, 0], rows, seatsPerRow, seatColor }) => {
  const spectators = useMemo(() => {
    const result: { pos: [number, number, number]; color: string }[] = []
    const colors = ['#552583', '#FDB927', '#1D428A', '#FFC72C', '#CE1141', '#007A33', '#ffffff']

    const seatSpacing = 0.5
    const rowHeightSpacing = 0.35
    const rowDepthSpacing = 0.4

    for (let row = 0; row < rows; row++) {
      for (let seat = 0; seat < seatsPerRow; seat++) {
        // 70%の席
        if (Math.random() > 0.3) {
          const x = (seat - seatsPerRow / 2) * seatSpacing
          const y = row * rowHeightSpacing
          const z = row * rowDepthSpacing
          const color = colors[Math.floor(Math.random() * colors.length)]
          result.push({ pos: [x, y, z], color })
        }
      }
    }
    return result
  }, [rows, seatsPerRow])

  return (
    <group position={position} rotation={rotation}>
      {/* スタンド背景 (単純なbox) */}
      <mesh position={[0, rows * 0.15, rows * 0.2]}>
        <boxGeometry args={[seatsPerRow * 0.5, rows * 0.35, rows * 0.4]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
      {/* 観客 */}
      {spectators.map((spec, i) => (
        <SimpleSpectator key={i} position={spec.pos} color={spec.color} />
      ))}
    </group>
  )
}

// アリーナ
const Arena: React.FC = () => {
  return (
    <group>
      {/* アリーナの床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* 観客席 - 4方向 (少人数、コート外に配置) */}
      {/* 前 (+Z) */}
      <AudienceSection
        position={[0, 0, 4]}
        rotation={[0.2, Math.PI, 0]}
        rows={4}
        seatsPerRow={12}
        seatColor="#2a1f3d"
      />
      {/* 後ろ (-Z) */}
      <AudienceSection
        position={[0, 0, -4]}
        rotation={[0.2, 0, 0]}
        rows={4}
        seatsPerRow={12}
        seatColor="#2a1f3d"
      />
      {/* 左 (-X) */}
      <AudienceSection
        position={[-5.5, 0, 0]}
        rotation={[0.2, -Math.PI / 2, 0]}
        rows={3}
        seatsPerRow={8}
        seatColor="#3d2d5a"
      />
      {/* 右 (+X) */}
      <AudienceSection
        position={[5.5, 0, 0]}
        rotation={[0.2, Math.PI / 2, 0]}
        rows={3}
        seatsPerRow={8}
        seatColor="#3d2d5a"
      />

      {/* 上部の壁 */}
      <mesh position={[0, 4, 8]}>
        <boxGeometry args={[20, 6, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0, 4, -8]}>
        <boxGeometry args={[20, 6, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[-10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[15, 6, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[15, 6, 1]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* スコアボード */}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[3, 1.2, 0.4]} />
        <meshStandardMaterial color="#111111" emissive="#ff0000" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

// メインのバスケットボールシーン
export const BasketballScene: React.FC<BasketballSceneProps> = ({
  position = [0, 0, 0],
  scale = 1,
  highlightedSection = null,
}) => {
  const sceneRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!sceneRef.current) return
    sceneRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.03
  })

  // 統一されたスケールシステム
  // すべてのコンポーネントが同じvoxel size (0.04) を使用
  // コート: 192 x 102 voxels * 0.04 = 7.68 x 4.08 units
  // プレイヤー: 40 voxels * 0.04 = 1.6 units (約2m)
  // ゴール: 61 voxels * 0.04 = 2.44 units (約3.05m)
  // 観客(座): 24 voxels * 0.04 = 0.96 units (約1.2m)

  const courtScale = 0.8 // コートを少し小さく表示

  // プレイヤーの位置 (コートに合わせて調整)
  const playerPositions = {
    lakers: [
      { pos: [2.0, 0, 0] as [number, number, number], rot: [0, -Math.PI / 3, 0] as [number, number, number], pose: 'shooting' as const, number: 23, skin: 'dark' as const },
      { pos: [1.2, 0, 1.2] as [number, number, number], rot: [0, -Math.PI / 4, 0] as [number, number, number], pose: 'standing' as const, number: 6, skin: 'medium' as const },
      { pos: [0.6, 0, -0.8] as [number, number, number], rot: [0, -Math.PI / 5, 0] as [number, number, number], pose: 'running' as const, number: 3, skin: 'light' as const },
      { pos: [2.4, 0, -1.4] as [number, number, number], rot: [0, -Math.PI / 6, 0] as [number, number, number], pose: 'dribbling' as const, number: 0, skin: 'dark' as const },
      { pos: [0, 0, 0.5] as [number, number, number], rot: [0, -Math.PI / 4, 0] as [number, number, number], pose: 'standing' as const, number: 15, skin: 'medium' as const },
    ],
    warriors: [
      { pos: [1.6, 0, 0.4] as [number, number, number], rot: [0, Math.PI * 0.7, 0] as [number, number, number], pose: 'standing' as const, number: 30, skin: 'medium' as const },
      { pos: [0.6, 0, 1.4] as [number, number, number], rot: [0, Math.PI * 0.6, 0] as [number, number, number], pose: 'running' as const, number: 11, skin: 'dark' as const },
      { pos: [0.4, 0, -0.4] as [number, number, number], rot: [0, Math.PI * 0.8, 0] as [number, number, number], pose: 'standing' as const, number: 22, skin: 'light' as const },
      { pos: [1.4, 0, -1.2] as [number, number, number], rot: [0, Math.PI * 0.75, 0] as [number, number, number], pose: 'standing' as const, number: 23, skin: 'dark' as const },
      { pos: [-0.4, 0, 1.0] as [number, number, number], rot: [0, Math.PI * 0.65, 0] as [number, number, number], pose: 'standing' as const, number: 5, skin: 'medium' as const },
    ],
  }

  const hoopXOffset = 3.2

  return (
    <group ref={sceneRef} position={position} scale={scale}>
      {/* アリーナ */}
      <Arena />

      {/* コート */}
      <BasketballCourt
        position={[0, 0, 0]}
        scale={courtScale}
        teamColor="#552583"
        animated
      />

      {/* ゴール */}
      <BasketballHoop
        position={[hoopXOffset, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={courtScale}
        animated
      />
      <BasketballHoop
        position={[-hoopXOffset, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={courtScale}
        animated
      />

      {/* Lakers */}
      {playerPositions.lakers.map((p, i) => (
        <BasketballPlayer
          key={`laker-${i}`}
          position={p.pos}
          rotation={p.rot}
          scale={courtScale}
          team="lakers"
          skinTone={p.skin}
          pose={p.pose}
          number={p.number}
          animated
        />
      ))}

      {/* Warriors */}
      {playerPositions.warriors.map((p, i) => (
        <BasketballPlayer
          key={`warrior-${i}`}
          position={p.pos}
          rotation={p.rot}
          scale={courtScale}
          team="warriors"
          skinTone={p.skin}
          pose={p.pose}
          number={p.number}
          animated
        />
      ))}

      {/* 審判 */}
      <BasketballPlayer
        position={[-0.6, 0, 1.8]}
        rotation={[0, 0, 0]}
        scale={courtScale * 0.9}
        team="bulls"
        skinTone="light"
        pose="standing"
        number={0}
        animated={false}
      />

      {/* ライティング */}
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight args={['#ffffff', '#8B4513', 0.6]} />

      <spotLight
        position={[0, 12, 0]}
        angle={0.6}
        penumbra={0.5}
        intensity={2}
        color="#ffffff"
        castShadow
      />
      <pointLight position={[4, 8, 2]} color="#ffffff" intensity={1} distance={20} />
      <pointLight position={[-4, 8, 2]} color="#ffffff" intensity={1} distance={20} />
      <pointLight position={[4, 8, -2]} color="#ffffff" intensity={1} distance={20} />
      <pointLight position={[-4, 8, -2]} color="#ffffff" intensity={1} distance={20} />

      <pointLight position={[6, 3, 4]} color="#552583" intensity={0.4} distance={12} />
      <pointLight position={[-6, 3, 4]} color="#FDB927" intensity={0.4} distance={12} />
      <pointLight position={[6, 3, -4]} color="#1D428A" intensity={0.3} distance={12} />
      <pointLight position={[-6, 3, -4]} color="#FFC72C" intensity={0.3} distance={12} />
    </group>
  )
}

export default BasketballScene
