import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { MorphingShape } from './objects/MorphingShape'
import { AmbientParticles } from './environment/AmbientParticles'
import { MonolithCamera } from './MonolithCamera'
import { PostProcessing } from './effects/PostProcessing'
import { MONOLITH_COLORS } from './constants'
import { usePerformance } from '../hooks/usePerformance'
import { useMousePosition } from '../hooks/useMousePosition'
import { HeroFallback } from '../fallback/HeroFallback'

interface MonolithSceneProps {
  className?: string
  scrollProgress?: number
}

interface SceneContentProps {
  scrollProgress: number
  mousePosition: { x: number; y: number }
  enableMouseTracking: boolean
  enablePostProcessing: boolean
}

// シーンコンテンツ
const SceneContent: React.FC<SceneContentProps> = ({
  scrollProgress,
  mousePosition,
  enableMouseTracking,
  enablePostProcessing,
}) => {
  return (
    <>
      <MonolithCamera
        scrollProgress={scrollProgress}
        mousePosition={enableMouseTracking ? mousePosition : { x: 0, y: 0 }}
        parallaxIntensity={0.4}
      />

      {/* ポストプロセス */}
      <PostProcessing
        enabled={enablePostProcessing}
        bloomIntensity={0.5}
        vignetteIntensity={0.4}
      />

      {/* ライティング */}
      <ambientLight intensity={0.25} color={MONOLITH_COLORS.offWhite} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={0.6}
        color={MONOLITH_COLORS.offWhite}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* 環境光 */}
      <hemisphereLight
        color={MONOLITH_COLORS.lightGray}
        groundColor={MONOLITH_COLORS.void}
        intensity={0.3}
      />

      {/* アクセントライト */}
      <pointLight
        position={[-5, 8, -5]}
        intensity={0.3}
        color={MONOLITH_COLORS.accent}
        distance={30}
      />

      {/* モーフィングシェイプ - スクロールで形が変化 */}
      <MorphingShape scrollProgress={scrollProgress} />

      {/* 地面（グリッド） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color={MONOLITH_COLORS.darkGray}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* グリッドヘルパー */}
      <gridHelper
        args={[100, 100, MONOLITH_COLORS.midGray, MONOLITH_COLORS.midGray]}
        position={[0, -3.99, 0]}
      />

      {/* 微細浮遊パーティクル */}
      <AmbientParticles count={300} spread={40} speed={0.015} />
    </>
  )
}

export const MonolithScene: React.FC<MonolithSceneProps> = ({
  className = '',
  scrollProgress = 0,
}) => {
  const [isReady, setIsReady] = useState(false)
  const [isWebGLSupported, setIsWebGLSupported] = useState(false)
  const { prefersReducedMotion, config } = usePerformance()
  const mousePosition = useMousePosition({
    enabled: config.enableMouseTracking,
    lerp: 0.08,
  })

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      setIsWebGLSupported(!!gl)
    } catch {
      setIsWebGLSupported(false)
    }
    setIsReady(true)
  }, [])

  if (!isReady) {
    return <HeroFallback className={className} />
  }

  if (!isWebGLSupported || prefersReducedMotion) {
    return <HeroFallback className={className} />
  }

  return (
    <div className={`relative w-full h-full ${className}`} style={{ pointerEvents: 'none' }}>
      <Suspense fallback={<HeroFallback className={className} />}>
        <Canvas
          camera={{ position: [0, 2, 15], fov: 60 }}
          dpr={config.dpr}
          style={{ background: MONOLITH_COLORS.void, pointerEvents: 'auto' }}
          gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
          shadows
          eventPrefix="client"
        >
          <color attach="background" args={[MONOLITH_COLORS.void]} />
          <fog attach="fog" args={[MONOLITH_COLORS.void, 25, 80]} />
          <SceneContent
            scrollProgress={scrollProgress}
            mousePosition={mousePosition}
            enableMouseTracking={config.enableMouseTracking}
            enablePostProcessing={!prefersReducedMotion}
          />
        </Canvas>
      </Suspense>
    </div>
  )
}
