export type Vec3 = [number, number, number]
export const clamp = (x: number) =>
  Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))
export const ease = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// A single, slow lateral dolly over the canal. There are no cuts or full turns.
// The arena remains the anchor while the city changes around it.
export function sampleJourney(progress: number, aspect: number) {
  const p = clamp(progress)
  const t = ease(0.125, 0.875, p)
  const narrow = 1 - ease(0.55, 1.25, Math.max(0.1, aspect))
  const angle = mix(0.46, -0.57, t)
  const radius =
    mix(660, 490, Math.sin((t * Math.PI) / 2)) * (1 + narrow * 0.48)
  const position: Vec3 = [
    Math.sin(angle) * radius,
    mix(112, 188, t),
    Math.cos(angle) * radius,
  ]
  const target: Vec3 = [0, mix(59, 85, t) - narrow * 36, -18]
  return {
    position,
    target,
    restore: ease(0.22, 0.73, p),
    night: ease(0.18, 0.68, p),
    population: 0.08 + 0.92 * ease(0.125, 0.875, p),
    // Offset the lens, rather than steering away from the architecture.
    lens: mix(-5.4, 5.4, ease(0.43, 0.59, p)) * (1 - narrow),
  }
}
