// Boot / teardown for the Zanarkand top page.
//
// The page is progressive. What the server renders is ordinary stacked
// sections, in normal document flow — readable, indexable, and scrollable on
// their own. Only once the 3D scene has loaded and drawn does the page switch
// into "stage" mode: the canvas pins to the viewport, the sections become
// scroll-driven overlays, and a scroller of our own replaces the document's.
//
// Everything is wired here rather than in a framework island because swup swaps
// <main> without re-hydrating islands.

import type { CityScene } from '@components/home/city/scene'
import { SECTIONS, VH_PER_SECTION } from '@components/home/city/config'

type Cleanup = () => void

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Decide whether to run the stage at all, and at what cost. Phones do run it —
 * the scene is only ~67k triangles — they just skip the expensive refraction
 * pass and render at a capped pixel ratio.
 */
function pickTier(): 'high' | 'low' | 'off' {
  if (!hasWebGL()) return 'off'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off'
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (cores <= 2 && memory <= 2) return 'off'
  const narrow = window.matchMedia('(max-width: 820px)').matches
  if (narrow || cores <= 4 || memory <= 4) return 'low'
  return 'high'
}

/** The numbered chapter rail pinned to the edge of the viewport. */
function createIndex(host: HTMLElement, onJump: (i: number) => void) {
  const el = document.createElement('div')
  el.className = 'city-index'
  el.innerHTML = `
    <div class="city-index-head"><span>Index</span><span>${String(SECTIONS.length).padStart(2, '0')}</span></div>
    <ul>
      ${SECTIONS.map(
        (s, i) =>
          `<li data-i="${i}"><span class="n">${s.num}</span><span class="nm">${s.label}</span></li>`,
      ).join('')}
    </ul>`
  host.appendChild(el)
  const items = Array.from(el.querySelectorAll<HTMLElement>('li'))
  el.addEventListener('click', e => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li')
    if (li) onJump(Number(li.dataset.i))
  })
  requestAnimationFrame(() => el.classList.add('is-visible'))
  return {
    setActive(i: number) {
      items.forEach((li, k) => li.classList.toggle('is-current', k === i))
    },
    el,
  }
}

function start(): Cleanup {
  const root = document.querySelector<HTMLElement>('[data-city]')
  if (!root) return () => {}

  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-city-sec]'))
  const tier = pickTier()
  if (tier === 'off' || !panels.length) {
    root.classList.add('is-static')
    return () => root.classList.remove('is-static')
  }

  const bootEl = root.querySelector<HTMLElement>('[data-city-boot]')
  const canvas = root.querySelector<HTMLCanvasElement>('[data-city-canvas]')
  const stageEl = root.querySelector<HTMLElement>('[data-city-stage]')
  const hintEl = root.querySelector<HTMLElement>('[data-city-hint]')
  const panelsEl = root.querySelector<HTMLElement>('[data-city-panels]')
  if (!canvas || !stageEl || !panelsEl) return () => {}

  // The stage is lifted out of the page grid and pinned to the viewport, and
  // scrolling moves an element of our own rather than the document — an
  // ancestor in the shared layout is transformed, which silently turns
  // `position: fixed` into `position: absolute` for anything inside it.
  //
  // None of that is applied until the scene has actually loaded. Taking the
  // document's scrolling away first meant that any later failure — a missing
  // stylesheet, a 404 on the model, a context we could create but not draw
  // with — left a page that neither rendered nor scrolled.
  const scroller = document.createElement('div')
  scroller.className = 'city-scroller'
  scroller.tabIndex = 0
  scroller.setAttribute('aria-label', 'kurisu')
  scroller.style.setProperty('--city-scroll', `${SECTIONS.length * VH_PER_SECTION}vh`)
  const track = document.createElement('div')
  track.className = 'city-track'
  track.setAttribute('aria-hidden', 'true')

  const cleanups: Cleanup[] = []

  // ---- loading screen ------------------------------------------------------
  // Only from here on: `tier === 'off'` and a page with no panels have already
  // returned, so by this point we are genuinely going to try to build a scene
  // and a reader looking at a blank gradient deserves to be told why.
  const bootFill = bootEl?.querySelector<HTMLElement>('[data-city-boot-fill]') ?? null
  const bootNote = bootEl?.querySelector<HTMLElement>('[data-city-boot-note]') ?? null
  let bootShown = 0
  let bootCrawl = 0
  let bootGone = false

  const setBoot = (v: number) => {
    // only ever forwards, so a late byte count cannot rewind the bar
    bootShown = Math.max(bootShown, clamp01(v))
    if (bootFill) bootFill.style.width = `${(bootShown * 100).toFixed(1)}%`
  }

  if (bootEl) {
    document.body.appendChild(bootEl)
    bootEl.hidden = false
    // Downloading the model is most of the wait but not all of it, and some
    // servers send no Content-Length at all. This inches forward on its own so
    // the bar is never simply frozen, and stops short of the end so arriving
    // still means something.
    bootCrawl = window.setInterval(() => setBoot(bootShown + (0.86 - bootShown) * 0.06), 220)
  }

  const dismissBoot = (ok: boolean) => {
    if (bootGone) return
    bootGone = true
    window.clearInterval(bootCrawl)
    if (!bootEl) return
    if (ok) {
      setBoot(1)
      if (bootNote) bootNote.textContent = 'ready'
      bootEl.classList.add('is-done')
      window.setTimeout(() => bootEl.remove(), 700)
    } else {
      bootEl.remove()
    }
  }
  cleanups.push(() => {
    window.clearInterval(bootCrawl)
    bootEl?.remove()
  })

  let scene: CityScene | null = null
  let index: ReturnType<typeof createIndex> | null = null
  let raf = 0
  let disposed = false
  let staged = false
  let last = performance.now()
  let current = -1

  const scrollSpan = () => scroller.scrollHeight - scroller.clientHeight

  const readProgress = () => {
    const span = scrollSpan()
    return span > 0 ? clamp01(scroller.scrollTop / span) : 0
  }

  /** Cross-fade the panels around their own slice of the scroll. */
  const layoutPanels = (p: number) => {
    if (!staged) return
    const n = SECTIONS.length
    let best = 0
    let bestOpacity = -1
    for (let i = 0; i < n; i++) {
      let d = (p - (i + 0.5) / n) * n
      // The first and last chapters hold at full strength out to the ends of
      // the scroll — otherwise the hero is already half faded before the reader
      // has touched the wheel.
      if (i === 0 && d < 0) d = 0
      if (i === n - 1 && d > 0) d = 0
      const opacity = 1 - smoothstep(0.18, 0.44, Math.abs(d))
      const panel = panels[i]
      panel.style.opacity = String(opacity)
      panel.style.transform = `translate3d(0, ${(-d * 46).toFixed(2)}px, 0)`
      panel.style.pointerEvents = opacity > 0.55 ? 'auto' : 'none'
      panel.setAttribute('aria-hidden', opacity > 0.3 ? 'false' : 'true')
      if (opacity > bestOpacity) {
        bestOpacity = opacity
        best = i
      }
    }
    if (best !== current) {
      current = best
      index?.setActive(best)
      root.dataset.cityCurrent = String(best)
    }
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.3 : 1.8)
    // visualViewport tracks the real drawable area on mobile, where the browser
    // chrome slides in and out and innerHeight lags behind
    const vv = window.visualViewport
    const width = Math.round(vv?.width ?? window.innerWidth)
    const height = Math.round(vv?.height ?? window.innerHeight)
    scroller.style.setProperty('--city-vh', `${height}px`)
    scene?.resize(width, height, dpr)
  }

  // ---- snapping ------------------------------------------------------------
  // Each chapter has a composed shot waiting for it, so the scroll should come
  // to rest on one rather than anywhere in between. This settles the scroller
  // onto the nearest chapter once the reader stops, instead of hijacking the
  // gesture while it is happening.
  let snapTimer = 0
  let snapRaf = 0
  let snapping = false

  const chapterTop = (i: number) => {
    const span = scrollSpan()
    const n = SECTIONS.length
    return (span * (Math.max(0, Math.min(n - 1, i)) + 0.5)) / n
  }

  /**
   * Tweened by hand rather than with `scrollTo({ behavior: 'smooth' })`. The
   * native version gives no completion signal, so the "am I still snapping?"
   * guard had to be a guessed timeout — and when that expired mid-flight the
   * snap's own scroll events re-triggered it and the two fought to a standstill
   * short of the target.
   */
  const snapTo = (top: number, ms = 480) => {
    cancelAnimationFrame(snapRaf)
    window.clearTimeout(snapTimer)
    const from = scroller.scrollTop
    const delta = top - from
    if (Math.abs(delta) < 2) {
      // already there — but the flag has to be cleared, or every later snap is
      // blocked by a snap that never ran
      snapping = false
      return
    }
    snapping = true
    const t0 = performance.now()
    const step = () => {
      const k = clamp01((performance.now() - t0) / ms)
      // ease-out-cubic: quick to leave, gentle to arrive
      scroller.scrollTop = from + delta * (1 - (1 - k) ** 3)
      if (k < 1) {
        snapRaf = requestAnimationFrame(step)
        return
      }
      scroller.scrollTop = top
      snapping = false
      // A wheel gesture leaves the browser running its own smooth-scroll
      // animation, which keeps writing scrollTop underneath the tween and can
      // drag it straight back off the chapter. Check where we actually ended
      // up once that has died down, and go again if it stole the landing.
      window.setTimeout(() => {
        if (!snapping && Math.abs(scroller.scrollTop - top) > 4) scheduleSnap()
      }, 140)
    }
    snapRaf = requestAnimationFrame(step)
  }

  function scheduleSnap() {
    window.clearTimeout(snapTimer)
    snapTimer = window.setTimeout(() => {
      if (snapping) return
      const span = scrollSpan()
      if (span <= 0) return
      const i = Math.round((scroller.scrollTop / span) * SECTIONS.length - 0.5)
      snapTo(chapterTop(i))
    }, 220)
  }
  cleanups.push(() => {
    window.clearTimeout(snapTimer)
    cancelAnimationFrame(snapRaf)
  })

  const onScroll = () => {
    const p = readProgress()
    scene?.setProgress(p)
    layoutPanels(p)
    document.documentElement.classList.toggle('city-scrolled', p > 0.012)
    if (!snapping) scheduleSnap()
  }

  /**
   * Wheel is handled by hand, and the browser's own scrolling is cancelled.
   *
   * Not for feel — for control. A wheel gesture leaves Chrome running a smooth
   * -scroll animation of its own for a few hundred milliseconds afterwards,
   * which keeps writing scrollTop after the reader has stopped. The snap would
   * land on a chapter and then be dragged straight off it again by that
   * animation. Applying the delta ourselves means there is only ever one thing
   * moving the scroller.
   */
  const wheelPixels = (e: WheelEvent) =>
    e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * scroller.clientHeight : e.deltaY

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    cancelAnimationFrame(snapRaf)
    snapping = false
    const max = scrollSpan()
    scroller.scrollTop = Math.max(0, Math.min(max, scroller.scrollTop + wheelPixels(e)))
    scheduleSnap()
  }

  // The navbar sits above the scroller, so a wheel over it would otherwise do
  // nothing. Hand those deltas to the scroller instead.
  const chrome = document.getElementById('top-row')
  const onChromeWheel = onWheel

  // Page keys should work wherever focus happens to be on this page.
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    const page = scroller.clientHeight * 0.9
    const step: Record<string, number> = {
      PageDown: page,
      PageUp: -page,
      ArrowDown: 120,
      ArrowUp: -120,
      ' ': page,
      Home: -scroller.scrollHeight,
      End: scroller.scrollHeight,
    }
    const delta = step[e.key]
    if (delta === undefined) return
    e.preventDefault()
    const span = scrollSpan()
    const here = Math.round((scroller.scrollTop / span) * SECTIONS.length - 0.5)
    // page and arrow keys move a whole chapter, so they land where the shots are
    window.clearTimeout(snapTimer)
    snapTo(chapterTop(here + Math.sign(delta)), 600)
  }

  /** Take over the viewport. Returns false if the layout could not be trusted. */
  const enterStage = (): boolean => {
    // carry the reader's position across, in case they scrolled while waiting
    const docSpan = document.documentElement.scrollHeight - window.innerHeight
    const carried = docSpan > 0 ? clamp01(window.scrollY / docSpan) : 0

    document.body.appendChild(stageEl)
    if (hintEl) document.body.appendChild(hintEl)
    scroller.appendChild(panelsEl)
    scroller.appendChild(track)
    document.body.appendChild(scroller)

    // If the page stylesheet never applied — a swup navigation that dropped the
    // <head> assets, a failed CSS chunk — the scroller is an inert div and the
    // page would silently stop scrolling. Verify before committing to it.
    if (getComputedStyle(scroller).position !== 'fixed') {
      root.appendChild(stageEl)
      root.appendChild(panelsEl)
      hintEl?.remove()
      scroller.remove()
      return false
    }

    document.documentElement.classList.add('city-locked')
    root.classList.add('is-stage')
    staged = true

    index = createIndex(document.body, i => {
      window.clearTimeout(snapTimer)
      snapTo(chapterTop(i), 700)
    })

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    window.visualViewport?.addEventListener('resize', resize)
    chrome?.addEventListener('wheel', onChromeWheel, { passive: false })
    window.addEventListener('keydown', onKey)

    resize()
    scroller.scrollTop = scrollSpan() * carried
    onScroll()
    root.classList.add('is-loaded')
    stageEl.classList.add('is-loaded')
    return true
  }

  const leaveStage = () => {
    if (staged) {
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      chrome?.removeEventListener('wheel', onChromeWheel)
      window.removeEventListener('keydown', onKey)
      index?.el.remove()
      index = null
      staged = false
    }
    document.documentElement.classList.remove('city-locked', 'city-scrolled')
    root.classList.remove('is-stage', 'is-loaded')
    if (stageEl.parentElement !== root) root.appendChild(stageEl)
    if (panelsEl.parentElement !== root) root.appendChild(panelsEl)
    hintEl?.remove()
    scroller.remove()
    for (const panel of panels) {
      panel.style.opacity = ''
      panel.style.transform = ''
      panel.style.pointerEvents = ''
      panel.removeAttribute('aria-hidden')
    }
  }
  cleanups.push(leaveStage)

  const giveUp = (why: unknown) => {
    console.warn('[city] falling back to the static layout:', why)
    dismissBoot(false)
    cancelAnimationFrame(raf)
    leaveStage()
    try {
      scene?.dispose()
    } catch {
      /* already gone */
    }
    scene = null
    root.classList.add('is-static')
  }

  // Never hold the page hostage waiting for a scene that is not coming.
  const watchdog = window.setTimeout(() => {
    if (!disposed && !staged) giveUp('timed out waiting for the scene')
  }, 20000)
  cleanups.push(() => window.clearTimeout(watchdog))

  void import('@components/home/city/scene')
    .then(({ createCityScene }) => {
      if (disposed) return
      scene = createCityScene(canvas, { tier, onProgress: setBoot })
      resize()

      const loop = () => {
        raf = requestAnimationFrame(loop)
        const now = performance.now()
        // raw elapsed — the scene clamps it where clamping is what it wants
        const dt = (now - last) / 1000
        last = now
        try {
          scene?.render(dt)
        } catch (err) {
          giveUp(err)
        }
      }

      return scene.ready.then(() => {
        if (disposed) return
        window.clearTimeout(watchdog)
        if (!enterStage()) {
          giveUp('the page stylesheet did not apply')
          return
        }
        raf = requestAnimationFrame(loop)
        // one frame drawn before the curtain lifts, so the reveal is the scene
        // and not a black canvas
        requestAnimationFrame(() => requestAnimationFrame(() => dismissBoot(true)))
      })
    })
    .catch(err => {
      if (!disposed) giveUp(err)
    })

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    try {
      scene?.dispose()
    } catch {
      /* already gone */
    }
    scene = null
    for (const fn of cleanups) fn()
  }
}

// ---- swup-safe lifecycle ----------------------------------------------------
let cleanup: Cleanup | null = null
const boot = () => {
  cleanup?.()
  cleanup = start()
}
const teardown = () => {
  cleanup?.()
  cleanup = null
}

boot()

const bindSwup = () => {
  const swup = (window as unknown as { swup?: { hooks?: { on(e: string, cb: () => void): void } } }).swup
  if (!swup?.hooks) return
  swup.hooks.on('visit:start', teardown)
  swup.hooks.on('page:view', boot)
}
if ((window as unknown as { swup?: { hooks?: unknown } }).swup?.hooks) bindSwup()
else document.addEventListener('swup:enable', bindSwup)
document.addEventListener('astro:page-load', boot)
