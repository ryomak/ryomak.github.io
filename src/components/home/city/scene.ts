// The Zanarkand scene: a drowned city that rebuilds itself as the page scrolls.
//
// Written against three.js directly rather than react-three-fiber because this
// theme navigates with swup, which swaps <main> without re-hydrating framework
// islands. A plain module gives us an explicit boot/teardown pair that survives
// those swaps (see src/scripts/home-city.ts).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  FOV,
  POOL,
  POOL_RADIUS,
  RESTORE_FRONT,
  RESTORE_RANGE,
  SECTION_CAMS,
  SECTION_SIDES,
  SECTION_STOPS,
  STADIUM,
  WAYPOINTS,
} from './config'

const MODEL_URL = '/models/zanarkand.glb'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The arc runs dusk → night → dawn.
 *
 * The ruin opens at sunset, low and warm, the way the Zanarkand ruins are shown
 * — the structure in silhouette against a burning horizon. As the stadium
 * rebuilds, the light cools into the night the living city belongs to, and the
 * last chapter breaks into dawn again.
 */
const PALETTE = {
  fogRuin: new THREE.Color(0x160f18),
  fogCity: new THREE.Color(0x0b2a34),
  moonRuin: new THREE.Color(0xffa557),
  moonCity: new THREE.Color(0xcfe4f2),
  skyRuin: new THREE.Color(0x5c3126),
  skyCity: new THREE.Color(0x1d6a68),
  ground: new THREE.Color(0x06131a),
  neon: new THREE.Color(0x63f0d8),
  neonWarm: new THREE.Color(0xffb45e),
  moon: new THREE.Color(0xffd9a8),
  water: new THREE.Color(0x0d5a5e),
  submerged: new THREE.Color(0x07414f),
  dawn: new THREE.Color(0x2a2233),
  dawnLight: new THREE.Color(0xffb583),
}

export type Tier = 'high' | 'low'

export type CityScene = {
  /** Drive the whole scene from scroll progress in [0, 1]. */
  setProgress(p: number): void
  /** Advance animation and draw. `dt` in seconds. */
  render(dt: number): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
  /** Resolves once the model is in the scene. */
  ready: Promise<void>
  /** Restoration amount currently shown, for the UI to mirror. */
  readonly restore: number
}

// ---------------------------------------------------------------- restoration
type RestoreUniforms = {
  front: THREE.IUniform<number>
  soft: THREE.IUniform<number>
  amount: THREE.IUniform<number>
}

const RESTORE_VERTEX_HOOK = (shader: THREE.WebGLProgramParametersWithUniforms, shared: RestoreUniforms) => {
  shader.uniforms.uFront = shared.front
  shader.uniforms.uSoft = shared.soft
  shader.uniforms.uAmount = shared.amount
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying float vRestoreY;\nvarying float vRestoreDist;\nvarying vec3 vRestoreWorld;',
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvRestoreY = (modelMatrix * vec4(transformed, 1.0)).y;',
    )
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvRestoreDist = -mvPosition.z;\nvRestoreWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
}

/**
 * The cladding is gated by a world-space front that rises out of the water, so
 * the city rebuilds itself floor by floor.
 *
 * This clips rather than fades. Stochastic (alpha-hash) transparency was the
 * obvious way to dissolve it in, but without temporal AA to resolve the hash
 * the whole city crawls with dither noise; and ordinary alpha blending on
 * geometry this interleaved sorts badly. A hard cut costs nothing, sorts
 * perfectly, and a glowing seam along the cut line sells the rebuild better
 * than a fade ever did.
 */
function applyRestoreClip(material: THREE.Material, shared: RestoreUniforms, seam: THREE.Color) {
  material.onBeforeCompile = shader => {
    RESTORE_VERTEX_HOOK(shader, shared)
    shader.uniforms.uSeam = { value: seam }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vRestoreY;
         varying float vRestoreDist;
         uniform float uFront;
         uniform float uSoft;
         uniform float uAmount;
         uniform vec3 uSeam;`,
      )
      .replace(
        '#include <map_fragment>',
        `if (uAmount < 0.002 || vRestoreY > uFront) discard;
         #include <map_fragment>`,
      )
      // a bright band trailing just under the front, as if the stone is still setting
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float seam = smoothstep(uFront - uSoft, uFront, vRestoreY);
         gl_FragColor.rgb += uSeam * seam * seam * 1.4;`,
      )
  }
  material.needsUpdate = true
}

/** Same front, but as a soft alpha ramp — right for the additive light strips. */
function applyRestoreFade(material: THREE.Material, shared: RestoreUniforms) {
  material.onBeforeCompile = shader => {
    RESTORE_VERTEX_HOOK(shader, shared)
    shader.uniforms.uNeonCool = { value: PALETTE.neon }
    shader.uniforms.uNeonWarm = { value: PALETTE.neonWarm }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vRestoreY;
         varying float vRestoreDist;
         varying vec3 vRestoreWorld;
         uniform float uFront;
         uniform float uSoft;
         uniform float uAmount;
         uniform vec3 uNeonCool;
         uniform vec3 uNeonWarm;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // Zanarkand at night is not one colour: most windows burn warm amber
         // and the structure is picked out in cold cyan. Hashing the building's
         // footprint gives each tower its own bias, so the skyline mixes.
         vec2 cell = floor(vRestoreWorld.xz / 17.0);
         float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
         float band = fract(vRestoreWorld.y * 0.09 + h * 3.7);
         float warm = smoothstep(0.35, 0.65, h * 0.75 + band * 0.25);
         diffuseColor.rgb *= mix(uNeonCool, uNeonWarm, warm);

         float restoreBand = smoothstep(uFront + uSoft * 0.5, uFront - uSoft, vRestoreY);
         // A light strip a few metres from the lens covers a quarter of the
         // screen and reads as a flat slab, not as light. Fading them out up
         // close keeps the glow in the distance where it belongs.
         float near = smoothstep(10.0, 52.0, vRestoreDist);
         // and the far end: a light band a kilometre out lands under a pixel
         // and scintillates as the camera swings. Ease them off instead.
         float far = 1.0 - smoothstep(420.0, 1500.0, vRestoreDist) * 0.85;
         diffuseColor.a *= restoreBand * near * far * uAmount;`,
      )
  }
  material.needsUpdate = true
}


/**
 * A tiny procedural night sky, pre-filtered into an environment map.
 *
 * Without one, a transmissive material has nothing to reflect and the pool
 * reads as flat tinted glass. This costs one 128x64 texture and a single PMREM
 * pass at startup, and it is what puts a moon glint and a horizon line on the
 * water's surface.
 */
function makeEnvironment(renderer: THREE.WebGLRenderer, moonDir: THREE.Vector3) {
  const w = 128
  const h = 64
  const data = new Float32Array(w * h * 4)
  const sky = new THREE.Color(0x121a2e)
  const horizon = new THREE.Color(0x6a3520)
  const ground = new THREE.Color(0x03060a)
  const c = new THREE.Color()
  const dir = new THREE.Vector3()

  for (let y = 0; y < h; y++) {
    const phi = (y + 0.5) / h * Math.PI
    for (let x = 0; x < w; x++) {
      const theta = (x + 0.5) / w * Math.PI * 2
      dir.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
      const up = dir.y
      if (up >= 0) c.copy(horizon).lerp(sky, Math.pow(up, 0.6))
      else c.copy(horizon).lerp(ground, Math.pow(-up, 0.4))
      // the moon, and the broad glow around it
      const d = dir.dot(moonDir)
      c.addScalar(Math.pow(Math.max(0, d), 900) * 6)
      c.r += Math.pow(Math.max(0, d), 12) * 0.28
      c.g += Math.pow(Math.max(0, d), 12) * 0.15
      c.b += Math.pow(Math.max(0, d), 12) * 0.07
      const i = (y * w + x) * 4
      data[i] = c.r
      data[i + 1] = c.g
      data[i + 2] = c.b
      data[i + 3] = 1
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.needsUpdate = true
  const pmrem = new THREE.PMREMGenerator(renderer)
  const rt = pmrem.fromEquirectangular(tex)
  pmrem.dispose()
  tex.dispose()
  return rt
}


// ------------------------------------------------------------------ materials
function buildMaterials(shared: RestoreUniforms, _tier: Tier) {
  // Kept deliberately dark: at night the shapes should be carried by the moon
  // rim and by their own lights, not by a bright albedo.
  const stone = new THREE.MeshStandardMaterial({ color: 0x6e6c66, roughness: 0.96, metalness: 0.0, flatShading: true })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b28, roughness: 0.98, metalness: 0.0, flatShading: true })
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4049, roughness: 0.4, metalness: 0.92, flatShading: true })

  // faint traces of light that outlived the city
  const glow = new THREE.MeshBasicMaterial({ color: 0x59d6d0, toneMapped: false })

  // the cladding that only the restored city has
  const clad = new THREE.MeshStandardMaterial({ color: 0x7a7871, roughness: 0.8, metalness: 0.04, flatShading: true })
  applyRestoreClip(clad, shared, new THREE.Color(0x2ba7c4))

  const neon = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  applyRestoreFade(neon, shared)

  // The sphere is water, but it is also the only light source the ruin has —
  // in the reference it glows white-blue from inside the bowl. So: a real
  // refractive surface (transmission + ior), tinted pale blue by absorption
  // rather than by base colour, with a standing emission underneath it so it
  // reads as lit from within rather than merely reflective.
  const water = new THREE.MeshPhysicalMaterial({
    color: 0xeaf8ff,
    roughness: 0.02,
    metalness: 0.0,
    transmission: 1.0,
    thickness: 14,
    attenuationColor: new THREE.Color(0x6cc4ea),
    attenuationDistance: 60,
    ior: 1.333,
    emissive: new THREE.Color(0x4aa8e8),
    emissiveIntensity: 0.30,
    specularIntensity: 1.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  })

  // Spray, mist and the cascades' foam. Ordinary water — it must not carry the
  // pool's emission, or every droplet reads as a lamp.
  const spray = new THREE.MeshPhysicalMaterial({
    color: 0xcfeef8,
    roughness: 0.16,
    metalness: 0.0,
    transmission: 0.85,
    thickness: 3,
    ior: 1.333,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  })

  // silhouettes on the far bank: unlit, sitting just above the fog
  const far = new THREE.MeshBasicMaterial({ color: 0x0d1620, fog: true })

  return { stone, dark, metal, glow, clad, neon, water, spray, far }
}

/**
 * Surface motion for the pool.
 *
 * The sphere should not read as a ball of glass. It is a volume of water being
 * held in a shape it does not want to hold, so the silhouette itself has to
 * move: big slow lobes rolling around it, smaller swells riding on those, and a
 * fine chop on top. The displacement is deliberately large enough to break the
 * outline — a perfectly round edge is what made earlier versions look solid.
 *
 * Normals are perturbed with the same field so the refraction agrees with the
 * shape, and the whole pattern rotates slowly, as if the water were turning
 * inside its cage.
 */
function animateWater(material: THREE.MeshPhysicalMaterial, time: THREE.IUniform<number>, centre: THREE.Vector3, radius: number, front: THREE.IUniform<number>, foam: THREE.IUniform<number>) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time
    shader.uniforms.uFill = front
    shader.uniforms.uFoam = foam
    shader.uniforms.uPoolC = { value: centre }
    shader.uniforms.uPoolR = { value: radius }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform vec3 uPoolC;
         uniform float uPoolR;

         // the wave field, in the sphere's own frame
         float poolWave(vec3 d, float t) {
           return  0.62 * sin(d.y * 2.1 + t * 0.75)
                 + 0.52 * sin(d.x * 1.7 - t * 0.61 + d.z * 1.3)
                 + 0.34 * sin(d.z * 3.1 + t * 1.03)
                 + 0.22 * sin((d.x + d.y) * 4.6 - t * 1.47)
                 + 0.12 * sin((d.z - d.y) * 7.8 + t * 2.05);
         }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         vec3 poolDir = normalize(position - uPoolC);
         // slow rotation, so the water turns inside its cage
         float poolSpin = uTime * 0.11;
         float pcs = cos(poolSpin), psn = sin(poolSpin);
         poolDir = vec3(poolDir.x * pcs - poolDir.z * psn, poolDir.y, poolDir.x * psn + poolDir.z * pcs);
         float poolH = poolWave(poolDir, uTime);
         // finite-difference the field for a normal that matches the surface
         float poolE = 0.06;
         vec3 poolT1 = normalize(cross(poolDir, vec3(0.0, 1.0, 0.0) + vec3(0.001)));
         vec3 poolT2 = normalize(cross(poolDir, poolT1));
         float poolD1 = poolWave(normalize(poolDir + poolT1 * poolE), uTime) - poolH;
         float poolD2 = poolWave(normalize(poolDir + poolT2 * poolE), uTime) - poolH;
         objectNormal = normalize(objectNormal - (poolT1 * poolD1 + poolT2 * poolD2) * 0.9 / poolE * 0.06);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vPoolH = poolH;
         transformed += normalize(position - uPoolC) * poolH * uPoolR * 0.010;`,
      )
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vPoolH;\nvarying float vPoolY;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\nvPoolY = (modelMatrix * vec4(transformed, 1.0)).y;')

    // Where the water heaps up it breaks white. Foam is the single strongest
    // cue that this is water and not glass, and it is what the reference is
    // full of — the crests go opaque and bright while the troughs stay clear.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying float vPoolH;\nvarying float vPoolY;\nuniform float uFill;\nuniform float uFoam;')
      .replace(
        '#include <map_fragment>',
        `// the water level: nothing above the fill line exists yet
         if (vPoolY > uFill) discard;
         #include <map_fragment>
         // and the surface itself runs bright, like a meniscus
         float fillEdge = smoothstep(uFill - 2.2, uFill, vPoolY);
         float foam = max(smoothstep(0.72, 1.55, vPoolH), fillEdge * 0.9) * uFoam;
         float lace = smoothstep(0.15, 0.95, vPoolH) * 0.35;
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), foam * 0.75 + lace * 0.2);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.75, foam);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * foam * 0.55;`,
      )
  }
  material.needsUpdate = true
}

// ------------------------------------------------------------------- the sea
/**
 * The flooded plain. A full planar reflection would cost more than the rest of
 * the scene put together, so this fakes what actually matters at night: the
 * fresnel roll-off toward the horizon, wind ripples, a moon glitter path, and
 * smeared vertical reflections under the two brightest landmarks.
 */
function createSea(fogColor: THREE.Color, time: THREE.IUniform<number>) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: time,
      uDeep: { value: new THREE.Color(0x03080d) },
      uShallow: { value: PALETTE.water.clone() },
      uHorizon: { value: fogColor },
      uMoonDir: { value: new THREE.Vector3(0.70, 0.17, -0.63).normalize() },
      uRestore: { value: 0 },
      uDawn: { value: 0 },
      uDusk: { value: 1 },
      // (x, z, intensity, spread) for the pool and the spire
      uLightA: { value: new THREE.Vector4(POOL.x, POOL.z, 1.0, 26) },
      uLightB: { value: new THREE.Vector4(STADIUM.x, STADIUM.z, 0.9, STADIUM.radius * 0.9) },
      uLightColor: { value: PALETTE.neon.clone() },
    },
  ])
  uniforms.uTime = time

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #ifdef USE_FOG
          vFogDepth = -mvPosition.z;
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec3 vWorld;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uHorizon;
      uniform vec3 uMoonDir;
      uniform vec3 uLightColor;
      uniform vec4 uLightA;
      uniform vec4 uLightB;
      uniform float uRestore;
      uniform float uDawn;
      uniform float uDusk;

      // Four wind waves, differentiated analytically. Amplitude is damped with
      // distance: past a few hundred units a ripple is far smaller than a pixel,
      // and sampling it anyway is what produces the moire that plagues naive
      // water shaders.
      vec3 rippleNormal(vec2 p, float damp) {
        vec4 freq = vec4(0.070, 0.052, 0.026, 0.013);
        vec4 speed = vec4(0.95, -0.72, 0.44, -0.21);
        vec4 amp = vec4(0.06, 0.09, 0.15, 0.24) * damp;
        vec4 phase = vec4(
          p.x * freq.x + uTime * speed.x,
          p.y * freq.y + uTime * speed.y,
          (p.x * 0.72 + p.y * 0.69) * freq.z + uTime * speed.z,
          (p.x * -0.6 + p.y * 0.8) * freq.w + uTime * speed.w
        );
        vec4 c = cos(phase) * amp * freq;
        float dhdx = c.x + c.z * 0.72 - c.w * 0.6;
        float dhdz = c.y + c.z * 0.69 + c.w * 0.8;
        return normalize(vec3(-dhdx, 0.06, -dhdz));
      }

      // a landmark's reflection, smeared along the axis between it and the eye
      float smear(vec2 p, vec4 light, vec3 eye) {
        float across = exp(-abs(p.y - light.y) / light.w);
        float behind = smoothstep(light.x + 40.0, light.x - 10.0, p.x);
        float toward = smoothstep(eye.x - 320.0, eye.x + 10.0, p.x);
        float shimmer = 0.65 + 0.35 * sin(p.x * 0.35 + uTime * 2.1) * sin(p.y * 0.5 - uTime * 1.3);
        return across * behind * toward * shimmer * light.z;
      }

      void main() {
        vec3 eye = cameraPosition;
        vec3 toEye = eye - vWorld;
        float dist = length(toEye);
        vec3 view = toEye / dist;
        float damp = exp(-dist / 110.0);
        vec3 n = rippleNormal(vWorld.xz, damp);

        float fres = pow(1.0 - clamp(dot(view, n), 0.0, 1.0), 4.0);
        vec3 base = mix(uDeep, uShallow * 0.5, 0.35 + 0.25 * uRestore);
        vec3 col = mix(base, uHorizon, clamp(fres, 0.0, 1.0) * 0.85);

        // moon glitter — the highlight widens with distance to stay above one
        // pixel, which keeps it from sparkling into aliasing on the horizon
        vec3 h = normalize(uMoonDir + view);
        float gloss = mix(16.0, 48.0, damp);
        float spec = pow(max(dot(n, h), 0.0), gloss);
        col += vec3(0.62, 0.72, 0.85) * spec * mix(0.05, 0.85, damp);

        // reflections of the landmarks, brightening as the city comes back
        float ref = smear(vWorld.xz, uLightA, eye) + smear(vWorld.xz, uLightB, eye);
        col += uLightColor * ref * (0.10 + 0.55 * uRestore);

        // "First in the sea, then it spreads to the sky, then to the whole
        // city." Dawn reaches the water before anything else — and at the other
        // end of the arc, so does the sunset the ruin opens on.
        float toHorizon = smoothstep(120.0, 900.0, dist);
        col += vec3(1.00, 0.52, 0.26) * uDawn * (0.20 + 0.85 * toHorizon);
        col += vec3(1.00, 0.46, 0.20) * uDusk * (0.02 + 0.34 * toHorizon * toHorizon);

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  })

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 4000, 1, 1), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(200, 0, 0)
  mesh.renderOrder = -1
  return { mesh, uniforms }
}

// ------------------------------------------------------------------ pyreflies
/**
 * 幻光虫 — pyreflies.
 *
 * A designed silhouette that nonetheless traces a real path. Two earlier
 * attempts each got half of it: a ribbon built from the head's past positions
 * followed the motion honestly but deformed into something different every
 * frame, while a sprite with a painted-on tail held its shape but the tail was
 * a lie that never matched where the light had been.
 *
 * This does both. The vertex shader evaluates the motion at eight earlier
 * moments, projects each, and hands the fragment shader those offsets *in
 * sprite space*. The fragment then lays a bead of light at each one. The head
 * is drawn, so it is stable and round; the trail is measured, so it is the
 * actual wake.
 *
 * They are also the visible agent of the restoration: `uSurge` peaks in the
 * middle of the scroll, which is exactly when the stadium is rebuilding.
 */
function createMotes(count: number, time: THREE.IUniform<number>, viewport: THREE.Vector2) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -380 + Math.random() * 960
    positions[i * 3 + 1] = Math.random() * 180
    positions[i * 3 + 2] = (Math.random() - 0.5) * 460
    seeds[i * 3] = Math.random()
    seeds[i * 3 + 1] = Math.random()
    seeds[i * 3 + 2] = Math.random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(100, 90, 0), 1400)

  const MOTION = /* glsl */ `
    vec3 motePos(vec3 base, vec3 seed, float t, float surge, vec3 flow) {
      float speed = 1.4 + seed.x * 2.6 + surge * 7.0;
      float span = 190.0;
      vec3 p = base;
      // pyreflies rise; the wander only needs to be enough to curve the wake
      float climb = mod(base.y + t * speed + seed.y * span, span);
      p.y = climb;
      // ...but not straight up. the flow vector turns with the scroll, so the swarm
      // leans a different way in every chapter — streaming out over the water
      // in one, curling back over the bowl in the next — while each mote still
      // carries its own drift along the way it has actually gone.
      p.x += flow.x * climb * (0.7 + seed.z * 0.6);
      p.z += flow.z * climb * (0.7 + seed.x * 0.6);
      p.y += flow.y * climb * (0.5 + seed.y * 0.5);
      float ph = t * (0.42 + seed.z * 0.55) + seed.y * 12.56;
      float swirl = 1.6 + 3.4 * surge * (0.4 + seed.z);
      p.x += sin(ph) * swirl + sin(ph * 2.1 + seed.x * 4.0) * swirl * 0.4;
      p.z += cos(ph * 1.21) * swirl + cos(ph * 1.8 + seed.y * 3.0) * swirl * 0.35;
      // The wriggle — a function of time alone, never of position.
      //
      // An earlier version made the phase depend on how far the mote had
      // climbed, which put a standing wave in space: the tail was bent into an
      // S even when the head had swum dead straight. The tail is drawn by
      // evaluating this function at earlier times, so it can only ever be the
      // path the head actually took — which is the point. Make the head swim,
      // and the body follows.
      // Slow and shallow. The mote's job is to rise; the wriggle is a hint of
      // life on top of that, not the motion itself. Fast and wide read as a
      // creature thrashing, and — because the body is drawn as a polyline
      // through eight past positions — put visible corners in it.
      float wig = t * (2.1 + seed.z * 0.9) + seed.y * 25.0;
      float amp = 0.5 + 0.45 * seed.z;
      p.x += sin(wig) * amp;
      p.z += cos(wig * 0.91 + seed.x * 3.0) * amp;
      p.y += sin(wig * 0.57 + seed.z * 5.0) * amp * 0.35;
      return p;
    }
  `

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: time,
      uSurge: { value: 0 },
      uRestore: { value: 0 },
      uScale: { value: 1 },
      uFlow: { value: new THREE.Vector3() },
      uViewport: { value: viewport },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uSurge;
      uniform float uScale;
      uniform vec3 uFlow;
      uniform vec2 uViewport;
      varying float vFade;
      varying float vNear;
      varying vec3 vSeed;
      // eight past positions, packed as four pairs, in sprite-local units
      varying vec4 vT0;
      varying vec4 vT1;
      varying vec4 vT2;
      varying vec4 vT3;
      ${MOTION}
      void main() {
        vec3 p = motePos(position, aSeed, uTime, uSurge, uFlow);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 clip = projectionMatrix * mv;
        gl_Position = clip;

        float size = (105.0 + 165.0 * aSeed.x) * (1.0 + 1.1 * uSurge);
        gl_PointSize = size * uScale * 40.0 / max(-mv.z, 1.0);

        vec2 headNdc = clip.xy / max(clip.w, 0.001);

        // Where was it? Project each past position and express the offset as a
        // fraction of this sprite, so the fragment can draw the wake directly.
        vec2 offs[8];
        for (int i = 0; i < 8; i++) {
          float back = (float(i) + 1.0) * 0.22;
          vec4 c = projectionMatrix * modelViewMatrix
                 * vec4(motePos(position, aSeed, uTime - back, uSurge, uFlow), 1.0);
          vec2 ndc = c.xy / max(c.w, 0.001);
          vec2 pixels = (ndc - headNdc) * uViewport * 0.5;
          vec2 local = pixels / max(gl_PointSize, 1.0);
          // keep the wake inside the sprite rather than letting it clip
          float m = length(local);
          if (m > 0.46) local *= 0.46 / m;
          offs[i] = local;
        }
        vT0 = vec4(offs[0], offs[1]);
        vT1 = vec4(offs[2], offs[3]);
        vT2 = vec4(offs[4], offs[5]);
        vT3 = vec4(offs[6], offs[7]);

        // Motes a few metres from the lens sweep across the frame every frame
        // and read as strobing. The swarm belongs in the middle distance.
        vNear = smoothstep(14.0, 70.0, -mv.z);

        float breath = 0.82 + 0.18 * sin(uTime * (0.7 + aSeed.z * 0.9) + aSeed.x * 30.0);
        float span = 190.0;
        float band = smoothstep(0.0, 24.0, p.y) * smoothstep(span, span - 70.0, p.y);
        vFade = band * breath * (0.45 + 0.55 * aSeed.y) * (0.6 + 0.9 * uSurge);
        vSeed = aSeed;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uRestore;
      varying float vFade;
      varying float vNear;
      varying vec3 vSeed;
      varying vec4 vT0;
      varying vec4 vT1;
      varying vec4 vT2;
      varying vec4 vT3;

      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.y = -q.y;

        // the head: a round bead of light
        // the head is a bead drawn out along the direction it is travelling, so the
        // creature reads as one long body rather than a dot with a tail
        vec2 dir = normalize(vT0.xy + vec2(1e-5));
        vec2 hq = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
        float head = exp(-(hq.x * hq.x * 200.0 + hq.y * hq.y * 900.0));
        float glow = exp(-dot(q, q) * 30.0) * 0.16
                   + exp(-dot(q, q) * 9.0) * 0.07;

        // The wake, laid along the path actually travelled — as one continuous
        // smear, not a row of beads. Summing a blob per past position gave the
        // creature a second head halfway down its tail; taking the distance to
        // the *polyline* instead stretches a single ribbon of light behind it.
        vec2 tp[8];
        tp[0] = vT0.xy; tp[1] = vT0.zw;
        tp[2] = vT1.xy; tp[3] = vT1.zw;
        tp[4] = vT2.xy; tp[5] = vT2.zw;
        tp[6] = vT3.xy; tp[7] = vT3.zw;

        float nearest = 1e9;
        float ageAt = 0.0;
        vec2 prev = vec2(0.0);
        for (int i = 0; i < 8; i++) {
          vec2 cur = tp[i];
          vec2 seg = cur - prev;
          float len2 = max(dot(seg, seg), 1e-7);
          float u = clamp(dot(q - prev, seg) / len2, 0.0, 1.0);
          vec2 closest = prev + seg * u;
          float d2 = dot(q - closest, q - closest);
          if (d2 < nearest) {
            nearest = d2;
            ageAt = (float(i) + u) / 8.0;
          }
          prev = cur;
        }

        // thickens and softens as it falls behind, and dies away
        float thick = mix(5200.0, 1900.0, ageAt);
        float tail = exp(-nearest * thick) * pow(1.0 - ageAt, 0.75) * 0.9;

        float alpha = (head + tail + glow) * vFade * vNear;
        if (alpha < 0.003) discard;

        // the tail runs through the spectrum; the head stays white
        float hue = fract(vSeed.y + uTime * 0.06 + ageAt * 1.35);
        vec3 iris = 0.42 + 0.58 * cos(6.28318 * (hue + vec3(0.00, 0.33, 0.67)));
        // lift the whole spectrum toward white so it glows rather than tints
        iris = mix(iris, vec3(1.0), 0.22);
        vec3 col = mix(iris, vec3(1.0), clamp(head * 1.6 + 0.10, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
  return new THREE.Points(geometry, material)
}

// ---------------------------------------------------------------------- scene
export function createCityScene(
  canvas: HTMLCanvasElement,
  { tier = 'high', onProgress }: { tier?: Tier; onProgress?: (v: number) => void } = {},
): CityScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(PALETTE.fogRuin, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  // The transmission pass re-renders the scene behind refractive surfaces.
  // Scaling it down keeps real refraction affordable on phones instead of
  // falling back to a flat translucent blue that reads as plastic.
  if ('transmissionResolutionScale' in renderer) {
    ;(renderer as THREE.WebGLRenderer & { transmissionResolutionScale: number })
      .transmissionResolutionScale = tier === 'high' ? 0.6 : 0.3
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const fogColor = PALETTE.fogRuin.clone()
  scene.fog = new THREE.FogExp2(fogColor, 0.0013)
  scene.background = fogColor

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 6000)
  camera.position.set(...WAYPOINTS[0].pos)

  const time: THREE.IUniform<number> = { value: 0 }
  // The pool gets its own rising front, separate from the city's: the water
  // should not simply be there at the start, it should fill the sphere as the
  // page scrolls, the same way everything else comes back.
  const poolFront: THREE.IUniform<number> = { value: POOL.y - POOL_RADIUS - 2 }
  const poolFoam: THREE.IUniform<number> = { value: 1 }
  const shared = {
    front: { value: RESTORE_FRONT[0] } as THREE.IUniform<number>,
    soft: { value: 34 } as THREE.IUniform<number>,
    amount: { value: 0 } as THREE.IUniform<number>,
  }

  // ---- lighting --------------------------------------------------------
  // A single hard moon does the modelling; the hemisphere only keeps the shadow
  // side from going to pure black. It sits ahead of the travel direction and
  // high, so the city is rim-lit and back-lit as the camera flies into it — and
  // so the disc itself is on screen, with its glitter path down the water.
  const MOON_DIR = new THREE.Vector3(0.70, 0.17, -0.63).normalize()
  const moon = new THREE.DirectionalLight(PALETTE.moonRuin, 3.4)
  moon.position.copy(MOON_DIR).multiplyScalar(900)
  scene.add(moon)

  // the disc, well outside the fog's reach so it stays crisp
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(150, 56),
    new THREE.MeshBasicMaterial({
      color: PALETTE.moon,
      toneMapped: false,
      fog: false,
      transparent: true,
      depthWrite: false,
    }),
  )
  const moonHalo = new THREE.Mesh(
    new THREE.CircleGeometry(230, 48),
    new THREE.MeshBasicMaterial({
      color: PALETTE.moon,
      toneMapped: false,
      fog: false,
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.environment = makeEnvironment(renderer, MOON_DIR).texture

  const moonGroup = new THREE.Group()
  moonGroup.add(moonDisc, moonHalo)
  moonGroup.position.copy(MOON_DIR).multiplyScalar(2600)
  moonGroup.renderOrder = -2
  scene.add(moonGroup)

  const hemi = new THREE.HemisphereLight(PALETTE.skyRuin, PALETTE.ground, 0.6)
  scene.add(hemi)

  const cityFill = new THREE.PointLight(PALETTE.neon, 0, 260, 2)
  cityFill.position.set(POOL.x, POOL.y, POOL.z)
  scene.add(cityFill)

  const rimFill = new THREE.PointLight(PALETTE.neon, 0, 300, 2)
  rimFill.position.set(STADIUM.x, STADIUM.rimHeight, STADIUM.z)
  scene.add(rimFill)

  scene.add(new THREE.AmbientLight(0x163a4a, 0.34))

  // A cool violet fill from the opposite side. Without it the shadow side of
  // the bowl goes colourless and the whole frame reads as grey-on-grey.
  const counter = new THREE.DirectionalLight(0x7a6ad8, 0.9)
  counter.position.set(-620, 180, 520)
  scene.add(counter)

  // The last chapter breaks into dawn, the way Tidus describes it.
  const sunrise = new THREE.DirectionalLight(PALETTE.dawnLight, 0)
  sunrise.position.set(1400, 90, -260)
  scene.add(sunrise)

  // ---- sea and motes ---------------------------------------------------
  const sea = createSea(fogColor, time)
  scene.add(sea.mesh)
  const moteViewport = new THREE.Vector2(1, 1)
  const motes = createMotes(tier === 'high' ? 340 : 150, time, moteViewport)
  scene.add(motes)

  // ---- camera rig ------------------------------------------------------
  const posCurve = new THREE.CatmullRomCurve3(
    WAYPOINTS.map(w => new THREE.Vector3(...w.pos)),
    false,
    'catmullrom',
    0.5,
  )
  const targetCurve = new THREE.CatmullRomCurve3(
    WAYPOINTS.map(w => new THREE.Vector3(...w.target)),
    false,
    'catmullrom',
    0.5,
  )
  const fixedPos = new THREE.Vector3()
  const fixedTarget = new THREE.Vector3()
  const poolCentre = new THREE.Vector3(POOL.x, POOL.y, POOL.z)
  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()
  const camForward = new THREE.Vector3()
  const camRight = new THREE.Vector3()

  // ---- model -----------------------------------------------------------
  const materials = buildMaterials(shared, tier)
  animateWater(materials.water, time, new THREE.Vector3(POOL.x, POOL.y, POOL.z), POOL_RADIUS, poolFront, poolFoam)

  const BY_NAME: Record<string, THREE.Material> = {
    Stone: materials.stone,
    StoneDark: materials.dark,
    Metal: materials.metal,
    Glow: materials.glow,
    Clad: materials.clad,
    Neon: materials.neon,
    Pool: materials.water,
    Water: materials.spray,
    Falls: materials.spray,
    Far: materials.far,
  }

  const disposables: Array<{ dispose(): void }> = []
  let cityRoot: THREE.Object3D | null = null

  // Plain glTF, no mesh compression. Draco would cut the file to a third, but
  // its decoder is Emscripten output that calls `new Function`, so any page
  // served under a `script-src` policy without 'unsafe-eval' fails to decode
  // and the scene never appears. Dropping the normals instead got the model to
  // a comparable size with nothing to decode at all.
  const loader = new GLTFLoader()

  const ready = new Promise<void>((resolve, reject) => {
    loader.load(
      MODEL_URL,
      gltf => {
        cityRoot = gltf.scene
        cityRoot.traverse(obj => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          const original = mesh.material as THREE.Material
          const replacement = BY_NAME[original?.name ?? '']
          if (replacement) mesh.material = replacement
          if (original && !Object.values(BY_NAME).includes(original)) original.dispose()
          mesh.frustumCulled = true
          // the smooth surfaces need real normals back — the model ships without
          if (replacement === materials.water || replacement === materials.spray) {
            mesh.geometry.computeVertexNormals()
            mesh.renderOrder = 3
          }
          // neon has to draw after the opaque city or additive blending eats it
          if (replacement === materials.neon) mesh.renderOrder = 2
          disposables.push(mesh.geometry)
        })
        scene.add(cityRoot)
        resolve()
      },
      // Content-Length is not always there (gzip, some CDNs). When it is not,
      // total is 0 and this reports nothing rather than dividing by zero — the
      // loading screen falls back to its own indeterminate crawl.
      evt => {
        if (onProgress && evt.total > 0) onProgress(Math.min(1, evt.loaded / evt.total))
      },
      err => reject(err),
    )
  })

  // The sphere's interior.
  //
  // Displacing the outer surface hard made it look like slime — a wobbling
  // blob. What actually reads as "a volume of water being held" is motion
  // *inside* it, so the outer skin now barely moves and this shell raymarches
  // a few steps through the sphere instead, accumulating a swirling field.
  // Eight samples is enough at the size this ever appears on screen.
  const coreMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: time,
      uColor: { value: new THREE.Color(0x8ad4ff) },
      uDeep: { value: new THREE.Color(0x1d6fae) },
      uGain: { value: 1 },
      uCentre: { value: new THREE.Vector3(POOL.x, POOL.y, POOL.z) },
      uRadius: { value: POOL_RADIUS * 0.97 },
      uFill: { value: POOL.y - POOL_RADIUS - 2 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uDeep;
      uniform float uGain;
      uniform vec3 uCentre;
      uniform float uRadius;
      uniform float uFill;
      varying vec3 vWorld;

      // cheap trig noise — no texture, and smooth enough to look like flow
      float wisp(vec3 p) {
        return sin(p.x) * sin(p.y * 1.13) * sin(p.z * 0.87)
             + 0.5 * sin(p.x * 2.1 + p.z * 1.7) * sin(p.y * 1.9);
      }

      float churn(vec3 q, float t) {
        // Work in cylindrical coordinates so the field can be made to *turn*.
        // Plain 3D noise drifted as a block and read as fog; banding it by
        // radius and advecting it around the axis is what gives the sphere a
        // visible current running through it.
        float r = length(q.xz);
        float ang = atan(q.z, q.x);
        // inner water turns faster than outer, as a stirred volume does
        float spin = t * (1.35 - 0.55 * r);
        vec3 sw = vec3(cos(ang + spin) * r, q.y, sin(ang + spin) * r);

        vec3 warp = vec3(
          wisp(sw * 1.7 + vec3(0.0, t * 0.5, 0.0)),
          wisp(sw * 1.9 + vec3(t * 0.4, 0.0, 1.7)),
          wisp(sw * 1.5 + vec3(2.3, 0.0, t * 0.45)));

        // filaments stretched along the flow: fine across the bands, smooth along
        float v = wisp(vec3(sw.x * 4.2, sw.y * 3.4, sw.z * 4.2) + warp * 0.7);
        v += 0.5 * wisp(vec3(sw.x * 8.4, sw.y * 6.0, sw.z * 8.4) - warp * 0.5);
        // concentric shells, so the eye can follow the rotation
        v += 0.55 * sin(r * 11.0 - t * 2.1 + warp.y * 1.4);
        return v * 0.62;
      }

      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorld - ro);
        vec3 oc = ro - uCentre;
        float b = dot(oc, rd);
        float c2 = dot(oc, oc) - uRadius * uRadius;
        float h = b * b - c2;
        if (h < 0.0) discard;
        h = sqrt(h);
        float t0 = max(-b - h, 0.0);
        float t1 = -b + h;
        if (t1 <= t0) discard;

        // The volume is not full: there is a water *surface* inside the shell,
        // and it sloshes. Crossing it is what the eye reads as waves, so the
        // march tracks which side of that surface each sample falls on and
        // brightens the crossing into a foam line.
        const int STEPS = 14;
        float acc = 0.0;
        float surf = 0.0;
        float prevSide = 0.0;
        float span = (t1 - t0) / float(STEPS);
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * (t0 + span * (float(i) + 0.5));
          if (p.y > uFill) { prevSide = 0.0; continue; }
          vec3 q = (p - uCentre) / uRadius;
          float d = churn(q * 2.2, uTime);
          acc += max(0.0, d) * (1.0 - dot(q, q) * 0.55);

          // the sloshing waterline: a plane, tilted and rippled over time
          float level = 0.30
            + 0.16 * sin(uTime * 0.62)
            + 0.13 * sin(q.x * 3.1 + uTime * 1.35)
            + 0.10 * sin(q.z * 2.7 - uTime * 1.08)
            + 0.05 * sin((q.x + q.z) * 6.2 + uTime * 2.1);
          float side = q.y - level;
          if (i > 0 && side * prevSide < 0.0) {
            // foam where the ray crosses the surface, brighter head-on
            surf += 0.55 * (1.0 - abs(dot(normalize(q), rd)) * 0.4);
          }
          prevSide = side;
        }
        acc /= float(STEPS);
        surf = clamp(surf, 0.0, 1.0);

        float thickness = clamp((t1 - t0) / (2.0 * uRadius), 0.0, 1.0);
        vec3 col = mix(uDeep, uColor, clamp(acc * 2.1, 0.0, 1.0));
        col = mix(col, vec3(1.0), clamp(acc - 0.55, 0.0, 1.0) * 0.8);
        float alpha = (0.06 + acc * 1.15) * thickness * uGain;
        col = mix(col, vec3(1.0), surf * 0.85);
        alpha = clamp(alpha + surf * 0.55, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha * 0.65);
      }
    `,
  })
  const core = new THREE.Mesh(new THREE.SphereGeometry(POOL_RADIUS * 0.99, 32, 24), coreMaterial)
  core.position.set(POOL.x, POOL.y, POOL.z)
  core.renderOrder = 4
  scene.add(core)

  // ---- post-processing -------------------------------------------------
  // Bloom is what turns emissive strips into light. If the effect library
  // fails to initialise for any reason we simply draw without it.
  let composer: { render(dt?: number): void; setSize(w: number, h: number): void; dispose(): void } | null = null
  // The composer may finish initialising after the first resize(), so the last
  // requested size is remembered and replayed. Never derive this from the
  // canvas's CSS box — the canvas is stretched by its container until the
  // stage layout settles, which is what produced a 884x3750 buffer.
  const lastSize = { width: 1, height: 1 }
  const setupComposer = async () => {
    try {
      const pp = await import('postprocessing')
      const c = new pp.EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
      c.addPass(new pp.RenderPass(scene, camera))
      const bloom = new pp.BloomEffect({
        // A low threshold made every lit surface bloom, and once the city
        // came back the glow swallowed the buildings behind it. Only genuinely
        // bright things blow out now.
        intensity: tier === 'high' ? 1.15 : 0.9,
        luminanceThreshold: 0.42,
        luminanceSmoothing: 0.35,
        mipmapBlur: true,
        radius: tier === 'high' ? 0.72 : 0.5,
      })
      const vignette = new pp.VignetteEffect({ darkness: 0.38, offset: 0.34 })
      c.addPass(new pp.EffectPass(camera, bloom, vignette))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      composer = c
      composer.setSize(lastSize.width, lastSize.height)
    } catch {
      composer = null
    }
  }
  void setupComposer()

  // ---- per-frame state -------------------------------------------------
  let progress = 0
  let shown = 0
  let restore = 0

  const api: CityScene = {
    ready,
    get restore() {
      return restore
    },

    setProgress(p: number) {
      progress = clamp01(p)
    },

    render(dt: number) {
      // Animation runs on a clamped step — a long stall must not teleport the
      // water or fling the swarm across the scene.
      const step = Math.min(0.05, dt)
      time.value += step
      // The camera ease, though, uses the real elapsed time. Clamping it too
      // meant the eased position advanced a fixed fraction *per frame*, so on
      // a machine drawing one frame a second the camera crawled toward the
      // reader's scroll position for half a minute after they stopped.
      shown += (progress - shown) * (1 - Math.exp(-4.5 * Math.min(2, dt)))

      // Remap scroll onto the path so the camera settles on each chapter's
      // shot *while that chapter's text is centred*. The panels are centred at
      // (i + 0.5) / n, so the stops have to land there — anchoring them at
      // i / (n - 1) instead, as a first version did, left every shot arriving a
      // fifth of a screen after the words it belongs to.
      const n = SECTION_STOPS.length
      const p0 = 0.5 / n
      const span = 1 / n
      const slot = (clamp01(shown) - p0) / span
      const i = Math.max(0, Math.min(n - 2, Math.floor(slot)))
      const local = clamp01(slot - i)
      // smoothstep has zero gradient at both ends: slow at the stops, quick in
      // between, which is the dwell we want
      const travel = SECTION_STOPS[i] + (SECTION_STOPS[i + 1] - SECTION_STOPS[i]) * smoothstep(0, 1, local)

      posCurve.getPointAt(clamp01(travel), camPos)
      targetCurve.getPointAt(clamp01(travel), camTarget)

      // Chapters that frame themselves. Blended in over the approach and out
      // over the departure, so the path still carries the camera between them.
      const eased = smoothstep(0, 1, local)
      const camA = SECTION_CAMS[i]
      const camB = SECTION_CAMS[i + 1]
      if (camA) {
        camPos.lerp(fixedPos.set(...camA.pos), 1 - eased)
        camTarget.lerp(fixedTarget.set(...camA.target), 1 - eased)
      }
      if (camB) {
        camPos.lerp(fixedPos.set(...camB.pos), eased)
        camTarget.lerp(fixedTarget.set(...camB.target), eased)
      }

      // Push the subject to the side of frame the text is *not* on. The panels
      // alternate left and right, and without this the stadium sits under the
      // words as often as beside them. Swinging the aim rather than the camera
      // keeps the flight path intact.
      const sideNow = SECTION_SIDES[i] === 'left' ? -1 : 1
      const sideNext = SECTION_SIDES[Math.min(SECTION_SIDES.length - 1, i + 1)] === 'left' ? -1 : 1
      const bias = lerp(sideNow, sideNext, eased)
      camForward.subVectors(camTarget, camPos)
      const reach = camForward.length()
      camForward.normalize()
      camRight.crossVectors(camForward, camera.up).normalize()
      camTarget.addScaledVector(camRight, bias * reach * 0.20)

      camera.position.copy(camPos)
      camera.lookAt(camTarget)
      // a slow drift so a paused scroll never looks like a still image
      camera.position.y += Math.sin(time.value * 0.35) * 0.5
      camera.rotation.z += Math.sin(time.value * 0.21) * 0.004
      // billboard the moon, and keep it pinned at a constant remove from the eye
      moonGroup.position.copy(camera.position).addScaledVector(MOON_DIR, 2600)
      moonGroup.quaternion.copy(camera.quaternion)

      restore = smoothstep(RESTORE_RANGE[0], RESTORE_RANGE[1], travel)
      shared.amount.value = restore
      shared.front.value = lerp(RESTORE_FRONT[0], RESTORE_FRONT[1], restore)

      // Inside the sphere the world goes green and close. The camera passes
      // straight through the water, so this is a real state the scene enters,
      // not an effect: the fog thickens to water and everything tints.
      const submersion = 1 - smoothstep(POOL_RADIUS * 0.72, POOL_RADIUS * 1.12,
        camera.position.distanceTo(poolCentre))
      const dawn = smoothstep(0.90, 1.0, travel)
      fogColor.copy(PALETTE.fogRuin).lerp(PALETTE.fogCity, restore)
      fogColor.lerp(PALETTE.dawn, dawn)
      fogColor.lerp(PALETTE.submerged, submersion)
      ;(scene.fog as THREE.FogExp2).density = lerp(lerp(0.0013, 0.00062, restore), 0.0055, submersion)
      renderer.setClearColor(fogColor, 1)
      renderer.toneMappingExposure = lerp(lerp(1.15, 1.32, dawn), 0.92, submersion)
      sunrise.intensity = dawn * 3.2
      sea.uniforms.uDawn.value = dawn
      sea.uniforms.uDusk.value = (1 - restore) * (1 - dawn)

      moon.color.copy(PALETTE.moonRuin).lerp(PALETTE.moonCity, restore)
      moon.intensity = lerp(3.4, 1.8, restore)
      ;(moonDisc.material as THREE.MeshBasicMaterial).opacity = lerp(1, 0.75, restore) * (1 - dawn * 0.85)
      // the disc cools from a low sun to a moon as the city comes back
      ;(moonDisc.material as THREE.MeshBasicMaterial).color
        .copy(PALETTE.moon).lerp(PALETTE.moonCity, restore)
      moonGroup.scale.setScalar(lerp(1.0, 0.55, restore))
      ;(moonHalo.material as THREE.MeshBasicMaterial).opacity = lerp(0.10, 0.06, restore)
      hemi.color.copy(PALETTE.skyRuin).lerp(PALETTE.skyCity, restore)
      hemi.intensity = lerp(0.6, 1.35, restore)
      counter.intensity = lerp(0.9, 1.5, restore) * (1 - dawn * 0.6)
      // From outside this lamp is the sphere's inner glow. From inside the
      // camera sits a few metres off it with inverse-square falloff, so at
      // full strength it blows the whole interior out — it dims right down
      // once the lens is in the water.
      cityFill.intensity = lerp(1700, 3600, restore) * lerp(1, 0.07, submersion)
      // The interior glow is meant to be read from outside. With the camera
      // inside the sphere it is an additive shell wrapped around the lens and
      // whites out the whole frame, so it goes away while submerged.
      coreMaterial.uniforms.uGain.value = lerp(1.0, 1.35, restore) * (1.0 - submersion)
      // the pool fills over its own slice of the scroll
      const fill = smoothstep(0.08, 0.42, travel)
      poolFront.value = lerp(POOL.y - POOL_RADIUS - 2, POOL.y + POOL_RADIUS + 2, fill)
      coreMaterial.uniforms.uFill.value = poolFront.value
      rimFill.intensity = lerp(300, 5200, restore) * lerp(1, 0.30, submersion)
      sea.uniforms.uRestore.value = restore
      materials.water.emissiveIntensity = lerp(0.30, 0.0, submersion)
      // The nets and the scoreboard face are additive white. Fine across the
      // bowl; inside the sphere they are a metre from the lens and bloom into
      // a white wall, so they come down to a readable level.
      materials.neon.opacity = lerp(1, 0.42, submersion)
      // seen from within, the meniscus and the foam sit right on the lens
      poolFoam.value = 1 - submersion
      materials.water.opacity = 1

      // the swarm peaks while the cladding is actually filling in
      const moteUniforms = (motes.material as THREE.ShaderMaterial).uniforms
      moteUniforms.uSurge.value = Math.sin(restore * Math.PI) ** 0.7
      moteUniforms.uRestore.value = restore
      moteUniforms.uScale.value = lerp(1, 1.25, restore)
      // the swarm's heading turns roughly twice over the length of the scroll
      const flowAngle = travel * Math.PI * 3.4
      const flowStrength = 0.22 + 0.30 * (0.5 + 0.5 * Math.sin(travel * Math.PI * 2.2))
      moteUniforms.uFlow.value.set(
        Math.cos(flowAngle) * flowStrength,
        0.18 * Math.sin(travel * Math.PI * 1.6),
        Math.sin(flowAngle) * flowStrength,
      )

      if (composer) composer.render(step)
      else renderer.render(scene, camera)
    },

    resize(width: number, height: number, dpr: number) {
      lastSize.width = Math.max(1, Math.round(width))
      lastSize.height = Math.max(1, Math.round(height))
      // the motes project their own wake, so they need the pixel viewport
      moteViewport.set(lastSize.width, lastSize.height)
      renderer.setPixelRatio(dpr)
      // updateStyle: true — the canvas must own its CSS size so no ancestor can
      // stretch the buffer out of aspect
      renderer.setSize(lastSize.width, lastSize.height, true)
      composer?.setSize(lastSize.width, lastSize.height)
      camera.aspect = lastSize.width / lastSize.height
      camera.updateProjectionMatrix()
    },

    dispose() {
      composer?.dispose()
      core.geometry.dispose()
      coreMaterial.dispose()
      scene.environment?.dispose()
      moonDisc.geometry.dispose()
      ;(moonDisc.material as THREE.Material).dispose()
      moonHalo.geometry.dispose()
      ;(moonHalo.material as THREE.Material).dispose()
      if (cityRoot) scene.remove(cityRoot)
      for (const d of disposables) d.dispose()
      for (const m of Object.values(materials)) m.dispose()
      sea.mesh.geometry.dispose()
      ;(sea.mesh.material as THREE.Material).dispose()
      motes.geometry.dispose()
      ;(motes.material as THREE.Material).dispose()
      renderer.dispose()
    },
  }

  return api
}
