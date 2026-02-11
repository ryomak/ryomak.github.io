import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

interface MousePosition {
  x: number
  y: number
}

interface UseMousePositionOptions {
  enabled?: boolean
  lerp?: number
}

export function useMousePosition(options: UseMousePositionOptions = {}): MousePosition {
  const { enabled = true, lerp = 0.05 } = options
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 })
  const targetRef = useRef<MousePosition>({ x: 0, y: 0 })
  const currentRef = useRef<MousePosition>({ x: 0, y: 0 })
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPosition({ x: 0, y: 0 })
      return
    }

    const handleMouseMove = (event: MouseEvent): void => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      targetRef.current = { x, y }
    }

    const animate = (): void => {
      currentRef.current.x = THREE.MathUtils.lerp(
        currentRef.current.x,
        targetRef.current.x,
        lerp
      )
      currentRef.current.y = THREE.MathUtils.lerp(
        currentRef.current.y,
        targetRef.current.y,
        lerp
      )

      setPosition({
        x: currentRef.current.x,
        y: currentRef.current.y,
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMouseMove)
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [enabled, lerp])

  return position
}
