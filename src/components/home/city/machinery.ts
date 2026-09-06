import * as THREE from 'three'
import { ease } from './journey'

/** Toothed annulus with a real open centre, not an emissive ring decal. */
function gearGeometry(radius: number, width: number, teeth: number) {
  const outline = new THREE.Shape()
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2
    const r = radius + (i % 4 === 1 || i % 4 === 2 ? width * 0.36 : 0)
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) outline.moveTo(x, y)
    else outline.lineTo(x, y)
  }
  const hole = new THREE.Path()
  hole.absarc(0, 0, radius - width, 0, Math.PI * 2, true)
  outline.holes.push(hole)
  return new THREE.ExtrudeGeometry(outline, {
    depth: width * 0.3,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: width * 0.06,
    bevelThickness: width * 0.06,
    curveSegments: teeth,
  })
}

/** Mechanical plant surrounding the water arena. Geometry is shared and instanced. */
export function createMachinery(high: boolean) {
  const group = new THREE.Group()
  group.name = 'DreamMachinery'
  group.visible = false
  const bronze = new THREE.MeshStandardMaterial({
    color: 0x937148,
    metalness: 0.88,
    roughness: 0.31,
  })
  const steel = new THREE.MeshStandardMaterial({
    color: 0x263e49,
    metalness: 0.86,
    roughness: 0.32,
  })
  const edge = new THREE.MeshStandardMaterial({
    color: 0xb7b5a0,
    metalness: 0.8,
    roughness: 0.25,
  })
  const light = new THREE.MeshStandardMaterial({
    color: 0x294b49,
    emissive: 0x48bda4,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  })
  const materials = [bronze, steel, edge, light]
  const geometries = new Set<THREE.BufferGeometry>()
  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry)
    return geometry
  }
  const box = track(new THREE.BoxGeometry(1, 1, 1))
  const rod = track(new THREE.CylinderGeometry(1, 1, 1, high ? 10 : 6))
  const largeGear = track(gearGeometry(137, 7, high ? 100 : 64))
  const smallGear = track(gearGeometry(13, 3.2, 24))
  const torus = track(new THREE.TorusGeometry(131, 1.15, 6, high ? 144 : 96))
  const rotors: { object: THREE.Object3D; axis: 'y' | 'z'; speed: number }[] =
    []
  const pistons: { mesh: THREE.Mesh; phase: number; height: number }[] = []

  for (const [height, direction] of [
    [17, 1],
    [46, -1],
  ]) {
    const rotor = new THREE.Group()
    rotor.position.y = height
    const gear = new THREE.Mesh(largeGear, bronze)
    gear.rotation.x = -Math.PI / 2
    rotor.add(gear)
    // A dotted inspection light course, with large gaps between fixtures.
    const markers = new THREE.InstancedMesh(box, light, 32)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      dummy.position.set(Math.cos(a) * 134, 2.4, Math.sin(a) * 134)
      dummy.rotation.y = -a
      dummy.scale.set(0.65, 0.28, 2.2)
      dummy.updateMatrix()
      markers.setMatrixAt(i, dummy.matrix)
    }
    rotor.add(markers)
    group.add(rotor)
    rotors.push({ object: rotor, axis: 'y', speed: direction * 0.026 })
  }

  // Stationary bearing rails visually explain what the rotating annuli run on.
  for (const y of [14, 43, 50]) {
    const bearing = new THREE.Mesh(torus, steel)
    bearing.rotation.x = Math.PI / 2
    bearing.position.y = y
    group.add(bearing)
  }

  const brackets = new THREE.InstancedMesh(box, steel, 24)
  const bolts = new THREE.InstancedMesh(
    track(new THREE.IcosahedronGeometry(0.72, 0)),
    edge,
    96,
  )
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    dummy.position.set(Math.sin(a) * 131, 29, Math.cos(a) * 131)
    dummy.rotation.y = a
    dummy.scale.set(3.6, 27, 4.2)
    dummy.updateMatrix()
    brackets.setMatrixAt(i, dummy.matrix)
    for (let j = 0; j < 4; j++) {
      dummy.position.set(Math.sin(a) * 133.4, 19 + j * 7, Math.cos(a) * 133.4)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      bolts.setMatrixAt(i * 4 + j, dummy.matrix)
    }
  }
  group.add(brackets, bolts)

  // Flywheels and telescoping actuators between the arena's existing buttresses.
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    const plant = new THREE.Group()
    plant.position.set(Math.sin(a) * 137, 0, Math.cos(a) * 137)
    plant.rotation.y = a
    const wheel = new THREE.Group()
    wheel.position.set(0, 61, 0)
    wheel.add(new THREE.Mesh(smallGear, bronze))
    for (let j = 0; j < 6; j++) {
      const spoke = new THREE.Mesh(box, steel)
      spoke.scale.set(1.1, 20, 1.5)
      spoke.rotation.z = (j / 6) * Math.PI
      wheel.add(spoke)
    }
    const hub = new THREE.Mesh(rod, edge)
    hub.rotation.x = Math.PI / 2
    hub.scale.set(2.7, 6, 2.7)
    wheel.add(hub)
    plant.add(wheel)
    rotors.push({ object: wheel, axis: 'z', speed: (i % 2 ? -1 : 1) * 0.14 })
    for (const x of [-8, 8]) {
      const housing = new THREE.Mesh(rod, steel)
      housing.position.set(x, 30, 3)
      housing.scale.set(2.4, 24, 2.4)
      const piston = new THREE.Mesh(rod, edge)
      piston.position.set(x, 49, 3)
      piston.scale.set(1.2, 22, 1.2)
      plant.add(housing, piston)
      pistons.push({ mesh: piston, phase: i * 0.8 + x, height: 49 })
    }
    group.add(plant)
  }

  let runningTime = 0
  return {
    group,
    materials,
    update(dt: number, restoration: number) {
      // The machinery starts turning as the arena is restored, never in the ruin.
      const built = ease(0.2, 0.58, restoration)
      group.visible = built > 0.001
      group.scale.y = Math.max(0.001, built)
      runningTime += Math.min(0.05, Math.max(0, dt)) * built
      for (const rotor of rotors)
        rotor.object.rotation[rotor.axis] = runningTime * rotor.speed
      for (const piston of pistons)
        piston.mesh.position.y =
          piston.height + Math.sin(runningTime * 0.65 + piston.phase) * 3.4
    },
    dispose() {
      group.traverse(object => {
        if (object instanceof THREE.InstancedMesh) object.dispose()
      })
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      group.removeFromParent()
    },
  }
}
