import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { sampleJourney } from '../../src/components/home/city/journey'
import { createMachinery } from '../../src/components/home/city/machinery'

test('the first chapter is a ruin and the final chapter is a complete night city', () => {
  assert.equal(sampleJourney(0.125, 16 / 9).restore, 0)
  assert.equal(sampleJourney(0.125, 16 / 9).night, 0)
  assert.equal(sampleJourney(0.875, 16 / 9).restore, 1)
  assert.equal(sampleJourney(0.875, 16 / 9).night, 1)
})

test('camera stays above water and outside the stadium throughout the journey', () => {
  for (const aspect of [0.46, 0.75, 1, 16 / 9, 2.4]) {
    let previous = sampleJourney(0, aspect)
    for (let i = 1; i <= 1000; i++) {
      const current = sampleJourney(i / 1000, aspect)
      assert.ok(current.position.every(Number.isFinite))
      assert.ok(current.position[1] > 20)
      assert.ok(Math.hypot(current.position[0], current.position[2]) > 210)
      assert.ok(
        Math.hypot(
          ...current.position.map((v, k) => v - previous.position[k]),
        ) < 12,
      )
      assert.ok(current.restore >= previous.restore)
      assert.ok(current.night >= previous.night)
      previous = current
    }
  }
})

test('invalid and restored scroll positions produce a finite, clamped state', () => {
  for (const p of [-2, 0, 1, 2, Number.NaN]) {
    const state = sampleJourney(p, 0)
    assert.ok(state.position.every(Number.isFinite))
    assert.ok(state.restore >= 0 && state.restore <= 1)
  }
})

test('the original model contains both eras, PBR textures, and the water volume within a web budget', () => {
  const file = 'public/models/dream-city.glb'
  assert.ok(statSync(file).size < 8 * 1024 * 1024, 'GLB must stay below 8 MB')
  const bytes = readFileSync(file)
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
  for (const name of ['Ruins', 'Dream', 'Permanent', 'WaterVolume']) {
    assert.ok(
      gltf.nodes.some((node: { name: string }) => node.name === name),
      name,
    )
  }
  assert.ok(gltf.images.length >= 2, 'embedded stone base color and normal map')
  let triangles = 0
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      triangles += gltf.accessors[primitive.indices].count / 3
      assert.ok(
        primitive.attributes.NORMAL !== undefined,
        'authored surface normals',
      )
    }
  }
  assert.ok(
    triangles > 50000 && triangles < 600000,
    `triangle count: ${triangles}`,
  )
})

test('pyreflies increase gradually from a sparse ruin to the full dream swarm', () => {
  const opening = sampleJourney(0.125, 1.7).population
  assert.ok(opening > 0 && opening <= 0.12)
  assert.equal(sampleJourney(0.875, 1.7).population, 1)
  let last = opening
  for (let i = 1; i <= 100; i++) {
    const population = sampleJourney(0.125 + i * 0.0075, 1.7).population
    assert.ok(population >= last)
    assert.ok(population - last < 0.025)
    last = population
  }
})

test('machinery stays absent in the ruin, starts with the city and retreats on reverse scroll', () => {
  for (const high of [true, false]) {
    const machinery = createMachinery(high)
    machinery.update(1 / 60, 0)
    assert.equal(machinery.group.visible, false)
    machinery.update(1 / 60, 1)
    assert.equal(machinery.group.visible, true)
    assert.equal(machinery.group.scale.y, 1)
    const firstRotor = machinery.group.children[0]
    const before = firstRotor.rotation.y
    machinery.update(1 / 60, 1)
    assert.ok(firstRotor.rotation.y > before)
    machinery.update(1 / 60, 0)
    assert.equal(machinery.group.visible, false)
    const stopped = firstRotor.rotation.y
    machinery.update(1 / 60, 0)
    assert.equal(firstRotor.rotation.y, stopped)
    machinery.dispose()
  }
})
