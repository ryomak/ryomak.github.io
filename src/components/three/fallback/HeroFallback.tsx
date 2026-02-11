import type React from 'react'

interface HeroFallbackProps {
  className?: string
}

export const HeroFallback: React.FC<HeroFallbackProps> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center ${className}`}
      style={{
        background: 'radial-gradient(ellipse at center, #151B28 0%, #0A0E17 100%)',
      }}
    >
      <div
        className="w-48 h-48 md:w-64 md:h-64 rounded-full border border-[#00F5D4]/30"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(0,245,212,0.1) 0%, transparent 60%)',
          boxShadow: '0 0 60px rgba(0,245,212,0.2), inset 0 0 40px rgba(155,93,229,0.1)',
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .w-48, .w-64 {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
