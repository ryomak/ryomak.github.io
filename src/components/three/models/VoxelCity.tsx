import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { OfficeBuilding } from './buildings/OfficeBuilding'
import { ShopBuilding } from './buildings/ShopBuilding'
import { GalleryBuilding } from './buildings/GalleryBuilding'
import { HomeBuilding } from './buildings/HomeBuilding'
import { Road, Intersection } from './environment/Road'
import { StreetLight } from './environment/StreetLight'
import { Tree, TreeCluster } from './environment/Tree'
import { Sign } from './environment/Sign'
import { VoxelParticles, GlowParticles } from './decorations/VoxelParticles'
import { FloatingTechIcon } from './decorations/TechLogos'

interface VoxelCityProps {
  position?: [number, number, number]
  scale?: number
  interactive?: boolean
  highlightedSection?: 'company' | 'skills' | 'works' | 'about' | null
  onSectionHover?: (section: string | null) => void
  onSectionClick?: (section: string) => void
}

// Complete Voxel City Scene
export const VoxelCity: React.FC<VoxelCityProps> = ({
  position = [0, 0, 0],
  scale = 1,
  highlightedSection = null,
}) => {
  const cityRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!cityRef.current) return
    // Subtle city rotation for showcase
    cityRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
  })

  return (
    <group ref={cityRef} position={position} scale={scale}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#e8f5e9" />
      </mesh>

      {/* Main intersection */}
      <Intersection position={[0, 0, 0]} size={5} />

      {/* Roads */}
      <Road position={[-8, 0, 0]} length={6} direction="horizontal" />
      <Road position={[5, 0, 0]} length={6} direction="horizontal" />
      <Road position={[0, 0, -8]} length={6} direction="vertical" />
      <Road position={[0, 0, 5]} length={6} direction="vertical" />

      {/* Office Building - Company (top-left) */}
      <group position={[-8, 0, -8]}>
        <OfficeBuilding
          floors={6}
          animated={highlightedSection === 'company'}
        />
        <Sign
          type="neon"
          position={[4, 0, 2.5]}
          color="#4ECDC4"
          animated
        />
        <StreetLight position={[-2, 0, 3]} style="modern" />
      </group>

      {/* Shop Building - Skills (top-right) */}
      <group position={[6, 0, -8]}>
        <ShopBuilding
          shopType="tech"
          animated={highlightedSection === 'skills'}
        />
        <Sign
          type="shop"
          position={[-2, 0, 2]}
          color="#9B5DE5"
        />
        <TreeCluster
          position={[5, 0, 0]}
          count={3}
          spread={2}
          variants={['small']}
        />
      </group>

      {/* Gallery Building - Works (bottom-right) */}
      <group position={[6, 0, 6]}>
        <GalleryBuilding
          artworkCount={3}
          animated={highlightedSection === 'works'}
        />
        <StreetLight position={[-2, 0, 0]} style="classic" />
        <Tree position={[5, 0, -1]} variant="sakura" animated />
      </group>

      {/* Home Building - About (bottom-left) */}
      <group position={[-8, 0, 6]}>
        <HomeBuilding
          hasGarden
          animated={highlightedSection === 'about'}
        />
        <Tree position={[-3, 0, 0]} variant="oak" animated />
        <Tree position={[-2, 0, 3]} variant="small" />
      </group>

      {/* Street Lights at intersection corners */}
      <StreetLight position={[-3, 0, -3]} style="classic" />
      <StreetLight position={[5, 0, -3]} style="classic" rotation={[0, Math.PI / 2, 0]} />
      <StreetLight position={[5, 0, 5]} style="classic" rotation={[0, Math.PI, 0]} />
      <StreetLight position={[-3, 0, 5]} style="classic" rotation={[0, -Math.PI / 2, 0]} />

      {/* Direction signs */}
      <Sign type="direction" position={[-2, 0, 0]} color="#4A90D9" animated />
      <Sign type="direction" position={[4, 0, 0]} rotation={[0, Math.PI, 0]} color="#E74C3C" />

      {/* Floating tech icons orbiting the city */}
      <FloatingTechIcon position={[0, 3, 0]} tech="go" orbitRadius={12} orbitSpeed={0.3} />
      <FloatingTechIcon position={[0, 4, 0]} tech="typescript" orbitRadius={10} orbitSpeed={0.4} />
      <FloatingTechIcon position={[0, 3.5, 0]} tech="react" orbitRadius={14} orbitSpeed={0.25} />
      <FloatingTechIcon position={[0, 2.5, 0]} tech="python" orbitRadius={11} orbitSpeed={0.35} />

      {/* Ambient particles */}
      <VoxelParticles
        position={[0, 5, 0]}
        count={100}
        spread={15}
        type="float"
        color="#00F5D4"
      />
      <GlowParticles
        position={[0, 2, 0]}
        count={20}
        spread={12}
        colors={['#00F5D4', '#9B5DE5', '#F15BB5']}
      />

      {/* City lighting - Bright and cheerful */}
      <ambientLight intensity={0.6} color="#fff5f5" />
      <directionalLight position={[10, 20, 10]} intensity={1.0} color="#ffffff" castShadow />
      <pointLight position={[0, 10, 0]} color="#ffb3d9" intensity={0.4} distance={30} />
      <pointLight position={[-10, 5, -10]} color="#b3e5fc" intensity={0.3} distance={25} />
    </group>
  )
}
