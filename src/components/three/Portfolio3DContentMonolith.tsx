import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MonolithScene } from './monolith/MonolithScene'
import { MONOLITH_COLORS, SECTIONS } from './monolith/constants'

// ナビゲーションドット
const NavDot: React.FC<{
  section: typeof SECTIONS[number]
  isActive: boolean
  onClick: () => void
}> = ({ section, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex items-center gap-3 py-1"
      aria-label={`Navigate to ${section.title}`}
    >
      <span
        className="text-xs tracking-wider transition-all duration-300 transform"
        style={{
          color: isActive ? MONOLITH_COLORS.accent : MONOLITH_COLORS.lightGray,
          opacity: isActive || isHovered ? 1 : 0,
          transform: isActive || isHovered ? 'translateX(0)' : 'translateX(10px)',
        }}
      >
        {section.title}
      </span>
      <div
        className="relative transition-all duration-300"
        style={{
          width: isActive ? '12px' : '8px',
          height: isActive ? '12px' : '8px',
        }}
      >
        <div
          className="absolute inset-0 rounded-full transition-all duration-300"
          style={{
            backgroundColor: isActive ? MONOLITH_COLORS.accent : MONOLITH_COLORS.midGray,
            boxShadow: isActive
              ? `0 0 15px ${MONOLITH_COLORS.accent}, 0 0 30px ${MONOLITH_COLORS.accentSubtle}`
              : 'none',
            transform: isHovered && !isActive ? 'scale(1.3)' : 'scale(1)',
          }}
        />
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              backgroundColor: MONOLITH_COLORS.accent,
              opacity: 0.3,
            }}
          />
        )}
      </div>
    </button>
  )
}

// セクションコンテンツカード
const ContentCard: React.FC<{
  children: React.ReactNode
  className?: string
  isCenter?: boolean
}> = ({ children, className = '', isCenter = false }) => (
  <div
    className={`${isCenter ? 'md:col-span-2 text-center' : ''} p-8 rounded-lg backdrop-blur-md ${className}`}
    style={{
      background: `${MONOLITH_COLORS.darkGray}E6`,
      border: `1px solid ${MONOLITH_COLORS.midGray}`,
      boxShadow: `0 4px 30px rgba(0, 0, 0, 0.3)`,
    }}
  >
    {children}
  </div>
)

interface WorkItem {
  name: string
  desc: string
  url: string
}

interface Portfolio3DContentMonolithProps {
  works?: WorkItem[]
}

// デフォルトのWorks（フォールバック用）
const DEFAULT_WORKS: WorkItem[] = [
  { name: 'serrs', desc: 'Goアプリケーション用エラーハンドリングライブラリ', url: 'https://github.com/ryomak/serrs' },
  { name: 'gogener', desc: 'テンプレートからコードを生成するツール', url: 'https://github.com/ryomak/gogener' },
  { name: 'p5go', desc: 'GoでP5.jsを実行するライブラリ', url: 'https://github.com/ryomak/p5go' },
]

export const Portfolio3DContentMonolith: React.FC<Portfolio3DContentMonolithProps> = ({ works = DEFAULT_WORKS }) => {
  const [currentSection, setCurrentSection] = useState(0)
  const isAnimatingRef = useRef(false)
  const currentSectionRef = useRef(0)

  // refを同期
  useEffect(() => {
    currentSectionRef.current = currentSection
  }, [currentSection])

  // セクション移動
  const navigateToSection = useCallback((index: number) => {
    if (isAnimatingRef.current || index < 0 || index >= SECTIONS.length) return
    isAnimatingRef.current = true
    setCurrentSection(index)
    currentSectionRef.current = index
    setTimeout(() => {
      isAnimatingRef.current = false
    }, 600)
  }, [])

  // ホイールイベントでスナップスクロール
  useEffect(() => {
    let accumulatedDelta = 0
    let lastTime = 0

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const now = Date.now()
      // 100ms以上経過したらリセット
      if (now - lastTime > 100) {
        accumulatedDelta = 0
      }
      lastTime = now

      accumulatedDelta += e.deltaY

      // 累積が閾値を超えたらナビゲート
      if (accumulatedDelta > 50) {
        navigateToSection(currentSectionRef.current + 1)
        accumulatedDelta = 0
      } else if (accumulatedDelta < -50) {
        navigateToSection(currentSectionRef.current - 1)
        accumulatedDelta = 0
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
    }
  }, [navigateToSection])

  // キーボードナビゲーション
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        navigateToSection(currentSectionRef.current + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        navigateToSection(currentSectionRef.current - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateToSection])

  // タッチスワイプ対応
  const touchStartY = useRef(0)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY
      if (deltaY > 50) {
        navigateToSection(currentSectionRef.current + 1)
      } else if (deltaY < -50) {
        navigateToSection(currentSectionRef.current - 1)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigateToSection])

  // 3Dシーン用のスクロール進捗
  const scrollProgress = currentSection / (SECTIONS.length - 1)

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: MONOLITH_COLORS.void }}
    >
      {/* Fixed 3D Background */}
      <div className="fixed inset-0 z-0">
        <MonolithScene className="w-full h-full" scrollProgress={scrollProgress} />
      </div>

      {/* Navigation dots */}
      <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {SECTIONS.map((section, i) => (
          <NavDot
            key={section.id}
            section={section}
            isActive={currentSection === i}
            onClick={() => navigateToSection(i)}
          />
        ))}
      </nav>

      {/* Social links */}
      <div className="fixed top-6 right-6 z-50 flex gap-6 text-sm">
        {[
          { label: 'GitHub', url: 'https://github.com/ryomak' },
          { label: 'X', url: 'https://twitter.com/ryomak_13' },
          { label: 'Zenn', url: 'https://zenn.dev/ryomak' },
        ].map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative group transition-colors duration-300"
            style={{ color: MONOLITH_COLORS.lightGray }}
          >
            <span className="group-hover:opacity-0 transition-opacity duration-300">
              {link.label}
            </span>
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ color: MONOLITH_COLORS.accent }}
            >
              {link.label}
            </span>
          </a>
        ))}
      </div>

      {/* Content overlay */}
      <div className="fixed inset-0 z-30 pointer-events-none">
        {SECTIONS.map((section, i) => {
          const isActive = currentSection === i

          return (
            <div
              key={section.id}
              className="absolute inset-0 flex items-center transition-all duration-700 ease-out"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : `translateY(${i < currentSection ? -50 : 50}px)`,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="w-full max-w-6xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Title Card */}
                <ContentCard isCenter={i === 0}>
                  {i > 0 && (
                    <p
                      className="text-sm tracking-[0.3em] uppercase mb-4 font-medium"
                      style={{ color: MONOLITH_COLORS.accent }}
                    >
                      {section.subtitle}
                    </p>
                  )}
                  <h1
                    className={`font-bold tracking-wider ${
                      i === 0 ? 'text-6xl md:text-8xl lg:text-9xl' : 'text-4xl md:text-5xl lg:text-6xl'
                    }`}
                    style={{ color: MONOLITH_COLORS.offWhite }}
                  >
                    {section.title}
                  </h1>
                  {i === 0 && (
                    <p
                      className="text-lg md:text-xl tracking-[0.2em] mt-6 uppercase font-medium"
                      style={{ color: MONOLITH_COLORS.accent }}
                    >
                      {section.subtitle}
                    </p>
                  )}
                </ContentCard>

                {/* Career Content */}
                {i === 1 && (
                  <ContentCard className="pointer-events-auto">
                    <div className="space-y-6">
                      {[
                        { period: '2024.03 -', company: '株式会社スマートバンク', role: '家計簿プリカサービスの開発・運用' },
                        { period: '2020.11 - 2024.02', company: '株式会社Unlace', role: 'カウンセリングサービスの開発・運用' },
                        { period: '2019.04 - 2020.10', company: 'ヤフー株式会社', role: '決済システムの開発・運用' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="pl-6 transition-all duration-300 hover:translate-x-1"
                          style={{ borderLeft: `2px solid ${MONOLITH_COLORS.accent}` }}
                        >
                          <p
                            className="font-mono text-sm"
                            style={{ color: MONOLITH_COLORS.accent }}
                          >
                            {item.period}
                          </p>
                          <h3
                            className="text-xl md:text-2xl font-light"
                            style={{ color: MONOLITH_COLORS.offWhite }}
                          >
                            {item.company}
                          </h3>
                          <p style={{ color: MONOLITH_COLORS.lightGray }}>{item.role}</p>
                        </div>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {/* Skills Content */}
                {i === 2 && (
                  <ContentCard className="pointer-events-auto">
                    <div className="flex flex-wrap gap-3">
                      {['Go', 'TypeScript', 'React', 'Java', 'Docker', 'GCP', 'Firebase', 'Astro'].map(
                        (skill) => (
                          <span
                            key={skill}
                            className="px-4 md:px-5 py-2 text-base md:text-lg cursor-default transition-all duration-300 hover:scale-105"
                            style={{
                              border: `1px solid ${MONOLITH_COLORS.accent}40`,
                              color: MONOLITH_COLORS.offWhite,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = MONOLITH_COLORS.accent
                              e.currentTarget.style.boxShadow = `0 0 20px ${MONOLITH_COLORS.accentSubtle}`
                              e.currentTarget.style.color = MONOLITH_COLORS.accent
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = `${MONOLITH_COLORS.accent}40`
                              e.currentTarget.style.boxShadow = 'none'
                              e.currentTarget.style.color = MONOLITH_COLORS.offWhite
                            }}
                          >
                            {skill}
                          </span>
                        )
                      )}
                    </div>
                  </ContentCard>
                )}

                {/* Works Content */}
                {i === 3 && (
                  <ContentCard className="pointer-events-auto">
                    <div className="grid grid-cols-1 gap-4 max-w-md max-h-[60vh] overflow-y-auto">
                      {works.map((work) => (
                        <a
                          key={work.name}
                          href={work.url}
                          target={work.url.startsWith('http') ? '_blank' : undefined}
                          rel={work.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="block p-5 transition-all duration-300 hover:translate-x-1"
                          style={{
                            border: `1px solid ${MONOLITH_COLORS.accent}30`,
                            color: MONOLITH_COLORS.offWhite,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = MONOLITH_COLORS.accent
                            e.currentTarget.style.background = `${MONOLITH_COLORS.accent}10`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = `${MONOLITH_COLORS.accent}30`
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <h3
                            className="text-lg md:text-xl font-medium"
                            style={{ color: MONOLITH_COLORS.offWhite }}
                          >
                            {work.name}
                          </h3>
                          <p className="text-sm" style={{ color: MONOLITH_COLORS.lightGray }}>
                            {work.desc}
                          </p>
                        </a>
                      ))}
                    </div>
                  </ContentCard>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll indicator */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 transition-all duration-700"
        style={{
          opacity: currentSection === 0 ? 1 : 0,
          transform: `translate(-50%, ${currentSection === 0 ? '0' : '20px'})`,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <p
            className="text-xs tracking-[0.2em] uppercase"
            style={{ color: MONOLITH_COLORS.lightGray }}
          >
            Scroll to explore
          </p>
          <div className="relative w-6 h-10 rounded-full border-2" style={{ borderColor: MONOLITH_COLORS.lightGray }}>
            <div
              className="absolute left-1/2 top-2 -translate-x-1/2 w-1 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: MONOLITH_COLORS.accent }}
            />
          </div>
        </div>
      </div>

      {/* Section indicator */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2">
        <span
          className="font-mono text-sm"
          style={{ color: MONOLITH_COLORS.accent }}
        >
          {String(currentSection + 1).padStart(2, '0')}
        </span>
        <div
          className="w-12 h-px"
          style={{ background: MONOLITH_COLORS.midGray }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((currentSection + 1) / SECTIONS.length) * 100}%`,
              background: MONOLITH_COLORS.accent,
            }}
          />
        </div>
        <span
          className="font-mono text-sm"
          style={{ color: MONOLITH_COLORS.midGray }}
        >
          {String(SECTIONS.length).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
