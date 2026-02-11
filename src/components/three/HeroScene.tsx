import { Suspense, useState, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BasketballScene } from './models/basketball/BasketballScene'
import { HeroFallback } from './fallback/HeroFallback'
import { usePerformance } from './hooks/usePerformance'
import * as THREE from 'three'

interface HeroSceneProps {
  className?: string
  scrollProgress?: number
}

interface SceneContentProps {
  scrollProgress: number
}

// Camera path waypoints for Basketball Arena
const CAMERA_WAYPOINTS = [
  // 0.0-0.2: Intro - Wide arena view showing court and audience
  { position: new THREE.Vector3(0, 8, 12), lookAt: new THREE.Vector3(0, 0, 0) },
  // 0.2-0.4: About - Side view of arena
  { position: new THREE.Vector3(10, 6, 6), lookAt: new THREE.Vector3(0, 0, 0) },
  // 0.4-0.6: Career - Closer to players
  { position: new THREE.Vector3(5, 3, 4), lookAt: new THREE.Vector3(1, 0.5, 0) },
  // 0.6-0.8: Skills - View from opposite side
  { position: new THREE.Vector3(-8, 5, 5), lookAt: new THREE.Vector3(0, 0, 0) },
  // 0.8-1.0: Works - Dramatic court-level angle
  { position: new THREE.Vector3(6, 2, 0), lookAt: new THREE.Vector3(0, 0.5, 0) },
]

// Section names for highlighting
export const CITY_SECTIONS = ['intro', 'about', 'career', 'skills', 'works'] as const

// Get camera target based on scroll progress
const getTargetCamera = (scrollProgress: number): { position: THREE.Vector3; lookAt: THREE.Vector3 } => {
  const numSections = CAMERA_WAYPOINTS.length
  const sectionIndex = Math.min(Math.floor(scrollProgress * numSections), numSections - 1)
  const nextIndex = Math.min(sectionIndex + 1, numSections - 1)
  const sectionProgress = (scrollProgress * numSections) % 1

  const currentWaypoint = CAMERA_WAYPOINTS[sectionIndex]
  const nextWaypoint = CAMERA_WAYPOINTS[nextIndex]

  // Smooth interpolation using easing
  const easedProgress = smoothstep(sectionProgress)

  const position = new THREE.Vector3().lerpVectors(
    currentWaypoint.position,
    nextWaypoint.position,
    easedProgress
  )

  const lookAt = new THREE.Vector3().lerpVectors(
    currentWaypoint.lookAt,
    nextWaypoint.lookAt,
    easedProgress
  )

  return { position, lookAt }
}

// Smoothstep easing function
const smoothstep = (t: number): number => {
  return t * t * (3 - 2 * t)
}

const CameraController: React.FC<{ scrollProgress: number }> = ({ scrollProgress }) => {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(0, 8, 12))
  const currentPos = useRef(new THREE.Vector3(0, 8, 12))
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    const target = getTargetCamera(scrollProgress)
    targetPos.current.copy(target.position)
    targetLookAt.current.copy(target.lookAt)

    // Smooth camera movement with lerp
    currentPos.current.lerp(targetPos.current, 0.03)
    currentLookAt.current.lerp(targetLookAt.current, 0.03)

    camera.position.copy(currentPos.current)
    camera.lookAt(currentLookAt.current)
  })

  return null
}

// Get highlighted section based on scroll progress
const getHighlightedSection = (scrollProgress: number): 'intro' | 'about' | 'career' | 'skills' | 'works' | null => {
  const sectionIndex = Math.floor(scrollProgress * CITY_SECTIONS.length)
  return CITY_SECTIONS[sectionIndex] ?? null
}

const SceneContent: React.FC<SceneContentProps> = ({
  scrollProgress,
}) => {
  const highlightedSection = getHighlightedSection(scrollProgress)

  return (
    <>
      <CameraController scrollProgress={scrollProgress} />

      {/* Basketball Scene - LARGER scale */}
      <BasketballScene
        position={[0, 0, 0]}
        scale={1.5}
        highlightedSection={highlightedSection}
      />
    </>
  )
}

export const HeroScene: React.FC<HeroSceneProps> = ({
  className = '',
  scrollProgress = 0
}) => {
  const [isReady, setIsReady] = useState(false)
  const [isWebGLSupported, setIsWebGLSupported] = useState(false)
  const { prefersReducedMotion, config } = usePerformance()

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
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
    <div className={`relative w-full h-full ${className}`}>
      <Suspense fallback={<HeroFallback className={className} />}>
        <Canvas
          camera={{ position: [0, 4, 8], fov: 60 }}
          dpr={config.dpr}
          style={{ background: '#2a1f3d' }}
          gl={{ alpha: false, antialias: true }}
        >
          {/* Solid background color in scene */}
          <color attach="background" args={['#2a1f3d']} />
          <fog attach="fog" args={['#2a1f3d', 15, 40]} />
          <SceneContent
            scrollProgress={scrollProgress}
          />
        </Canvas>
      </Suspense>
    </div>
  )
}
