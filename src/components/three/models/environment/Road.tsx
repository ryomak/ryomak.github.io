import { useMemo } from 'react'
import { VoxelGroup } from '../Voxel'
import { type VoxelPosition, VOXEL_COLORS } from '../VoxelUtils'

interface RoadProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  width?: number
  direction?: 'horizontal' | 'vertical'
  hasCrosswalk?: boolean
}

// Road segment
export const Road: React.FC<RoadProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  length = 10,
  width = 3,
  direction = 'horizontal',
  hasCrosswalk = false,
}) => {
  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const roadColor = VOXEL_COLORS.road
    const sidewalkColor = VOXEL_COLORS.sidewalk
    const lineColor = '#FFFFFF'

    const actualLength = direction === 'horizontal' ? length : width
    const actualWidth = direction === 'horizontal' ? width : length

    // Sidewalk (one layer)
    for (let x = -1; x <= actualLength; x++) {
      for (let z = -1; z <= actualWidth; z++) {
        const isSidewalk =
          x === -1 || x === actualLength ||
          z === -1 || z === actualWidth

        if (isSidewalk) {
          result.push({ x, y: 0, z, color: sidewalkColor })
        }
      }
    }

    // Road surface
    for (let x = 0; x < actualLength; x++) {
      for (let z = 0; z < actualWidth; z++) {
        result.push({ x, y: -0.1, z, color: roadColor })
      }
    }

    // Center line (dashed)
    const centerZ = Math.floor(actualWidth / 2)
    for (let x = 0; x < actualLength; x += 2) {
      result.push({ x, y: 0, z: centerZ, color: lineColor })
    }

    // Crosswalk
    if (hasCrosswalk) {
      const crosswalkStart = Math.floor(actualLength / 2) - 1
      for (let x = crosswalkStart; x < crosswalkStart + 3; x++) {
        for (let z = 0; z < actualWidth; z += 2) {
          result.push({ x, y: 0, z, color: lineColor })
        }
      }
    }

    return result
  }, [length, width, direction, hasCrosswalk])

  return (
    <group position={position} rotation={rotation}>
      <VoxelGroup voxels={voxels} size={0.5} receiveShadow />
    </group>
  )
}

interface IntersectionProps {
  position?: [number, number, number]
  size?: number
}

// Road intersection
export const Intersection: React.FC<IntersectionProps> = ({
  position = [0, 0, 0],
  size = 5,
}) => {
  const voxels = useMemo(() => {
    const result: VoxelPosition[] = []
    const roadColor = VOXEL_COLORS.road
    const sidewalkColor = VOXEL_COLORS.sidewalk
    const lineColor = '#FFFFFF'

    // Sidewalk corners
    const corners = [
      { x: -1, z: -1 },
      { x: -1, z: size },
      { x: size, z: -1 },
      { x: size, z: size },
    ]
    corners.forEach(({ x, z }) => {
      result.push({ x, y: 0, z, color: sidewalkColor })
    })

    // Road surface
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        result.push({ x, y: -0.1, z, color: roadColor })
      }
    }

    // Stop lines
    for (let i = 1; i < size - 1; i++) {
      result.push({ x: 1, y: 0, z: i, color: lineColor })
      result.push({ x: size - 2, y: 0, z: i, color: lineColor })
      result.push({ x: i, y: 0, z: 1, color: lineColor })
      result.push({ x: i, y: 0, z: size - 2, color: lineColor })
    }

    return result
  }, [size])

  return (
    <group position={position}>
      <VoxelGroup voxels={voxels} size={0.5} receiveShadow />
    </group>
  )
}

interface RoadGridProps {
  position?: [number, number, number]
  gridSize?: number
  blockSize?: number
}

// Complete road grid
export const RoadGrid: React.FC<RoadGridProps> = ({
  position = [0, 0, 0],
  gridSize = 3,
  blockSize = 8,
}) => {
  const roads = useMemo(() => {
    const result: Array<{
      type: 'road' | 'intersection'
      position: [number, number, number]
      direction?: 'horizontal' | 'vertical'
      length?: number
    }> = []

    // Create grid of roads and intersections
    for (let gx = 0; gx <= gridSize; gx++) {
      for (let gz = 0; gz <= gridSize; gz++) {
        const x = gx * blockSize
        const z = gz * blockSize

        // Intersection at grid points
        result.push({
          type: 'intersection',
          position: [x, 0, z],
        })

        // Horizontal roads
        if (gx < gridSize) {
          result.push({
            type: 'road',
            position: [x + 2.5, 0, z],
            direction: 'horizontal',
            length: blockSize - 5,
          })
        }

        // Vertical roads
        if (gz < gridSize) {
          result.push({
            type: 'road',
            position: [x, 0, z + 2.5],
            direction: 'vertical',
            length: blockSize - 5,
          })
        }
      }
    }

    return result
  }, [gridSize, blockSize])

  return (
    <group position={position}>
      {roads.map((road, i) => (
        road.type === 'intersection' ? (
          <Intersection key={i} position={road.position} />
        ) : (
          <Road
            key={i}
            position={road.position}
            direction={road.direction}
            length={road.length}
          />
        )
      ))}
    </group>
  )
}
