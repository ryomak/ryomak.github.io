import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

interface PostProcessingProps {
  enabled?: boolean
  bloomIntensity?: number
  vignetteIntensity?: number
}

export const PostProcessing: React.FC<PostProcessingProps> = ({
  enabled = true,
  bloomIntensity = 0.6,
  vignetteIntensity = 0.5,
}) => {
  if (!enabled) return null

  return (
    <EffectComposer>
      {/* Bloom: 発光エフェクト */}
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.9}
        mipmapBlur
      />

      {/* Vignette: 画面端の減光 */}
      <Vignette
        offset={0.3}
        darkness={vignetteIntensity}
      />
    </EffectComposer>
  )
}
