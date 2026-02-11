import * as THREE from 'three'

// Kawaii pastel color palette
export const CYBERPUNK_COLORS = {
  deepNavy: '#f5e6ff',      // Light lavender (was dark)
  cyanNeon: '#7dd3fc',      // Soft sky blue
  magentaNeon: '#f9a8d4',   // Soft pink
  // Pastel accents
  purpleNeon: '#c4b5fd',    // Soft lavender
  pinkNeon: '#fda4af',      // Soft coral pink
  darkBlue: '#e0f2fe',      // Very light blue
  darkPurple: '#f3e8ff',    // Very light purple
}

// Voxel color palette (Kawaii Pastel theme)
export const VOXEL_COLORS = {
  // Building colors - Cute pastel styled
  office: {
    base: '#fce7f3',        // Light pink
    window: '#7dd3fc',      // Sky blue
    windowLit: '#fef08a',   // Soft yellow (lit)
    accent: '#f9a8d4',      // Pink accent
  },
  shop: {
    base: '#e0f2fe',        // Light blue
    window: '#fef08a',      // Soft yellow
    roof: '#fda4af',        // Coral pink
    sign: '#c4b5fd',        // Lavender
  },
  gallery: {
    base: '#fef3c7',        // Cream yellow
    window: '#a5f3fc',      // Light cyan
    accent: '#d8b4fe',      // Light purple
    frame: '#fecaca',       // Light red/pink
  },
  home: {
    base: '#dcfce7',        // Mint green
    roof: '#fda4af',        // Coral pink
    window: '#fef08a',      // Soft yellow
    door: '#f9a8d4',        // Pink
  },
  // Environment colors - Bright and cheerful
  road: '#e5e7eb',          // Light gray
  sidewalk: '#f5f5f4',      // Off white
  grass: '#bbf7d0',         // Mint green
  tree: {
    trunk: '#d6b498',       // Warm beige/tan
    leaves: '#86efac',      // Bright mint
  },
  streetLight: {
    pole: '#d4d4d8',        // Silver gray
    light: '#fef9c3',       // Warm yellow
  },
  // Tech logo colors - Pastel styled
  go: '#7dd3fc',            // Sky blue
  typescript: '#93c5fd',    // Soft blue
  react: '#a5f3fc',         // Light cyan
  python: '#fde68a',        // Soft yellow
  rust: '#fdba74',          // Soft orange
}

// Create a single voxel (cube)
export const createVoxelGeometry = (size: number = 1): THREE.BoxGeometry => {
  return new THREE.BoxGeometry(size, size, size)
}

// Shared geometry for instancing
let sharedVoxelGeometry: THREE.BoxGeometry | null = null

export const getSharedVoxelGeometry = (size: number = 1): THREE.BoxGeometry => {
  if (!sharedVoxelGeometry) {
    sharedVoxelGeometry = createVoxelGeometry(size)
  }
  return sharedVoxelGeometry
}

// Position type for voxel placement
export interface VoxelPosition {
  x: number
  y: number
  z: number
  color?: string
}

// Generate voxel positions for a box shape
export const generateBoxVoxels = (
  width: number,
  height: number,
  depth: number,
  color: string,
  offset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
): VoxelPosition[] => {
  const voxels: VoxelPosition[] = []

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        // Only add surface voxels for optimization
        const isSurface =
          x === 0 || x === width - 1 ||
          y === 0 || y === height - 1 ||
          z === 0 || z === depth - 1

        if (isSurface) {
          voxels.push({
            x: x + offset.x,
            y: y + offset.y,
            z: z + offset.z,
            color,
          })
        }
      }
    }
  }

  return voxels
}

// Generate window pattern for buildings
export const generateWindowPattern = (
  width: number,
  height: number,
  startY: number,
  windowColor: string,
  litColor: string,
  depth: number,
  offset: { x: number; z: number } = { x: 0, z: 0 }
): VoxelPosition[] => {
  const windows: VoxelPosition[] = []
  const windowSpacing = 2

  for (let y = startY; y < height - 1; y += windowSpacing) {
    for (let x = 1; x < width - 1; x += windowSpacing) {
      const isLit = Math.random() > 0.5
      // Front face windows
      windows.push({
        x: x + offset.x,
        y,
        z: depth + offset.z,
        color: isLit ? litColor : windowColor,
      })
      // Back face windows
      windows.push({
        x: x + offset.x,
        y,
        z: -1 + offset.z,
        color: isLit ? litColor : windowColor,
      })
    }
  }

  return windows
}

// Dispose helper
export const disposeVoxelGeometry = (): void => {
  if (sharedVoxelGeometry) {
    sharedVoxelGeometry.dispose()
    sharedVoxelGeometry = null
  }
}
