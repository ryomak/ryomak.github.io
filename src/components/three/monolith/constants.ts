// Monolithic Void カラーパレット
export const MONOLITH_COLORS = {
  // Base Colors (モノクローム)
  void: '#0A0A0C',
  darkGray: '#151518',
  midGray: '#2A2A30',
  lightGray: '#4A4A55',
  offWhite: '#E8E8EC',

  // Accent (グリーン - themeHue: 160)
  accent: '#10B981',
  accentGlow: '#34D399',
  accentSubtle: 'rgba(16, 185, 129, 0.2)',

  // Surface
  concrete: '#3D3D45',
  matte: '#252528',
} as const

// セクション定義
export const SECTIONS = [
  {
    id: 'intro',
    title: 'ryomak',
    subtitle: 'Backend Engineer',
  },
  {
    id: 'career',
    title: 'Career',
    subtitle: 'Experience',
  },
  {
    id: 'skills',
    title: 'Skills',
    subtitle: 'Technologies',
  },
  {
    id: 'works',
    title: 'Works',
    subtitle: 'OSS Projects',
  },
] as const

export type SectionId = typeof SECTIONS[number]['id']
