// Content chapters. Camera and world choreography live in journey.ts.
export type SectionSpec = {
  id: string
  num: string
  name: string
  label: string
  side: 'left' | 'right'
}

export const SECTIONS: SectionSpec[] = [
  { id: 'sec-0', num: '00', name: '', label: 'HOME', side: 'left' },
  { id: 'sec-1', num: '01', name: 'Now', label: 'NOW', side: 'left' },
  {
    id: 'sec-2',
    num: '02',
    name: 'Selected Writing',
    label: 'WRITING',
    side: 'right',
  },
  { id: 'sec-3', num: '03', name: 'Generative', label: 'ART', side: 'right' },
]

export const VH_PER_SECTION = 110
