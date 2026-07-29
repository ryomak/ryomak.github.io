/**
 * Deck runtime.
 *
 * The markup is already a list of <section class="slide"> inside a fixed-size
 * stage; this only decides which one is visible, how big the stage is drawn,
 * and what the keyboard does.
 */

const STAGE_W = 1280
const STAGE_H = 720

const deck = document.querySelector<HTMLElement>('[data-deck]')
const stage = document.querySelector<HTMLElement>('[data-deck-stage]')

if (deck && stage) {
  const slides = Array.from(stage.querySelectorAll<HTMLElement>('.slide'))
  const total = Math.max(slides.length, 1)
  const currentEl = document.querySelector<HTMLElement>('[data-deck-current]')
  const totalEl = document.querySelector<HTMLElement>('[data-deck-total]')
  const progress = document.querySelector<HTMLElement>('[data-deck-progress] i')
  const help = document.querySelector<HTMLElement>('[data-deck-help]')
  const clock = document.querySelector<HTMLElement>('[data-deck-clock]')
  const thumbs = document.querySelector<HTMLElement>('[data-deck-thumbs]')
  const thumbsList = document.querySelector<HTMLOListElement>('[data-deck-thumbs-list]')
  const presenter = document.querySelector<HTMLElement>('[data-deck-presenter]')
  const currentTitleEl = document.querySelector<HTMLElement>('[data-deck-current-title]')
  const nextTitleEl = document.querySelector<HTMLElement>('[data-deck-next-title]')
  const fullscreenButton = document.querySelector<HTMLElement>('[data-deck-fullscreen]')

  if (totalEl) totalEl.textContent = String(total)

  const clamp = (n: number) => Math.min(Math.max(n, 0), total - 1)
  const fromHash = () => clamp((Number.parseInt(location.hash.slice(1), 10) || 1) - 1)
  const titleFor = (slide: HTMLElement, i: number) =>
    slide.querySelector('h1, h2, h3')?.textContent?.trim() || `Slide ${i + 1}`

  let index = fromHash()
  let overview = false
  let thumbsOpen = false

  slides.forEach((slide, i) => {
    slide.classList.toggle('has-image', !!slide.querySelector('img'))
    slide.classList.toggle('is-image-only', slide.querySelectorAll('img').length === 1 && !slide.textContent?.trim())
    slide.style.setProperty('--slide-no', String(i + 1))
  })

  async function renderMermaid() {
    const isMermaidSource = (source: string) =>
      /^(sequenceDiagram|graph\s+(?:TD|TB|BT|RL|LR)|flowchart\s+(?:TD|TB|BT|RL|LR)|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|gitGraph)\b/.test(source.trim())

    const blocks = slides.flatMap(slide =>
      Array.from(slide.querySelectorAll<HTMLElement>('pre code, code.language-mermaid')).filter(block => {
        const source = block.textContent?.trim() ?? ''
        return block.classList.contains('language-mermaid') || isMermaidSource(source)
      })
    )
    if (blocks.length === 0) return

    blocks.forEach((block, i) => {
      const source = block.textContent?.trim()
      if (!source) return
      const host = document.createElement('div')
      host.className = 'mermaid'
      host.dataset.mermaidBlock = String(i)
      host.textContent = source
      const pre = block.closest('pre')
      ;(pre ?? block).replaceWith(host)
    })

    const mermaid = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
    mermaid.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: 'transparent',
        primaryColor: '#141b2a',
        primaryTextColor: '#ece7dc',
        primaryBorderColor: '#7fe6ff',
        lineColor: '#7fe6ff',
        secondaryColor: '#24324b',
        tertiaryColor: '#0f1420',
        actorBorder: '#7fe6ff',
        actorBkg: '#141b2a',
        actorTextColor: '#ece7dc',
        signalColor: '#ece7dc',
        signalTextColor: '#ece7dc',
        noteBkgColor: '#23314a',
        noteTextColor: '#ece7dc',
        noteBorderColor: '#ffcf6d',
      },
    })
    await mermaid.default.run({ nodes: Array.from(stage.querySelectorAll('.mermaid')) })
    slides.forEach(slide => slide.classList.toggle('has-mermaid', !!slide.querySelector('.mermaid')))
  }

  const thumbButtons: HTMLButtonElement[] = []
  if (thumbsList) {
    slides.forEach((slide, i) => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      const title = document.createElement('span')
      const meta = document.createElement('small')
      button.type = 'button'
      button.dataset.thumb = String(i)
      title.textContent = titleFor(slide, i)
      meta.textContent = `${i + 1} / ${total}`
      button.append(title, meta)
      button.addEventListener('click', () => {
        go(i)
      })
      item.append(button)
      thumbsList.append(item)
      thumbButtons.push(button)
    })
  }

  function toggleThumbs(force?: boolean) {
    thumbsOpen = force ?? !thumbsOpen
    if (!thumbs) return
    thumbs.hidden = !thumbsOpen
    deck.classList.toggle('has-thumbs', thumbsOpen)
    fit()
    if (thumbsOpen) {
      thumbButtons[index]?.scrollIntoView({ block: 'nearest' })
    }
  }

  function togglePresenter(force?: boolean) {
    if (!presenter) return
    presenter.hidden = !(force ?? presenter.hidden)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  function renderFullscreenState() {
    if (!fullscreenButton) return
    const fullscreen = !!document.fullscreenElement
    fullscreenButton.textContent = fullscreen ? '⤢' : '⛶'
    fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Fullscreen')
    fullscreenButton.setAttribute('title', fullscreen ? 'Exit fullscreen (F / Esc)' : 'Fullscreen (F)')
  }

  function render() {
    slides.forEach((s, i) => {
      s.classList.toggle('is-current', i === index)
      s.classList.toggle('is-past', i < index)
      // keep past/future slides out of the tab order and off screen readers
      s.toggleAttribute('inert', i !== index && !overview)
    })
    thumbButtons.forEach((button, i) => {
      button.classList.toggle('is-current', i === index)
      button.setAttribute('aria-current', i === index ? 'true' : 'false')
    })
    if (currentEl) currentEl.textContent = String(index + 1)
    if (progress) progress.style.setProperty('--deck-progress', String(total <= 1 ? 1 : index / (total - 1)))
    if (currentTitleEl) currentTitleEl.textContent = titleFor(slides[index], index)
    if (nextTitleEl) nextTitleEl.textContent = index + 1 < total ? titleFor(slides[index + 1], index + 1) : 'End'
  }

  function go(next: number, push = true) {
    const target = clamp(next)
    if (target === index) return
    index = target
    if (push) history.replaceState(null, '', `#${index + 1}`)
    render()
  }

  /* ---------------------------------------------------------------- layout */
  // A phone held upright can't show a 16:9 stage at a readable size, so there
  // the stage stops being a scaled canvas and becomes an ordinary responsive
  // column that fills the screen (CSS does the type sizes; see slides.css).
  const portrait = window.matchMedia('(max-width: 768px) and (orientation: portrait)')

  // the stage is authored at a fixed size and scaled to fit, so a slide looks
  // the same on a laptop, a projector and a landscape phone
  function fit() {
    if (overview) {
      stage.style.transform = ''
      stage.style.left = ''
      return
    }
    const thumbsWidth = thumbsOpen && !portrait.matches ? Math.min(320, window.innerWidth * 0.28) + 24 : 0
    const availableWidth = Math.max(window.innerWidth - thumbsWidth, 360)
    const scale = Math.min(availableWidth / STAGE_W, window.innerHeight / STAGE_H)
    stage.style.left = `${thumbsWidth + availableWidth / 2}px`
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`
  }

  /* --------------------------------------------------------------- overview */
  function toggleOverview(force?: boolean) {
    overview = force ?? !overview
    deck.classList.toggle('is-overview', overview)
    fit()
    render()
    if (overview) {
      slides[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  /* -------------------------------------------------------------- keyboard */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
      case 'j':
        e.preventDefault()
        if (overview) toggleOverview(false)
        else go(index + 1)
        break
      case 'ArrowLeft':
      case 'PageUp':
      case 'k':
        e.preventDefault()
        go(index - 1)
        break
      case 'Home':
        e.preventDefault()
        go(0)
        break
      case 'End':
        e.preventDefault()
        go(total - 1)
        break
      case 'o':
        e.preventDefault()
        toggleOverview()
        break
      case 't':
        e.preventDefault()
        toggleThumbs()
        break
      case 's':
        e.preventDefault()
        togglePresenter()
        break
      case 'f':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'p':
        e.preventDefault()
        window.print()
        break
      case '?':
        e.preventDefault()
        if (help) help.toggleAttribute('hidden')
        break
      case 'Escape':
        if (document.fullscreenElement) document.exitFullscreen()
        else if (overview) toggleOverview(false)
        else if (thumbsOpen) toggleThumbs(false)
        else if (presenter && !presenter.hidden) togglePresenter(false)
        else help?.setAttribute('hidden', '')
        break
    }
  })

  /* ------------------------------------------------------- pointer / touch */
  deck.addEventListener('click', e => {
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, textarea, select, code, pre, .mermaid')) return
    if (overview) {
      const slide = target.closest<HTMLElement>('.slide')
      if (slide) {
        go(slides.indexOf(slide))
        toggleOverview(false)
      }
      return
    }
    // on a phone the slide itself scrolls, so tapping it must not also advance;
    // swiping and the on-screen arrows cover navigation there
    if (portrait.matches) return
    // tapping the left third goes back, anything else advances
    go(e.clientX < window.innerWidth / 3 ? index - 1 : index + 1)
  })

  document.querySelector('[data-deck-prev]')?.addEventListener('click', () => go(index - 1))
  document.querySelector('[data-deck-next]')?.addEventListener('click', () => go(index + 1))
  document.querySelector('[data-deck-overview]')?.addEventListener('click', () => toggleOverview())
  document.querySelector('[data-deck-thumbs-toggle]')?.addEventListener('click', () => toggleThumbs())
  document.querySelector('[data-deck-thumbs-close]')?.addEventListener('click', () => toggleThumbs(false))
  document.querySelector('[data-deck-fullscreen]')?.addEventListener('click', () => toggleFullscreen())
  document.querySelector('[data-deck-print]')?.addEventListener('click', () => window.print())
  document.querySelector('[data-deck-help-toggle]')?.addEventListener('click', () => help?.toggleAttribute('hidden'))

  let touchX = 0
  deck.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX }, { passive: true })
  deck.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1))
  }, { passive: true })

  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  document.addEventListener('fullscreenchange', renderFullscreenState)
  portrait.addEventListener('change', fit)
  window.addEventListener('hashchange', () => go(fromHash(), false))

  const started = Date.now()
  window.setInterval(() => {
    if (!clock) return
    const elapsed = Math.floor((Date.now() - started) / 1000)
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const ss = String(elapsed % 60).padStart(2, '0')
    clock.textContent = `${mm}:${ss}`
  }, 1000)

  fit()
  renderFullscreenState()
  render()
  renderMermaid().then(fit).catch(error => {
    console.warn('Failed to render mermaid diagrams', error)
  })
}
