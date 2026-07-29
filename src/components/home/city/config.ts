// Camera choreography and scroll mapping for the Zanarkand top page.
//
// The model is authored in Blender, which is Z-up, and exported Y-up: a point
// written there as (bx, by, bz) arrives here as (bx, bz, -by). Everything in
// this file is already in three.js space — +Y is height, sea level is Y = 0,
// the ruin fills a basin about 620 units across centred on the origin, and the
// opening shot stands on its eastern rim looking west into the sunset.

export type Waypoint = {
  /** camera position */
  pos: [number, number, number]
  /** where it looks */
  target: [number, number, number]
}

/** Basin radius, mirrored from the generator. */
export const BASIN_R = 620

/**
 * The flight path.
 *
 * It is one move: from a standing shot on the rim, down across the water, in
 * among the ruins as they start to come back, and up and away as the finished
 * city closes over. Nothing doubles back — a scroll that retraces its own path
 * feels like a mistake in the page rather than a decision.
 */
/**
 * The orbit.
 *
 * One continuous turn around the arena, and that is the whole camera. The
 * previous version cut the scroll into five and parked at each — and every
 * stop broke the thread: you were somewhere, then you were somewhere else,
 * and nothing connected the two. A single circle means the reader always
 * knows where they are, because they never left.
 *
 * It starts on the composed opening frame — out on the rim, low, with the
 * dead city across the middle and the sun on the horizon — and tightens and
 * rises as it comes round, so the last third is over the city rather than
 * looking at it from the same distance as the first.
 */
export const ORBIT = {
  /** where it starts, in radians, measured the same way the model is laid out */
  startAngle: 0,
  /** a full turn */
  turns: 1,
  /** distance from the axis, at the start and at the end */
  // Ends well inside the district ring and well outside the arena itself, so
  // the last of the turn is a close pass round the sphere and the camera
  // never has anything to fly through.
  // Measured, not calculated: at 265 the sphere filled nine tenths of the
  // frame at three quarters of the way through. Whatever the arithmetic said,
  // the picture said stand further back.
  radius: [719, 452] as [number, number],
  /** height, likewise */
  height: [143, 155] as [number, number],
  /** what it looks at, rising as the city does */
  // The sphere sits at (0, 103, 0) once the city model is scaled and lifted,
  // so that is exactly where the shot ends up pointed — it was drifting to
  // (0, 104, 0) from a target that had never been checked against the model.
  // Not the sphere's own centre. Aimed there, the stands fell out of the
  // bottom of the frame and the shot became a portrait of a ball — the arena
  // is the thing that was built, and it has to be in the picture. A dozen
  // units lower puts the sphere just above the middle and the bowl under it.
  target: [
    [-341, 18, -12],
    [0, 91, 0],
  ] as [[number, number, number], [number, number, number]],
}

/** Kept for the fallback path; the orbit is what actually drives the camera. */
export const WAYPOINTS: Waypoint[] = [
  { pos: [719, 143, 0], target: [-341, 18, -12] },
  { pos: [300, 205, 0], target: [0, 104, 0] },
]

/** Chapters framed by hand rather than by the curve. `null` means "on the path". */
export const SECTION_CAMS: (Waypoint | null)[] = [null, null, null, null, null]

/** Vertical field of view. Narrow enough that the far towers keep their scale. */
export const FOV = 38

/**
 * The sun. Bearing 180° in the generator's frame — dead ahead of the opening
 * camera — and barely above the horizon.
 */
export const SUN_DIR: [number, number, number] = [-0.9993, 0.0384, 0]

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

/** The five chapters. Scroll progress is split evenly between them. */
export const SECTIONS: SectionSpec[] = [
  { id: 'sec-0', num: '00', name: '', label: 'HOME', side: 'left' },
  { id: 'sec-1', num: '01', name: 'Now', label: 'NOW', side: 'left' },
  { id: 'sec-2', num: '02', name: 'Selected Writing', label: 'WRITING', side: 'right' },
  { id: 'sec-3', num: '03', name: 'Skills', label: 'SKILLS', side: 'left' },
  { id: 'sec-4', num: '04', name: 'Generative', label: 'ART', side: 'right' },
]

/** Which side each chapter's panel sits on, so the shot can lean the other way. */
export const SECTION_SIDES = SECTIONS.map(s => s.side)

/** Scroll height, in viewport heights per chapter. */
export const VH_PER_SECTION = 78

/**
 * How far through the scroll the city rebuilds itself.
 *
 * It starts late and finishes early on purpose: the reader gets the ruin to
 * themselves for the first chapter, and the restored city to themselves for the
 * last, and the transformation happens in the middle where they are looking at
 * it rather than reading over it.
 */
export const RESTORE_RANGE: [number, number] = [0.18, 0.68]

/** Height, in world units, the restoration front travels as it rises. */
export const RESTORE_FRONT: [number, number] = [-40, 560]

/**
 * When the sky turns. The restored Zanarkand is a night city — the reference
 * is all starlight and window light — so the sunset burns down as the city
 * comes back, and the last chapter plays under stars.
 */
export const NIGHT_RANGE: [number, number] = [0.24, 0.70]

/**
 * The pyreflies do not arrive — they are simply always there.
 *
 * Kept as a range so the renderer's plumbing stays the same, but both ends are
 * zero: full strength from the first frame.
 */
export const PYRE_RANGE: [number, number] = [0, 0]
