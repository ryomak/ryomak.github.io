import React, { useEffect, useState } from 'react'
import { HeroScene, CITY_SECTIONS } from './HeroScene'

const SECTIONS = [
  {
    id: 'intro',
    title: 'RYOMAK',
    subtitle: 'Backend Engineer',
    content: null,
  },
  {
    id: 'about',
    title: 'About',
    subtitle: 'Who I Am',
    content: (
      <div className="space-y-6 text-lg leading-relaxed max-w-xl">
        <p>
          決済システム、カウンセリングサービス、家計簿アプリなど、
          人々の生活を支えるプロダクトのバックエンドを設計・開発してきました。
        </p>
        <p>
          目に見えないけれど、なくてはならない。
          そんなシステムを作ることに情熱を注いでいます。
        </p>
      </div>
    ),
  },
  {
    id: 'career',
    title: 'Career',
    subtitle: 'Experience',
    content: (
      <div className="space-y-6">
        {[
          { period: '2024.03 -', company: 'SmartBank', role: '家計簿プリカ' },
          { period: '2020.11 - 2024.02', company: 'Unlace', role: 'カウンセリング' },
          { period: '2019.04 - 2020.10', company: 'Yahoo Japan', role: '決済システム' },
        ].map((item, i) => (
          <div key={i} className="border-l-2 border-[#00fff0]/50 pl-6">
            <p className="text-[#00fff0] font-mono text-sm">{item.period}</p>
            <h3 className="text-2xl font-light">{item.company}</h3>
            <p className="text-[#7a8a9a]">{item.role}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'skills',
    title: 'Skills',
    subtitle: 'Technologies',
    content: (
      <div className="flex flex-wrap gap-3">
        {['Go', 'TypeScript', 'React', 'PostgreSQL', 'AWS', 'GCP', 'Docker', 'Firebase'].map((skill) => (
          <span
            key={skill}
            className="px-5 py-2 border border-[#00fff0]/40 text-lg
                       hover:border-[#00fff0] hover:shadow-[0_0_15px_rgba(0,255,136,0.3)]
                       transition-all cursor-default"
          >
            {skill}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: 'works',
    title: 'Works',
    subtitle: 'Projects',
    content: (
      <div className="grid grid-cols-1 gap-4 max-w-md">
        {[
          { name: 'serrs', desc: 'Go error handling' },
          { name: 'gogener', desc: 'Go generics codegen' },
          { name: 'p5go', desc: 'Processing for Go' },
        ].map((work) => (
          <a
            key={work.name}
            href={`https://github.com/ryomak/${work.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-5 border border-[#00fff0]/30
                       hover:border-[#00fff0] hover:bg-[#00fff0]/5
                       transition-all"
          >
            <h3 className="text-xl group-hover:text-[#00fff0] transition-colors">{work.name}</h3>
            <p className="text-[#7a8a9a] text-sm">{work.desc}</p>
          </a>
        ))}
      </div>
    ),
  },
]

export const Portfolio3DContent: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [currentSection, setCurrentSection] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = Math.min(window.scrollY / scrollHeight, 1)
      setScrollProgress(progress)
      setCurrentSection(Math.min(Math.floor(progress * SECTIONS.length), SECTIONS.length - 1))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const sectionProgress = (scrollProgress * SECTIONS.length) % 1

  return (
    <div className="relative" style={{ height: `${SECTIONS.length * 100}vh`, background: '#2a1f3d' }}>
      {/* Fixed 3D Background - Bright Stadium */}
      <div className="fixed inset-0 z-0">
        <HeroScene className="w-full h-full" scrollProgress={scrollProgress} />
      </div>

      {/* Section indicator */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 text-center">
        <p className="text-[#00fff0]/60 text-xs tracking-[0.3em] uppercase">
          {CITY_SECTIONS[currentSection] || 'Welcome'}
        </p>
      </div>

      {/* Navigation dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => {
              const targetScroll = (i / SECTIONS.length) * (document.documentElement.scrollHeight - window.innerHeight)
              window.scrollTo({ top: targetScroll, behavior: 'smooth' })
            }}
            className="group flex items-center gap-3"
          >
            <span
              className={`text-xs tracking-wider transition-all ${
                currentSection === i ? 'text-[#00fff0] opacity-100' : 'text-[#7a8a9a] opacity-0 group-hover:opacity-100'
              }`}
            >
              {section.title}
            </span>
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                currentSection === i
                  ? 'bg-[#00fff0] shadow-[0_0_10px_#00fff0]'
                  : 'bg-[#7a8a9a]/30 group-hover:bg-[#7a8a9a]'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Social links */}
      <div className="fixed top-6 right-6 z-50 flex gap-6 text-sm">
        <a href="https://github.com/ryomak" target="_blank" rel="noopener noreferrer"
           className="text-[#7a8a9a] hover:text-[#00fff0] transition-colors">
          GitHub
        </a>
        <a href="https://twitter.com/ryomak_13" target="_blank" rel="noopener noreferrer"
           className="text-[#7a8a9a] hover:text-[#00fff0] transition-colors">
          X
        </a>
      </div>

      {/* Content overlay */}
      <div className="fixed inset-0 z-10 pointer-events-none">
        {SECTIONS.map((section, i) => {
          const isActive = currentSection === i
          const opacity = isActive ? Math.min(1, 1 - Math.abs(sectionProgress - 0.5) * 2) : 0

          return (
            <div
              key={section.id}
              className="absolute inset-0 flex items-center transition-opacity duration-300"
              style={{
                opacity,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="w-full max-w-6xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Left: Title */}
                <div
                  className={`${i === 0 ? 'md:col-span-2 text-center' : ''} p-6 rounded-xl`}
                  style={{
                    background: 'rgba(10, 14, 26, 0.85)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {i > 0 && (
                    <p className="text-[#ffd700] text-sm tracking-[0.3em] uppercase mb-4 font-bold">
                      {section.subtitle}
                    </p>
                  )}
                  <h1
                    className={`font-bold tracking-wider text-white ${
                      i === 0 ? 'text-7xl md:text-9xl' : 'text-5xl md:text-6xl'
                    }`}
                    style={{ textShadow: '0 0 20px rgba(255,215,0,0.5), 2px 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {section.title}
                  </h1>
                  {i === 0 && (
                    <p className="text-[#ffd700] text-xl tracking-[0.2em] mt-6 uppercase font-bold">
                      {section.subtitle}
                    </p>
                  )}
                </div>

                {/* Right: Content */}
                {section.content && (
                  <div
                    className="text-white pointer-events-auto p-6 rounded-xl"
                    style={{
                      background: 'rgba(10, 14, 26, 0.85)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {section.content}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll indicator */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-500"
        style={{ opacity: scrollProgress < 0.05 ? 1 : 0 }}
      >
        <div className="flex flex-col items-center gap-2">
          <p className="text-[#7a8a9a] text-xs tracking-widest uppercase">Scroll to explore</p>
          <div className="w-px h-12 bg-gradient-to-b from-[#00fff0] to-transparent animate-pulse" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-px z-50">
        <div
          className="h-full bg-[#00fff0] transition-all duration-100"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>
    </div>
  )
}
