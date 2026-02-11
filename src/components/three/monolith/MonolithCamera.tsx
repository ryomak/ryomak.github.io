import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface CameraWaypoint {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

interface MonolithCameraProps {
  scrollProgress: number
  mousePosition?: { x: number; y: number }
  parallaxIntensity?: number
}

// カメラウェイポイント
const CAMERA_WAYPOINTS: CameraWaypoint[] = [
  // Intro: 正面遠景
  { position: new THREE.Vector3(0, 2, 15), lookAt: new THREE.Vector3(0, 0, 0) },
  // About: 斜め上から
  { position: new THREE.Vector3(8, 4, 10), lookAt: new THREE.Vector3(0, 1, 0) },
  // Career: 側面
  { position: new THREE.Vector3(12, 2, 0), lookAt: new THREE.Vector3(0, 0, 0) },
  // Skills: 後方上空
  { position: new THREE.Vector3(5, 5, -8), lookAt: new THREE.Vector3(0, 0, 0) },
  // Works: 近接
  { position: new THREE.Vector3(0, 1.5, 6), lookAt: new THREE.Vector3(0, 0, 0) },
]

// Catmull-Romスプライン補間
const catmullRomInterpolate = (
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
): THREE.Vector3 => {
  const t2 = t * t
  const t3 = t2 * t

  return new THREE.Vector3(
    0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
  )
}

// イージング関数
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export const MonolithCamera: React.FC<MonolithCameraProps> = ({
  scrollProgress,
  mousePosition = { x: 0, y: 0 },
  parallaxIntensity = 0.3,
}) => {
  const { camera } = useThree()
  const currentPos = useRef(new THREE.Vector3(0, 2, 15))
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const smoothMouse = useRef({ x: 0, y: 0 })

  // ターゲットカメラ位置を計算
  const getTargetCamera = useMemo(() => {
    return (progress: number): { position: THREE.Vector3; lookAt: THREE.Vector3 } => {
      const numWaypoints = CAMERA_WAYPOINTS.length
      const rawIndex = progress * (numWaypoints - 1)
      const index = Math.floor(rawIndex)
      const t = rawIndex - index
      const nextIndex = Math.min(index + 1, numWaypoints - 1)

      // Catmull-Rom用の4点を取得
      const p0 = CAMERA_WAYPOINTS[Math.max(0, index - 1)].position
      const p1 = CAMERA_WAYPOINTS[index].position
      const p2 = CAMERA_WAYPOINTS[nextIndex].position
      const p3 = CAMERA_WAYPOINTS[Math.min(numWaypoints - 1, nextIndex + 1)].position

      // Catmull-Romスプラインで位置を補間
      const position = catmullRomInterpolate(p0, p1, p2, p3, easeInOutCubic(t))

      // lookAtは線形補間
      const lookAt = new THREE.Vector3().lerpVectors(
        CAMERA_WAYPOINTS[index].lookAt,
        CAMERA_WAYPOINTS[nextIndex].lookAt,
        easeInOutCubic(t)
      )

      return { position, lookAt }
    }
  }, [])

  useFrame((_, delta) => {
    const target = getTargetCamera(scrollProgress)

    // マウスパララックスをスムーズに適用
    smoothMouse.current.x = THREE.MathUtils.lerp(
      smoothMouse.current.x,
      mousePosition.x,
      0.05
    )
    smoothMouse.current.y = THREE.MathUtils.lerp(
      smoothMouse.current.y,
      mousePosition.y,
      0.05
    )

    // パララックスオフセット
    const parallaxOffset = new THREE.Vector3(
      smoothMouse.current.x * parallaxIntensity,
      smoothMouse.current.y * parallaxIntensity * 0.5,
      0
    )

    // ターゲット位置にパララックスを加算
    const targetWithParallax = target.position.clone().add(parallaxOffset)

    // 慣性付きlerp（deltaTimeベース）
    const lerpFactor = 1 - Math.pow(0.01, delta)
    currentPos.current.lerp(targetWithParallax, lerpFactor)
    currentLookAt.current.lerp(target.lookAt, lerpFactor)

    camera.position.copy(currentPos.current)
    camera.lookAt(currentLookAt.current)
  })

  return null
}

export { CAMERA_WAYPOINTS }
