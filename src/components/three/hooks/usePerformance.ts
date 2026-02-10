import { useState, useEffect } from 'react'

interface PerformanceConfig {
  particleCount: number
  enableMouseTracking: boolean
  dpr: [number, number]
}

interface PerformanceResult {
  isMobile: boolean
  isLowPerformance: boolean
  prefersReducedMotion: boolean
  config: PerformanceConfig
}

const DEFAULT_CONFIG: PerformanceConfig = {
  particleCount: 300,
  enableMouseTracking: true,
  dpr: [1, 2],
}

const MOBILE_CONFIG: PerformanceConfig = {
  particleCount: 200,
  enableMouseTracking: false,
  dpr: [1, 1.5],
}

const LOW_PERFORMANCE_CONFIG: PerformanceConfig = {
  particleCount: 150,
  enableMouseTracking: false,
  dpr: [1, 1],
}

export function usePerformance(): PerformanceResult {
  const [result, setResult] = useState<PerformanceResult>({
    isMobile: false,
    isLowPerformance: false,
    prefersReducedMotion: false,
    config: DEFAULT_CONFIG,
  })

  useEffect(() => {
    const checkPerformance = (): PerformanceResult => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth < 768

      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches

      let isLowPerformance = false
      if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
        isLowPerformance = navigator.hardwareConcurrency <= 4
      }

      let config: PerformanceConfig
      if (prefersReducedMotion || isLowPerformance) {
        config = LOW_PERFORMANCE_CONFIG
      } else if (isMobile) {
        config = MOBILE_CONFIG
      } else {
        config = DEFAULT_CONFIG
      }

      return {
        isMobile,
        isLowPerformance,
        prefersReducedMotion,
        config,
      }
    }

    setResult(checkPerformance())

    const handleResize = (): void => {
      setResult(checkPerformance())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return result
}
