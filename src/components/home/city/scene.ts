import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createAtmosphere } from './atmosphere'
import {
  createOcean,
  createSky,
  createSphereMaterial,
  createWaterfalls,
  noiseGLSL,
} from './environment'
import { clamp, ease, sampleJourney } from './journey'
import { createMachinery } from './machinery'
import { createPyreflies } from './pyreflies'

export type CityScene = {
  ready: Promise<void>
  render(dt: number): void
  resize(width: number, height: number, dpr: number): void
  setProgress(p: number): void
  dispose(): void
}

type Uniform = { value: number }

/** One field reveals the new masonry and erases its damaged counterpart. */
function restoreMaterial(
  material: THREE.Material,
  front: Uniform,
  ruined: boolean,
) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uFront = front
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vRestoration;',
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 restorationPosition = vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          restorationPosition = instanceMatrix * restorationPosition;
        #endif
        vRestoration = (modelMatrix * restorationPosition).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec3 vRestoration;
      uniform float uFront;
      ${noiseGLSL}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float altitude = vRestoration.y + length(vRestoration.xz)*.022
          + (noise(vRestoration*.085)-.5)*9.0;
        ${
          ruined
            ? 'if (altitude < uFront) discard;'
            : 'if (altitude > uFront) discard;'
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        ${
          ruined
            ? ''
            : `float seam = 1.0-smoothstep(0.0,3.5,uFront-altitude);
        gl_FragColor.rgb += vec3(.18,.8,.68)*seam*.8;`
        }`,
      )
  }
  material.customProgramCacheKey = () =>
    `tidal-restoration-${ruined ? 'ruins' : 'dream'}`
  material.needsUpdate = true
}

/** Dispose a loaded scene even when it finishes after navigation has cancelled it. */
function releaseModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value)
      }
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) {
    texture.dispose()
    // GLTFLoader uses ImageBitmap where available; dispose alone does not close it.
    if (
      typeof ImageBitmap !== 'undefined' &&
      texture.image instanceof ImageBitmap
    )
      texture.image.close()
  }
  root.removeFromParent()
}

export function createCityScene(
  canvas: HTMLCanvasElement,
  opts: { tier: 'high' | 'low'; onProgress?: (v: number) => void } = {
    tier: 'high',
  },
): CityScene {
  const high = opts.tier === 'high'
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: high,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(43, 1, 1, 6000)
  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, camera)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.55, 1.05)
  const output = new OutputPass()
  composer.addPass(renderPass)
  composer.addPass(bloom)
  composer.addPass(output)

  const time = { value: 0 }
  const night = { value: 0 }
  const front = { value: -40 }
  const sky = createSky()
  const ocean = createOcean(high)
  const flies = createPyreflies(high)
  const machinery = createMachinery(high)
  for (const material of machinery.materials)
    restoreMaterial(material, front, false)
  const atmosphere = createAtmosphere(time, night, front)
  const sphereMaterial = createSphereMaterial()
  const waterfalls = createWaterfalls()
  scene.add(
    sky.mesh,
    ocean.mesh,
    flies.mesh,
    atmosphere.group,
    waterfalls.group,
    machinery.group,
  )

  // Broad environment highlights keep bronze and patina dimensional in shadow.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.02)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.32
  room.dispose()
  pmrem.dispose()

  const sun = new THREE.DirectionalLight(0xffc48b, 2.6)
  sun.position.set(-350, 160, -600)
  const moon = new THREE.DirectionalLight(0x85baff, 0)
  moon.position.set(250, 450, 100)
  const fill = new THREE.HemisphereLight(0xa4bfd0, 0x15252d, 0.9)
  scene.add(sun, moon, fill)
  const fog = new THREE.FogExp2(0x685447, 0.00085)
  scene.fog = fog
  const duskFog = new THREE.Color(0x8a6550)
  const nightFog = new THREE.Color(0x102b40)

  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/')
  draco.setWorkerLimit(high ? 2 : 1)
  const loader = new GLTFLoader().setDRACOLoader(draco)
  let disposed = false
  let model: THREE.Object3D | undefined
  let dream: THREE.Object3D | undefined
  let ruins: THREE.Object3D | undefined
  let sphere: THREE.Mesh | undefined
  let sphereScale = new THREE.Vector3(1, 1, 1)
  const ready = loader
    .loadAsync('/models/dream-city.glb', event => {
      if (!disposed && event.total)
        opts.onProgress?.((event.loaded / event.total) * 0.92)
    })
    .then(gltf => {
      if (disposed) {
        releaseModel(gltf.scene)
        return
      }
      model = gltf.scene
      dream = model.getObjectByName('Dream')
      ruins = model.getObjectByName('Ruins')
      sphere = model.getObjectByName('WaterVolume') as THREE.Mesh | undefined
      if (!dream || !ruins || !sphere) {
        releaseModel(model)
        model = undefined
        throw new Error(
          'The city model is missing an era or the stadium water volume',
        )
      }
      const sourceMaterials = new Set<THREE.Material>()
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        object.frustumCulled = true
        const original = object.material as THREE.MeshStandardMaterial
        sourceMaterials.add(original)
        const material = original.clone()
        object.material = material
        // Exported vertex colors carry the wear of each individual stone surface.
        material.envMapIntensity = 0.65
        if (material.name === 'Ivory') {
          material.color.multiplyScalar(0.72)
          material.roughness = 0.68
        }
        if (object.parent === dream && material.name === 'Limestone') {
          material.color.set(0x81999c)
          material.metalness = 0.68
          material.roughness = 0.36
          material.envMapIntensity = 0.85
        }
        if (material.name === 'Basalt') material.color.multiplyScalar(0.5)
        if (material.name === 'RuinStone') material.color.multiplyScalar(0.78)
        if (material.map)
          material.map.anisotropy = Math.min(
            4,
            renderer.capabilities.getMaxAnisotropy(),
          )
        if (material.emissiveIntensity > 0) material.emissiveIntensity *= 0.6
        if (object.parent === dream && object !== sphere)
          restoreMaterial(material, front, false)
        if (object.parent === ruins) restoreMaterial(material, front, true)
      })
      for (const material of sourceMaterials) material.dispose()
      ;(sphere.material as THREE.Material).dispose()
      sphere.material = sphereMaterial
      sphere.renderOrder = 3
      sphereScale = sphere.scale.clone()
      dream.visible = false
      scene.add(model)
      opts.onProgress?.(1)
    })

  const cameraPosition = new THREE.Vector3()
  const cameraTarget = new THREE.Vector3()
  const desiredPosition = new THREE.Vector3()
  const desiredTarget = new THREE.Vector3()
  let targetProgress = 0.125
  let progress = 0.125
  let seeded = false
  let shaderError: Error | undefined
  // A compiling shader can otherwise leave a black canvas while boot reports success.
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    shaderError = new Error(
      `City shader: ${gl.getProgramInfoLog(program)} ${gl.getShaderInfoLog(
        vertex,
      )} ${gl.getShaderInfoLog(fragment)}`,
    )
  }

  function resize(width: number, height: number, dpr: number) {
    if (disposed) return
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    const ratio = Math.min(dpr, high ? 1.65 : 1.15)
    renderer.setPixelRatio(ratio)
    renderer.setSize(w, h, false)
    composer.setPixelRatio(ratio)
    composer.setSize(w, h)
    ocean.resize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    flies.resize(h)
    atmosphere.resize(ratio)
  }

  function render(dt: number) {
    if (disposed) return
    const step = Math.min(Math.max(0, dt), 0.05)
    time.value += step
    // Smooth the world and camera together; fast scrolling cannot separate their eras.
    const follow = seeded ? 1 - Math.exp(-Math.min(dt, 0.5) * 5.5) : 1
    progress += (targetProgress - progress) * follow
    const state = sampleJourney(progress, camera.aspect)
    desiredPosition.fromArray(state.position)
    desiredTarget.fromArray(state.target)
    cameraPosition.copy(desiredPosition)
    cameraTarget.copy(desiredTarget)
    camera.position.copy(cameraPosition)
    camera.lookAt(cameraTarget)
    camera.filmOffset = state.lens
    camera.updateProjectionMatrix()
    seeded = true

    flies.setPopulation(state.population)
    machinery.update(step, state.restore)
    night.value = state.night
    front.value = -40 + state.restore * 395
    if (dream) dream.visible = state.restore > 0.001
    if (ruins) ruins.visible = state.restore < 0.999
    if (sphere) {
      const build = ease(0.29, 0.79, state.restore)
      sphere.visible = build > 0.001
      sphere.scale.copy(sphereScale).multiplyScalar(0.76 + 0.24 * build)
      sphereMaterial.uniforms.uBuild.value = build
    }
    waterfalls.material.uniforms.uTime.value = time.value
    waterfalls.material.uniforms.uBuild.value = ease(0.15, 0.48, state.restore)
    sphereMaterial.uniforms.uTime.value = time.value
    flies.material.uniforms.uTime.value = time.value
    for (const material of [sky.material, ocean.material]) {
      material.uniforms.uTime.value = time.value
      material.uniforms.uNight.value = night.value
    }
    sun.intensity = 2.6 * (1 - night.value) + 0.12
    moon.intensity = night.value * 2.5
    fill.intensity = 0.85 + night.value * 0.55
    scene.environmentIntensity = 0.32 + night.value * 0.3
    fog.color.lerpColors(duskFog, nightFog, night.value)
    fog.density = 0.00065 + night.value * 0.00025
    bloom.strength = 0.32 + night.value * 0.23
    renderer.toneMappingExposure = 1.02 + night.value * 0.1
    composer.render()
    if (shaderError) throw shaderError
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (model) releaseModel(model)
    sky.mesh.geometry.dispose()
    sky.material.dispose()
    ocean.dispose()
    flies.dispose()
    machinery.dispose()
    atmosphere.dispose()
    waterfalls.dispose()
    sphereMaterial.dispose()
    environment.dispose()
    draco.dispose()
    bloom.dispose()
    output.dispose()
    renderPass.dispose()
    composer.dispose()
    renderer.dispose()
  }
  return {
    ready,
    resize,
    render,
    setProgress(p) {
      targetProgress = clamp(p)
    },
    dispose,
  }
}
