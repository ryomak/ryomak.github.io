import { clamp } from '@components/home/city/journey'
// The document owns scrolling. WebGL follows it and never captures wheel or keys.
import type { CityScene } from '@components/home/city/scene'

function start(): () => void {
  const root = document.querySelector<HTMLElement>('[data-city]')
  const stage = root?.querySelector<HTMLElement>('[data-city-stage]')
  const canvas = stage?.querySelector<HTMLCanvasElement>('canvas')
  if (!root || !stage || !canvas) return () => {}
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reduced.matches) return () => {}
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const tier =
    window.innerWidth < 820 || memory <= 4 || navigator.hardwareConcurrency <= 4
      ? 'low'
      : 'high'
  let scene: CityScene | undefined
  let cancelled = false
  let raf = 0
  let last = 0
  let top = 0
  let span = 1
  let active = false
  let warmFrames = 0
  const status = root.querySelector<HTMLElement>('[data-city-status]')
  const index = root.querySelector<HTMLElement>('.city-index')
  const phase = root.querySelector<HTMLElement>('[data-city-phase]')
  const progressBar = root.querySelector<HTMLElement>('[data-city-progress]')
  const boot = root.querySelector<HTMLElement>('[data-city-boot]')
  const bootFill = root.querySelector<HTMLElement>('[data-city-boot-fill]')
  const bootNote = root.querySelector<HTMLElement>('[data-city-boot-note]')
  const links = Array.from(
    root.querySelectorAll<HTMLAnchorElement>('[data-city-jump]'),
  )
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>('[data-city-sec]'),
  )
  const measure = () => {
    top = root.getBoundingClientRect().top + window.scrollY
    span = Math.max(1, root.offsetHeight - window.innerHeight)
    scene?.resize(
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio || 1,
    )
  }
  const progress = () => clamp((window.scrollY - top) / span)
  const update = () => {
    const p = progress()
    scene?.setProgress(0.125 + p * 0.75)
    if (phase)
      phase.textContent =
        p < 0.25
          ? '01 / AFTERGLOW'
          : p < 0.72
            ? '02 / RECOLLECTION'
            : '03 / THE DREAM'
    if (progressBar) progressBar.style.transform = `scaleX(${p})`
    let current = 0
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top < window.innerHeight * 0.65)
        current = i
    }
    links.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
  }
  const fallback = (error?: unknown) => {
    if (error) console.warn('[city] Using static scenery:', error)
    active = false
    cancelled = true
    cancelAnimationFrame(raf)
    scene?.dispose()
    scene = undefined
    stage.classList.remove('is-loaded')
    boot?.remove()
    root.classList.remove('is-stage')
    root.classList.add('is-static')
    status?.remove()
    index?.remove()
  }
  const frame = (now: number) => {
    if (cancelled || !active || document.hidden) return
    const dt = last ? (now - last) / 1000 : 1 / 60
    last = now
    try {
      scene?.render(dt)
      if (++warmFrames === 2) {
        stage.classList.add('is-loaded')
        boot?.classList.add('is-done')
      }
    } catch (error) {
      fallback(error)
      return
    }
    raf = requestAnimationFrame(frame)
  }
  const visibility = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden && active) {
      last = 0
      raf = requestAnimationFrame(frame)
    }
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    fallback()
  }
  const motionChanged = () => {
    if (reduced.matches) fallback()
  }

  // Only the decorative canvas leaves the layout, avoiding transformed ancestors.
  document.body.appendChild(stage)
  if (status) document.body.appendChild(status)
  if (index) document.body.appendChild(index)
  root.classList.add('is-stage')
  if (boot) boot.hidden = false
  measure()
  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', measure)
  document.addEventListener('visibilitychange', visibility)
  canvas.addEventListener('webglcontextlost', contextLost)
  reduced.addEventListener('change', motionChanged)
  const timeout = window.setTimeout(() => {
    if (!active) {
      cancelled = true
      fallback(new Error('Model loading timed out'))
    }
  }, 25000)

  import('@components/home/city/scene')
    .then(async ({ createCityScene }) => {
      if (cancelled) return
      scene = createCityScene(canvas, {
        tier,
        onProgress(value) {
          if (bootFill) bootFill.style.width = `${Math.round(value * 100)}%`
          if (bootNote)
            bootNote.textContent = `BUILDING A MEMORY · ${Math.round(
              value * 100,
            )}%`
        },
      })
      measure()
      update()
      await scene.ready
      if (cancelled) {
        scene?.dispose()
        return
      }
      window.clearTimeout(timeout)
      active = true
      last = 0
      raf = requestAnimationFrame(frame)
    })
    .catch(error => {
      if (!cancelled) fallback(error)
    })

  return () => {
    cancelled = true
    window.clearTimeout(timeout)
    cancelAnimationFrame(raf)
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', measure)
    document.removeEventListener('visibilitychange', visibility)
    canvas.removeEventListener('webglcontextlost', contextLost)
    reduced.removeEventListener('change', motionChanged)
    scene?.dispose()
    root.appendChild(stage)
    if (status) root.appendChild(status)
    if (index) root.appendChild(index)
    root.classList.remove('is-stage')
    stage.classList.remove('is-loaded')
  }
}

let cleanup: (() => void) | undefined
function boot() {
  cleanup?.()
  cleanup = start()
}
function teardown() {
  cleanup?.()
  cleanup = undefined
}
boot()
const bindSwup = () => {
  const swup = (
    window as unknown as {
      swup?: { hooks?: { on(event: string, fn: () => void): void } }
    }
  ).swup
  swup?.hooks?.on('visit:start', teardown)
  swup?.hooks?.on('page:view', boot)
}
if ((window as unknown as { swup?: { hooks?: unknown } }).swup?.hooks)
  bindSwup()
else document.addEventListener('swup:enable', bindSwup)
document.addEventListener('astro:page-load', boot)
