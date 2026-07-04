// Content + structure for the home (Margiela-styled) page.
// Shared by the server-rendered sections and the client interaction module.

export type Writing = {
  date: string
  title: string
  url: string
  kind: 'Talk' | 'Blog'
}

export const writings: Writing[] = [
  {
    date: '2026/01',
    title: 'カード番号を扱わずに決済を成立させる仕組み ── トークナイゼーション入門',
    url: 'https://blog.smartbank.co.jp/entry/2026/01/28/183000',
    kind: 'Blog',
  },
  {
    date: '2025/03',
    title: 'バーチャルカード発行の排他制御 〜 無駄な発行を防ぐシンプルなアプローチ〜',
    url: 'https://blog.smartbank.co.jp/entry/2025/03/19/123000',
    kind: 'Blog',
  },
  {
    date: '2024/12',
    title: 'インデックスの"正解"を探せ！決済レスポンスタイムを改善したパフォーマンスチューニング',
    url: 'https://blog.smartbank.co.jp/entry/2024/12/26/152742',
    kind: 'Blog',
  },
  {
    date: '2024/04',
    title: 'サクッと自分専用のサポートAIをつくってチューニングする',
    url: 'https://speakerdeck.com/ryomak/sakututozi-fen-zhuan-yong-no-sapotoaiwotukutute-tiyuningusuru',
    kind: 'Talk',
  },
]

export const skills = [
  'Go',
  'Java',
  'Ruby on Rails',
  'TypeScript',
  'React',
  'Astro',
  'Docker',
  'GCP',
  'Firebase',
]

export const mainFocus = ['決済領域', 'Go', 'Project']

export const nowLead = '決済システムを開発・運用するエンジニア。'

export type HomeSection = {
  index: number
  id: string
  num: string
  /** chapter heading; empty for the hero */
  name: string
  /** short label shown in the floating section index */
  label: string
}

export const sections: HomeSection[] = [
  { index: 0, id: 'sec-0', num: '00', name: '', label: 'HOME' },
  { index: 1, id: 'sec-1', num: '01', name: 'Now', label: 'NOW' },
  { index: 2, id: 'sec-2', num: '02', name: 'Selected Writing', label: 'WRITING' },
  { index: 3, id: 'sec-3', num: '03', name: 'Skills', label: 'SKILLS' },
  { index: 4, id: 'sec-4', num: '04', name: 'Generative', label: 'ART' },
]

export const sectionLabels = sections.map(s => s.label)
