// Camera choreography for the Zanarkand top page.
//
// The GLB is exported Y-up, so a point authored in Blender as (bx, by, bz)
// arrives here as (bx, bz, -by). Everything below is already in three.js space:
// +X is the direction of travel, +Y is height, sea level is Y = 0.

export type Waypoint = {
  /** camera position */
  pos: [number, number, number]
  /** where it looks */
  target: [number, number, number]
}

/**
 * The flight path. Sampled as a Catmull-Rom curve against scroll progress, so
 * the shape of this list is the shape of the whole experience:
 *
 *   a wide pass over the water → spiralling in past the arms → through the
 *   sphere itself → back out and up as dawn comes up
 */
export const WAYPOINTS: Waypoint[] = [
  // wide and high: the stadium alone on the water
  { pos: [300.0, 156, 0.0], target: [0, 40, 0] },
  { pos: [129.7, 124, 192.4], target: [0, 40, 0] },
  // down to rim height, the blades sweeping past
  { pos: [-75.4, 92, 154.6], target: [0, 40, 0] },
  { pos: [-126.8, 62, 17.8], target: [0, 34, 0] },
  // swinging round to line up with the pool's long axis
  { pos: [-30.8, 44, -84.6], target: [0, 30, 0] },
  { pos: [48.5, 32, -28.0], target: [0, 28, 0] },
  // held just outside the water
  { pos: [30.0, 27, 0.0], target: [0, 28, 0] },
  // Inside, and lingering. Placed so the scoreboard hangs dead ahead with a
  // goal at each edge of frame — the arrangement only reads from this narrow
  // band of positions, so the path is built around it rather than the other way
  // round, and two near-identical points hold the camera there.
  { pos: [17.0, 27, 0.0], target: [-16, 31, 0] },
  { pos: [12.0, 27, 0.0], target: [-18, 31, 0] },
  // out through the far wall
  { pos: [-22.0, 27, -3.0], target: [-60, 30, -16] },
  { pos: [-68.9, 48, -12.2], target: [0, 32, 0] },
  { pos: [-70.7, 90, -84.3], target: [0, 30, 0] },
  // rising away as dawn comes up
  { pos: [0.0, 158, -95.0], target: [0, 25, 0] },
]

/** Radius of the sphere pool, for the shot through the water. */
export const POOL_RADIUS = 21

/** Vertical field of view. Wide enough that landmarks read as whole objects. */
export const FOV = 46

/** Where the sphere pool sits, for the framing shot and the water reflection. */
export const POOL = { x: 0, y: 25, z: 0, half: 21 }

/** The bowl the camera orbits. */
export const STADIUM = { x: 0, z: 0, radius: 58, rimHeight: 31 }

export type SectionSpec = {
  id: string
  num: string
  /** chapter heading; empty for the hero */
  name: string
  /** short label for the floating index */
  label: string
  /** which side of the viewport the panel sits on */
  side: 'left' | 'right'
}

/**
 * The five chapters. Content is unchanged from the previous top page — only the
 * way it is revealed is new. Scroll progress is split evenly between them.
 */
export const SECTIONS: SectionSpec[] = [
  { id: 'sec-0', num: '00', name: '', label: 'HOME', side: 'left' },
  { id: 'sec-1', num: '01', name: 'Now', label: 'NOW', side: 'left' },
  { id: 'sec-2', num: '02', name: 'Selected Writing', label: 'WRITING', side: 'right' },
  { id: 'sec-3', num: '03', name: 'Skills', label: 'SKILLS', side: 'left' },
  { id: 'sec-4', num: '04', name: 'Generative', label: 'ART', side: 'right' },
]

/**
 * Scroll height, in viewport heights per chapter. The orbit is one continuous
 * move, so this is purely how long the reader has to spend on it — 125 made the
 * page feel like a chore to get through.
 */
export const VH_PER_SECTION = 78

/**
 * How far through the scroll the city finishes rebuilding itself. The ruin is
 * whole again a little before the end so the final chapter plays against the
 * restored skyline rather than during the transition.
 */
export const RESTORE_RANGE: [number, number] = [0.20, 0.86]

/** Height, in world units, the restoration front travels as it rises. */
export const RESTORE_FRONT: [number, number] = [-24, 300]
