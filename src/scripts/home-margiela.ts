// Client-side interactions for the Margiela home page.
// Progressive enhancement (not a React island): this theme navigates with swup,
// which only swaps <main> and does not re-hydrate framework islands — so the
// interactions are wired here and re-booted on swup's page:view.
import { sectionLabels } from '@components/home/data'

type Cleanup = () => void

/** Links / cards drift slightly toward the cursor when it is near. */
function initMagnetic(): Cleanup {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.mg [data-magnetic]'))
  if (!items.length) return () => {}

  const onMove = (e: PointerEvent) => {
    for (const el of items) {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const near = Math.hypot(dx, dy) < Math.max(r.width, 120)
      el.style.transform = near ? `translate(${dx * 0.28}px, ${dy * 0.28}px)` : ''
    }
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  return () => {
    window.removeEventListener('pointermove', onMove)
    items.forEach(el => (el.style.transform = ''))
  }
}

/** Floating numbered index with a hand-drawn ring that tracks the section in view. */
function initSectionIndex(reduce: boolean): Cleanup {
  const label = document.createElement('div')
  label.className = 'mg-label'
  label.innerHTML = `
    <div class="mg-label-head"><span>Index</span><span>${String(sectionLabels.length).padStart(2, '0')}</span></div>
    <ul class="mg-idx">
      ${sectionLabels
        .map((nm, i) => `<li data-i="${i}"><span class="n">${String(i).padStart(2, '0')}</span><span class="nm">${nm}</span></li>`)
        .join('')}
      <svg class="mg-idx-ring" viewBox="0 0 24 24" fill="none">
        <path d="M2 12 C2 6 6 2 12 2 C18 2 22 6 22 12 C22 18 18 22 12 22 C7 22 3 19 2 13"
              stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </ul>`
  document.body.appendChild(label)
  requestAnimationFrame(() => label.classList.add('is-visible'))

  const items = Array.from(label.querySelectorAll<HTMLElement>('.mg-idx li'))
  const ring = label.querySelector<SVGElement>('.mg-idx-ring')!
  const list = label.querySelector<HTMLElement>('.mg-idx')!

  const moveRing = (i: number) => {
    const num = items[i]?.querySelector<HTMLElement>('.n')
    if (!num) return
    const lb = list.getBoundingClientRect()
    const nb = num.getBoundingClientRect()
    const size = Number.parseFloat(getComputedStyle(ring).width)
    const x = nb.left - lb.left + nb.width / 2 - size / 2
    const y = nb.top - lb.top + nb.height / 2 - size / 2
    ring.style.transform = `translate(${x}px, ${y}px) rotate(${i % 2 ? -6 : 5}deg)`
    items.forEach((el, k) => el.classList.toggle('is-current', k === i))
  }

  let current = 0
  moveRing(0)
  requestAnimationFrame(() => moveRing(0))

  const io = new IntersectionObserver(
    entries => {
      let best: { i: number; ratio: number } | null = null
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.mgIndex)
        if (e.isIntersecting && (!best || e.intersectionRatio > best.ratio)) best = { i, ratio: e.intersectionRatio }
      }
      if (best && best.i !== current) {
        current = best.i
        moveRing(best.i)
      }
    },
    { threshold: [0.25, 0.5, 0.75] },
  )
  document.querySelectorAll<HTMLElement>('.mg-sec').forEach(s => io.observe(s))

  const onClick = (e: Event) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.mg-idx li')
    if (!li) return
    document.getElementById(`sec-${li.dataset.i}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }
  list.addEventListener('click', onClick)

  const onResize = () => moveRing(current)
  window.addEventListener('resize', onResize)

  return () => {
    io.disconnect()
    list.removeEventListener('click', onClick)
    window.removeEventListener('resize', onResize)
    label.remove()
  }
}

function start(): Cleanup {
  // Only the home page carries the `.mg` root — reliable guard across swup swaps.
  if (!document.querySelector('.mg')) return () => {}

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const cleanups = [fine && !reduce ? initMagnetic() : () => {}, initSectionIndex(reduce)]
  return () => cleanups.forEach(fn => fn())
}

// swup-safe lifecycle
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
