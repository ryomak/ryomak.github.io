// The Zanarkand stage.
//
// One model, two states. Everything in the file is either the ruin the page
// opens on, the city it becomes, or the machinery that carries one into the
// other:
//
//   * the sky, which burns down from a sunset to a starfield;
//   * a restoration front, a world-space height above which the restored
//     layers of the model are simply not drawn, which rises as the page is
//     scrolled so the city rebuilds itself from the waterline up;
//   * pyreflies, which are the only thing on screen that is alive.
//
// The model arrives Y-up: a point authored in Blender as (bx, by, bz) is here
// (bx, bz, -by). Sea level is Y = 0.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  FOV,
  PYRE_RANGE,
  NIGHT_RANGE,
  RESTORE_FRONT,
  RESTORE_RANGE,
  SECTIONS,
  ORBIT,
  SUN_DIR,
  WAYPOINTS,
} from './config'

// Two models, one scene.
//
// The ruin is the new procedural build: terrain, broken towers, the memorial,
// the sunset. The city it becomes is the earlier model — a denser, better
// stadium and waterfront than the generator produces — brought in whole and
// revealed by the restoration front. Keeping them separate means each can be
// the best version of itself rather than two states of a compromise.
const RUIN_URL = '/models/zanarkand2.glb'
const CITY_URL = '/models/zanarkand3.glb'
const DRACO_PATH = '/draco/'

/**
 * How the city model is placed inside the ruin's basin.
 *
 * It is authored around an arena of radius 110 with its waterfront running out
 * to about 880 and a silhouette ring beyond that. The basin is 620 across, so
 * it comes down to three quarters — which puts the arena at 82, the near
 * districts inside the rim, and the far ring standing over it.
 */
const CITY_SCALE = 0.75
const CITY_LIFT = 26

type Tier = 'high' | 'low'

export type CityScene = {
  ready: Promise<void>
  render(dt: number): void
  resize(width: number, height: number, dpr: number): void
  setProgress(p: number): void
  dispose(): void
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------- the palette
// Two of everything: where the colour sits over the ruin, and where it sits
// over the finished city. The scroll mixes between them.
const PALETTE = {
  sunWarm: new THREE.Color(0xffb066),
  moonCool: new THREE.Color(0x9fc6ff),
  ambientDusk: new THREE.Color(0xff8a45),
  ambientNight: new THREE.Color(0x2a4a70),
  fogDusk: new THREE.Color(0x8a3a12),
  fogNight: new THREE.Color(0x0a1420),
}

// ------------------------------------------------------------------- the sky
/**
 * A painted sky, not a simulated one.
 *
 * The reference is a matte painting: a hard orange band on the horizon, heavy
 * cloud over it, the sun sitting in the gap. A physically-correct atmosphere at
 * two degrees of elevation renders a flat blue-grey, which is accurate and
 * useless. So the gradient, the sun, the cloud bands and the stars are all
 * written out by hand here, and the same `uNight` that turns the sky over is
 * the one driving the lights and the fog.
 */
function createSky(sunDir: THREE.Vector3) {
  const uniforms = {
    uSun: { value: sunDir.clone() },
    uNight: { value: 0 },
    uTime: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        // the dome rides with the camera, so it can never be reached
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }

      float fbm(vec3 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.03; a *= 0.5; }
        return s;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp((d.y + 0.16) / 0.72, 0.0, 1.0);

        // the vertical gradient, dusk and night held side by side
        vec3 dusk = mix(mix(vec3(0.72, 0.30, 0.08), vec3(0.44, 0.16, 0.09), smoothstep(0.0, 0.30, h)),
                        vec3(0.09, 0.06, 0.11), smoothstep(0.22, 0.85, h));
        // Darker than looks right in isolation. Against a city this lit, a
        // night sky with any lift in it stops being night — the towers have to
        // be the brightest thing in the frame.
        // Lifted. The version before this was accurate night and completely
        // unreadable — the city was a black shape on a black sky. A page has
        // to be lookable-at before it is correct.
        vec3 night = mix(mix(vec3(0.085, 0.150, 0.225), vec3(0.042, 0.078, 0.140), smoothstep(0.0, 0.32, h)),
                         vec3(0.014, 0.024, 0.058), smoothstep(0.20, 0.90, h));
        vec3 col = mix(dusk, night, uNight);

        // the sun, and the moon that replaces it
        float sd = max(dot(d, normalize(uSun)), 0.0);
        float glow = pow(sd, 26.0);
        float disc = smoothstep(0.9986, 0.9994, sd);
        // Kept deliberately low. The first version put a 6x white disc on the
        // horizon and, with bloom on top, the opening frame was physically
        // uncomfortable to look at — which is not the same thing as being a
        // bright sunset. The sun now reads by being *warmer* than the sky
        // around it rather than by being brighter than the screen allows.
        col += vec3(1.10, 0.46, 0.14) * glow * (1.0 - uNight) * 0.85;
        col += vec3(1.30, 0.86, 0.52) * disc * (1.0 - uNight) * 1.4;
        // the moon comes up on the other side of the sky
        vec3 moon = normalize(vec3(0.52, 0.42, 0.74));
        float md = max(dot(d, moon), 0.0);
        col += vec3(0.55, 0.68, 0.95) * pow(md, 90.0) * uNight * 0.9;
        col += vec3(1.0, 1.0, 1.0) * smoothstep(0.99955, 0.99985, md) * uNight * 3.2;

        // stars, only once it is dark enough for them
        float sparkle = hash(floor(d * 620.0));
        float stars = smoothstep(0.9975, 0.9995, sparkle) * smoothstep(0.02, 0.40, d.y);
        col += vec3(0.85, 0.90, 1.0) * stars * uNight *
               (0.6 + 0.4 * sin(uTime * 1.7 + sparkle * 90.0));

        // cloud bands: stretched flat along the horizon so they read as strata
        float c = fbm(vec3(d.xz * 2.4, d.y * 9.0) + vec3(uTime * 0.004, 0.0, 0.0));
        float band = smoothstep(0.46, 0.74, c) * (1.0 - smoothstep(0.16, 0.72, h));
        vec3 cloudCol = mix(vec3(0.055, 0.036, 0.044), vec3(0.02, 0.035, 0.06), uNight);
        col = mix(col, cloudCol, band * 0.78);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 26), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return { mesh, uniforms, material }
}

// --------------------------------------------------------- the restoration
type Restore = {
  uFront: { value: number }
  uSeam: { value: number }
}

/**
 * Hide everything above a world-space height, and light the cut.
 *
 * This is the whole transformation, and it is deliberately one line of shader:
 * the restored layers of the model are present from the first frame and simply
 * clipped away, so bringing the city back costs nothing but a uniform. The
 * alternative — building geometry as the scroll advances — spends its budget
 * on allocation at exactly the moment the reader is moving.
 */
/**
 * The opposite of the restoration: hide everything *below* the front.
 *
 * Without this the ruin simply stayed where it was and the finished city grew
 * up around it — broken stumps standing next to lit towers, a wrecked shell
 * beside the sphere. The two states have to trade places, not overlap, so the
 * same rising line that reveals the city takes the ruin away underneath it.
 */
function applyDissolve(material: THREE.Material, shared: Restore) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uFront = shared.uFront
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vDisY;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDisY = (modelMatrix * vec4(transformed, 1.0)).y;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying float vDisY;\nuniform float uFront;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         if (vDisY < uFront) discard;`,
      )
  }
  material.needsUpdate = true
}

function applyRestore(material: THREE.Material, shared: Restore, seam: THREE.Color,
                      warmth = 0) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uFront = shared.uFront
    shader.uniforms.uSeamW = shared.uSeam
    shader.uniforms.uSeamC = { value: seam }
    shader.uniforms.uWarm = { value: warmth }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldP;
         uniform float uFront;
         uniform float uSeamW;
         uniform float uWarm;
         uniform vec3 uSeamC;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float vWorldY = vWorldP.y;
         if (vWorldY > uFront) discard;

         // Lamplight, not signage.
         //
         // The older model has a single emissive material for every lit
         // surface it owns, so lighting it from one colour gave a city that
         // was uniformly blue and, at night, uniformly dark. This scatters
         // amber through it by hashing world position: neighbouring windows
         // land on different sides of the threshold, so a facade ends up with
         // warm rooms among the cold ones, which is what a city looks like
         // when people are still in it.
         if (uWarm > 0.0) {
           // Per window, not per district. The cell has to be small enough
           // that neighbouring windows land in different cells — at the size
           // the first attempt used, whole facades went amber together and it
           // read as coloured lighting rather than as rooms.
           vec3 cell = floor(vWorldP * 0.14);
           float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
           float h2 = fract(h * 197.31);
           float warm = step(1.0 - uWarm, h);
           vec3 amber = vec3(1.30, 0.66, 0.24);
           vec3 cold  = vec3(0.46, 0.86, 1.08);
           // and not every window is on, or on as hard as its neighbour
           gl_FragColor.rgb *= mix(cold, amber, warm) * (0.62 + 0.52 * h2);
         }

         // the seam: a band of light riding the front as it climbs, so the
         // rebuild has an edge you can watch rather than appearing all at once
         float seam = 1.0 - smoothstep(0.0, uSeamW, uFront - vWorldY);
         gl_FragColor.rgb += uSeamC * seam * 1.6;`,
      )
  }
  material.needsUpdate = true
}

/**
 * Make the sphere behave like water.
 *
 * A perfectly round, perfectly clear ball reads as glass, and the pitch inside
 * it reads as an ornament in a paperweight. Two things fix that and they have
 * to happen together: the silhouette has to move — big slow lobes rolling
 * around it, chop riding on those — and the volume has to be murky enough that
 * what is inside is *suggested* rather than displayed. Water a hundred feet
 * deep does not show you the far wall.
 */
function applyWaves(material: THREE.MeshPhysicalMaterial, time: { value: number },
                    centre: THREE.Vector3, radius: number) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = shader => {
    prev?.call(material, shader, undefined as never)
    shader.uniforms.uTime = time
    shader.uniforms.uCentre = { value: centre }
    shader.uniforms.uRadius = { value: radius }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform vec3 uCentre;
         uniform float uRadius;
         // three bands of swell, at different rates and axes, so the outline
         // never repeats within the time anyone watches it
         float swell(vec3 d, float t) {
           return sin(d.y * 3.1 + t * 0.9) * 0.42
                + sin(d.x * 4.7 - t * 1.15) * 0.28
                + sin((d.x + d.z) * 7.3 + t * 1.7) * 0.16
                + sin((d.y - d.z) * 12.1 - t * 2.4) * 0.08;
         }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vec3 dir = normalize(wp - uCentre);
         float amp = uRadius * 0.055 * swell(dir, uTime);
         transformed += normalize(objectNormal) * amp;`,
      )
    shader.fragmentShader = shader.fragmentShader
      // the uniform has to be declared on this side too — it was only in the
      // vertex stage, and the program failed to link with no useful message
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       // ripple the shading normal with a finer version of the same field, so
       // the highlights break up rather than sliding around as one sheet
       normal = normalize(normal + 0.16 * vec3(
         sin(vViewPosition.y * 0.9 + uTime * 2.1),
         sin(vViewPosition.x * 1.1 - uTime * 1.7),
         sin(vViewPosition.z * 1.3 + uTime * 2.6)));`,
    )
  }
  material.needsUpdate = true
}

// ------------------------------------------------------------------ the water
function createWaterMaterial(time: { value: number }, night: { value: number },
                             sunDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uNight: night,
      uSun: { value: sunDir.clone() },
      uFog: { value: new THREE.Color(0x2a1408) },
      uFogDensity: { value: 0.00042 },
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
      uniform float uNight;
      uniform vec3 uSun;
      uniform vec3 uFog;
      uniform float uFogDensity;
      varying vec3 vWorld;

      // Three crossed wave trains. Enough to break a mirror, cheap enough to
      // run at full resolution — the water is most of the lower half of the
      // opening frame, so it cannot be the expensive thing on screen.
      vec3 ripple(vec2 p) {
        float a = sin(p.x * 0.055 + uTime * 0.55) * 0.5 + sin(p.y * 0.041 - uTime * 0.42) * 0.5;
        float b = sin((p.x + p.y) * 0.021 + uTime * 0.31);
        float c = sin((p.x - p.y) * 0.087 - uTime * 0.9) * 0.35;
        return normalize(vec3((a + c) * 0.045, 1.0, (b + c) * 0.045));
      }

      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 n = ripple(vWorld.xz);
        float fres = pow(1.0 - max(dot(view, n), 0.0), 4.0);

        vec3 deep = mix(vec3(0.055, 0.030, 0.022), vec3(0.010, 0.026, 0.044), uNight);
        vec3 sky  = mix(vec3(0.90, 0.42, 0.14), vec3(0.10, 0.18, 0.30), uNight);
        vec3 col = mix(deep, sky, clamp(fres * 1.5, 0.0, 1.0));

        // the sun's road across the water — the single strongest cue that this
        // is a low sun over a sea and not a dark floor
        vec3 h = normalize(normalize(uSun) + view);
        float spec = pow(max(dot(n, h), 0.0), 220.0);
        col += mix(vec3(2.6, 1.3, 0.42), vec3(0.5, 0.7, 1.0), uNight) * spec * 1.4;

        float d = length(cameraPosition - vWorld);
        float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));
        col = mix(col, uFog, clamp(fog, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

// -------------------------------------------------------------- the pyreflies
/**
 * 幻光虫.
 *
 * This is the Blender construction, moved onto the page — the same one the
 * reference stills were rendered from, not an approximation of them.
 *
 *   * 340 separate grains laid along a curve. The grains are cubes, not
 *     spheres: the reference is angular, and the trail reads like pixel art.
 *     Smoothing them destroys exactly the quality that makes it a pyrefly.
 *   * The path has an inflection. It leaves the head climbing to the upper
 *     right, crosses an apex, and falls away. It is not a bent line.
 *   * The grains spread as they get further from the head — the scatter radius
 *     grows about eightfold down the tail.
 *   * Colour runs along the path: incandescent → cyan → green → blue →
 *     violet, with the brightness of each individual grain jittered.
 *   * The bloom around the head is volume. A surface always shows its edge.
 *
 * The one thing that went wrong in Blender is worth keeping written down: at a
 * grain emission of 22 every grain clipped to white, and the shape was right
 * while not one of the colours survived. 1.9 for the grains, 28 for the head,
 * is what actually holds the spectrum.
 *
 * On the page the grain count per fly is lower than 340 — the swarm is drawn
 * hundreds of times over rather than once at close range — but the curve, the
 * spread law, the ramp and the two brightnesses are the same numbers.
 */
function createPyreflies(count: number, time: { value: number }, alive: { value: number }) {
  const GRAINS = count > 60 ? 96 : 52
  const total = count * GRAINS

  // one seed per fly, reused by every grain that belongs to it
  type Fly = { x: number; y: number; z: number; sp: number; roll: number }
  const fly: Fly[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 60 + Math.random() ** 1.25 * 620
    fly.push({
      x: Math.cos(a) * r,
      y: Math.random() ** 2.1 * 210 - 8,
      z: Math.sin(a) * r,
      sp: 0.4 + Math.random() * 1.5,
      // The arc is built in the view plane so it always presents the shape the
      // reference has. Rolling each fly by its own angle stops a whole swarm
      // of identical hooks all pointing the same way.
      roll: Math.random() * Math.PI * 2,
    })
  }

  const quad = new THREE.PlaneGeometry(1, 1)

  const seeds = new Float32Array(total * 4)
  const us = new Float32Array(total)
  const jit = new Float32Array(total * 3)
  const rolls = new Float32Array(total)
  let k = 0
  for (let i = 0; i < count; i++) {
    const f = fly[i]
    for (let g = 0; g < GRAINS; g++) {
      // Biased towards the head. An even spacing spends most of the grains on
      // the thin end of the tail, where they are furthest apart and read as
      // noise rather than as a trail.
      const u = (g / (GRAINS - 1)) ** 1.12
      seeds[k * 4 + 0] = f.x
      seeds[k * 4 + 1] = f.y
      seeds[k * 4 + 2] = f.z
      seeds[k * 4 + 3] = f.sp
      us[k] = u
      jit[k * 3 + 0] = (Math.random() * 2 - 1)
      jit[k * 3 + 1] = (Math.random() * 2 - 1)
      jit[k * 3 + 2] = 0.45 + Math.random() * 1.1
      rolls[k] = f.roll
      k++
    }
  }

  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.attributes.position = quad.attributes.position
  geo.attributes.uv = quad.attributes.uv
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
  geo.setAttribute('aU', new THREE.InstancedBufferAttribute(us, 1))
  geo.setAttribute('aJit', new THREE.InstancedBufferAttribute(jit, 3))
  geo.setAttribute('aRoll', new THREE.InstancedBufferAttribute(rolls, 1))
  geo.instanceCount = total

  const uScale = { value: 1 }

  // Shared by both passes: where a fly is, and where its tail used to be.
  const COMMON = /* glsl */ `
    uniform float uTime;
    uniform float uScale;

    // Where one fly is at time t, and — with u > 0 — where the part of its
    // tail that is u of the way back was, when it was there.
    //
    // The tail is not a shape bolted to the head. It is the path the fly
    // actually took, sampled backwards in time, so it writhes because the
    // flight writhes. A fixed arc, however well curved, is a dead thing being
    // towed behind an animal; this one wanders because the animal wandered.
    vec3 at(vec4 s, float t, float u, float roll) {
      float sp = s.w;
      float speed = 3.4 + sp * 4.6;
      float lag = u * 3.0;
      float tt = t - lag;

      // Height is taken from the head and walked back down rather than run
      // through the same mod(), because a fly crossing the wrap point would
      // otherwise throw its tail 330 units across the sky.
      float y = mod(s.y + t * speed + s.x * 0.31, 330.0) - 24.0 - lag * speed;

      // the slow drift
      float wob = sin(tt * (0.28 + sp * 0.2) + s.x * 0.07) * (7.0 + sp * 9.0);
      float wob2 = cos(tt * (0.19 + sp * 0.14) + s.z * 0.05) * (6.0 + sp * 7.0);

      // and the wriggle. Three periods that do not share a factor, fast
      // enough that three seconds of tail holds about a wave and a half —
      // which is what reads as something swimming rather than as a comet.
      float w1 = sin(tt * 2.9 + roll) * (0.5 + u * 5.4);
      float w2 = cos(tt * 2.3 + roll * 1.7) * (0.4 + u * 4.6);
      float w3 = sin(tt * 3.7 + roll * 0.6) * (0.2 + u * 2.1);

      return vec3(s.x + wob + w1, y + w3, s.z + wob2 + w2);
    }
  `

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // The quad is rebuilt in view space, and any basis with a negative
    // determinant mirrors it, reverses its winding and sends it to the
    // back-face cull. That is how an entire swarm can be computed correctly
    // and still never reach a fragment. Not worth risking twice.
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uAlive: alive, uScale },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aU;
      attribute vec3 aJit;
      attribute float aRoll;
      varying float vU;
      varying float vBri;
      varying float vFade;
      ${COMMON}

      void main() {
        float u = aU;
        vec4 mv = viewMatrix * vec4(at(aSeed, uTime, u, aRoll), 1.0);
        float depth = -mv.z;

        // The grains scatter more the further back they are — about eightfold
        // from head to tail. Kept in the view plane so the spread is always
        // seen, never edge on.
        mv.xy += aJit.xy * ((0.13 + u * 1.00) * uScale);

        // Grains are small, and a small quad far away is nothing at all. Held
        // to a floor in projected size so the far half of the swarm stays a
        // swarm instead of dissolving into the sky.
        float g = (0.40 - 0.15 * u) * uScale * clamp(depth / 170.0, 1.0, 3.2);
        mv.xy += (uv - 0.5) * g;

        vU = u;
        vBri = aJit.z;
        vFade = smoothstep(55.0, 165.0, depth) * (1.0 - smoothstep(900.0, 2200.0, depth));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vU;
      varying float vBri;
      varying float vFade;

      // Incandescent at the head, then cyan, green, blue, violet down the tail.
      vec3 ramp(float u) {
        vec3 white  = vec3(1.00, 0.96, 0.86);
        vec3 cyan   = vec3(0.30, 0.96, 1.00);
        vec3 green  = vec3(0.32, 1.00, 0.50);
        vec3 blue   = vec3(0.24, 0.42, 1.00);
        vec3 violet = vec3(0.60, 0.26, 0.98);
        if (u < 0.06) return mix(white, cyan,  u / 0.06);
        if (u < 0.34) return mix(cyan,  green, (u - 0.06) / 0.28);
        if (u < 0.65) return mix(green, blue,  (u - 0.34) / 0.31);
        return mix(blue, violet, (u - 0.65) / 0.35);
      }

      void main() {
        // A cube, not a sphere. The quad is left hard-edged on purpose: the
        // moment these get a soft falloff the trail stops looking like a row
        // of separate lights and starts looking like a smear.
        float a = (1.0 - smoothstep(0.82, 1.0, vU)) * vFade;

        // 1.0, not 22 — and not 1.9 either, because the page puts a bloom
        // pass after this that Blender's render did not. Above the bloom
        // threshold every grain smears to white and the ramp is wasted; this
        // is the same failure as the Blender one arriving by a different road.
        gl_FragColor = vec4(ramp(vU) * 1.3 * vBri, a);
        if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }
    `,
  })

  // ---- the head ------------------------------------------------------------
  // One per fly. In Blender the bloom around it is a volume, because a surface
  // always shows its edge; here that is a soft radial falloff with nothing
  // hard anywhere in it, which is the same trick by another route.
  const headSeeds = new Float32Array(count * 4)
  const headRolls = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    headSeeds[i * 4 + 0] = fly[i].x
    headSeeds[i * 4 + 1] = fly[i].y
    headSeeds[i * 4 + 2] = fly[i].z
    headSeeds[i * 4 + 3] = fly[i].sp
    // The wriggle is non-zero even at u = 0, so the head has to be evaluated
    // with the same roll as its own grains or the glow sits a unit off the
    // front of the trail it is supposed to be leading.
    headRolls[i] = fly[i].roll
  }
  const headGeo = new THREE.InstancedBufferGeometry()
  headGeo.index = quad.index
  headGeo.attributes.position = quad.attributes.position
  headGeo.attributes.uv = quad.attributes.uv
  headGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(headSeeds, 4))
  headGeo.setAttribute('aRoll', new THREE.InstancedBufferAttribute(headRolls, 1))
  headGeo.instanceCount = count

  const headMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uAlive: alive, uScale },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aRoll;
      varying vec2 vUv;
      varying float vFade;
      ${COMMON}

      void main() {
        vec4 vHead = viewMatrix * vec4(at(aSeed, uTime, 0.0, aRoll), 1.0);
        float depth = -vHead.z;
        float g = 1.5 * uScale * clamp(depth / 170.0, 1.0, 3.0);
        vec4 mv = vHead + vec4((uv - 0.5) * g, 0.0, 0.0);
        vUv = uv;
        vFade = smoothstep(55.0, 165.0, depth) * (1.0 - smoothstep(900.0, 2200.0, depth));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        // core plus haze: two falloffs, neither of which ever reaches an edge
        float core = exp(-pow(r / 0.17, 2.0));
        float haze = exp(-pow(r / 0.42, 2.0)) * 0.34;
        float a = clamp(core + haze, 0.0, 1.0) * vFade;
        // 28 against the grains' 1.9 — the head is the only part allowed to
        // burn out, and it is what makes the rest read as colour rather than
        // as light.
        vec3 col = mix(vec3(0.55, 0.92, 1.00), vec3(1.0, 0.98, 0.92), core);
        gl_FragColor = vec4(col * (0.8 + core * 7.0), a);
        if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }
    `,
  })

  const mesh = new THREE.Group()
  const grainMesh = new THREE.Mesh(geo, material)
  const headMesh = new THREE.Mesh(headGeo, headMat)
  for (const m of [grainMesh, headMesh]) {
    m.frustumCulled = false
    m.renderOrder = 4
    mesh.add(m)
  }

  return {
    mesh,
    material,
    geo,
    dispose() {
      geo.dispose()
      material.dispose()
      headGeo.dispose()
      headMat.dispose()
      quad.dispose()
    },
  }
}

// ------------------------------------------------------------- inside the ball
/**
 * Cut the pitch out of the city.
 *
 * The exporter merges by material, so the whole city arrives as nine meshes —
 * every window in Zanarkand and the blitzball scoreboard are one buffer with
 * one bounding box. Classifying by that box put the entire city's glass into
 * the pitch, which is how "make the goals visible" turned every window on the
 * skyline into a scoreboard.
 *
 * So the split is done per triangle: anything whose centroid lands inside the
 * ball of water becomes its own mesh, marked, and is taken out of the index of
 * the mesh it came from. Both halves keep sharing one set of attributes — only
 * the index differs — so this costs three extra draw calls and no memory.
 */
function splitPitch(city: THREE.Object3D, pool: THREE.Sphere) {
  const NAMES = new Set(['TowerGlass', 'TowerTrim', 'TowerMetal'])
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const targets: THREE.Mesh[] = []
  city.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && NAMES.has((mesh.material as THREE.Material)?.name ?? '')) targets.push(mesh)
  })

  for (const mesh of targets) {
    const geo = mesh.geometry
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const idx = geo.getIndex()
    const tris = idx ? idx.count / 3 : pos.count / 3
    const at = (i: number) => (idx ? idx.getX(i) : i)

    const inside: number[] = []
    const outside: number[] = []
    const r2 = (pool.radius * 0.99) ** 2
    for (let t = 0; t < tris; t++) {
      const i0 = at(t * 3), i1 = at(t * 3 + 1), i2 = at(t * 3 + 2)
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld)
      a.add(b).add(c).multiplyScalar(1 / 3)
      ;(a.distanceToSquared(pool.center) < r2 ? inside : outside).push(i0, i1, i2)
    }
    if (!inside.length || !outside.length) continue

    const cut = new THREE.BufferGeometry()
    for (const key of Object.keys(geo.attributes)) cut.setAttribute(key, geo.attributes[key])
    cut.setIndex(inside)
    const lit = new THREE.Mesh(cut, mesh.material)
    lit.userData.pitch = (mesh.material as THREE.Material).name
    lit.position.copy(mesh.position)
    lit.quaternion.copy(mesh.quaternion)
    lit.scale.copy(mesh.scale)
    mesh.parent?.add(lit)

    geo.setIndex(outside)
  }
}

// --------------------------------------------------------------- city lights
/**
 * The windows.
 *
 * A night city is not dark buildings under a dark sky — it is a field of lit
 * windows with buildings implied behind them. The model has the buildings and
 * a thin neon trim, which at night read as an unlit sculpture; what was
 * missing is the thousands of small bright points that make a skyline a place
 * where people are awake.
 *
 * Rather than author them, they are read off the city itself: every nth vertex
 * of the stone and cladding meshes, taken in world space, becomes one lit
 * window. That guarantees they sit on the actual buildings, follow the actual
 * silhouette, and cost one draw call for the lot.
 *
 * Zanarkand is a blue city with warm rooms in it, so the mix is weighted to
 * cyan-white with about a third going amber, and each one has its own slow
 * pulse so the skyline is never quite still.
 */
function createWindows(city: THREE.Object3D, shared: Restore, night: { value: number }) {
  const pts: number[] = []
  const tmp = new THREE.Vector3()
  // Buildings only, by the names the generator gave them — and this has to run
  // before the model is dressed, because dressing throws those names away.
  // Sampling everything put a lit window on every vertex of the blitzball
  // sphere, which turned the hero of the shot into a disco ball.
  // ArenaFar is the silhouette ring on the horizon. Lighting it is what turns
  // a stadium standing in a valley into a stadium standing in a city — the
  // skyline behind is most of the reason the shot reads as Zanarkand at all.
  const LIT = new Set(['TowerStone', 'TowerTrim', 'TowerMetal', 'ArenaDeck', 'ArenaFar'])
  city.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const name = (mesh.material as THREE.Material)?.name ?? ''
    if (!LIT.has(name)) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    // Every vertex would be a quarter of a million lights; a few thousand is
    // a skyline.
    const step = Math.max(1, Math.round(pos.count / (name === 'ArenaFar' ? 2400 : 1500)))
    for (let i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld)
      // Nothing below the waterline, nothing in the sky, and a third thrown
      // away so the spacing does not inherit the mesh's own regularity.
      if (tmp.y < 6 || tmp.y > 460) continue
      if (Math.random() < 0.34) continue
      pts.push(tmp.x, tmp.y, tmp.z)
    }
    void name
  })

  const n = pts.length / 3
  const seeds = new Float32Array(n * 3)
  const kinds = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    seeds[i * 3 + 0] = Math.random() * 100
    seeds[i * 3 + 1] = 0.55 + Math.random() * 0.9   // brightness
    seeds[i * 3 + 2] = 0.34 + Math.random() * 0.78  // size
    kinds[i] = Math.random() < 0.34 ? 1 : 0         // warm or cool
  }

  const quad = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.attributes.position = quad.attributes.position
  geo.attributes.uv = quad.attributes.uv
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(pts), 3))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3))
  geo.setAttribute('aWarm', new THREE.InstancedBufferAttribute(kinds, 1))
  geo.instanceCount = n

  const uniforms = {
    uFront: shared.uFront,
    uNight: night,
    uTime: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute vec3 aSeed;
      attribute float aWarm;
      uniform float uFront;
      uniform float uTime;
      varying vec2 vUv;
      varying float vBri;
      varying float vWarm;
      void main() {
        // the same front that brings the city in brings its lights on
        if (aPos.y > uFront) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        vec4 mv = viewMatrix * vec4(aPos, 1.0);
        float depth = -mv.z;
        // A window is a fixed size on the building, but below about a pixel
        // it stops being a light at all, so it is held to a floor.
        float g = aSeed.z * (0.9 + depth * 0.0022);
        mv.xy += (uv - 0.5) * g;
        vUv = uv;
        vBri = aSeed.y * (0.72 + 0.28 * sin(uTime * (0.35 + aSeed.x * 0.02) + aSeed.x));
        vWarm = aWarm;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying vec2 vUv;
      varying float vBri;
      varying float vWarm;
      void main() {
        vec2 d = abs(vUv - 0.5);
        // A window is a rectangle. Round ones read as bokeh, which is a
        // photograph of a city rather than a city.
        float a = (1.0 - smoothstep(0.30, 0.50, max(d.x, d.y * 1.5)));
        vec3 cool = vec3(0.62, 0.86, 1.00);
        vec3 warm = vec3(1.00, 0.74, 0.40);
        vec3 col = mix(cool, warm, vWarm);
        // They come up as the sky goes down.
        float lit = 0.22 + 0.78 * uNight;
        gl_FragColor = vec4(col * vBri * 0.95 * lit, a * (0.25 + 0.75 * uNight));
        if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }
    `,
  })

  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 3
  return {
    mesh,
    count: n,
    uniforms,
    dispose() {
      geo.dispose()
      material.dispose()
      quad.dispose()
    },
  }
}

// ------------------------------------------------------------------- the rig
export function createCityScene(
  canvas: HTMLCanvasElement,
  opts: { tier: Tier; onProgress?: (v: number) => void } = { tier: 'high' },
): CityScene {
  const { tier, onProgress } = opts

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier === 'high',
    powerPreference: 'high-performance',
    alpha: false,
  })
  renderer.setClearColor(0x1a0d08, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 9000)

  // Bloom.
  //
  // Everything that makes this world look like itself is emissive — window
  // courses, the light along the arena's arms, the sphere, the pyreflies —
  // and an emissive pixel with hard edges reads as a decal. Bleeding them into
  // what is around them is the difference between lights drawn on a building
  // and a building that is lit. It is the single highest-value pass here, so
  // the low tier gets a cheaper version of it rather than none.
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  // A high threshold: only genuinely bright pixels bloom. Lower, and every
  // lit window in the restored city smears into its neighbours and the whole
  // model turns into a lamp.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.5, 0.92)
  composer.addPass(bloom)

  const time = { value: 0 }
  const night = { value: 0 }
  const shared: Restore = { uFront: { value: RESTORE_FRONT[0] }, uSeam: { value: 26 } }

  const sunDir = new THREE.Vector3(...SUN_DIR).normalize()

  // ---- sky, fog, light ---------------------------------------------------
  const sky = createSky(sunDir)
  scene.add(sky.mesh)

  // Light haze, not weather. At the density the first pass used, the plain
  // between the camera and the city washed out to flat orange and read as
  // water — the ground disappeared into the sunset behind it.
  const fogColor = new THREE.Color(0x8a3a12)
  scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.00016)

  const sun = new THREE.DirectionalLight(0xffb066, 3.4)
  sun.position.copy(sunDir).multiplyScalar(2000)
  scene.add(sun)

  // A second, much weaker light from behind the camera. The sun is almost
  // edge-on to everything, so without this the near faces of the ruin are
  // pure black and the silhouettes lose their shape entirely.
  const fill = new THREE.DirectionalLight(0x2a3a55, 0.5)
  fill.position.set(400, 300, 400)
  scene.add(fill)

  const ambient = new THREE.HemisphereLight(0xff8a45, 0x140a08, 0.55)
  scene.add(ambient)

  // ---- materials ----------------------------------------------------------
  // Every one of these takes its variation from the wear colours baked into
  // the model, which is why they can all be flat-shaded single colours and
  // still not look like painted cardboard.
  const rock = new THREE.MeshStandardMaterial({
    color: 0x6b5b4a, roughness: 0.97, metalness: 0.0, flatShading: true, vertexColors: true,
    // The heightfield is a single open surface and its faces are wound for
    // Blender, which draws both sides. Seen from the front here, half of it
    // was simply missing — the basin floor was culled and the sky showed
    // through where the ground should be.
    side: THREE.DoubleSide,
  })
  const stone = new THREE.MeshStandardMaterial({
    color: 0x7c7367, roughness: 0.92, metalness: 0.0, flatShading: true, vertexColors: true,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: 0x33302c, roughness: 0.96, metalness: 0.0, flatShading: true, vertexColors: true,
  })
  const metal = new THREE.MeshStandardMaterial({
    color: 0x4a4d55, roughness: 0.34, metalness: 0.92, flatShading: true, vertexColors: true,
  })
  const glow = new THREE.MeshBasicMaterial({ color: 0x4fd8d0, toneMapped: false, vertexColors: true })

  // the restored city: dark blue-green metal, almost black in the mass
  const clad = new THREE.MeshStandardMaterial({
    color: 0x16302e, roughness: 0.42, metalness: 0.46, flatShading: true, vertexColors: true,
  })
  applyRestore(clad, shared, new THREE.Color(0x2ba7c4))

  const neon = new THREE.MeshBasicMaterial({
    color: 0xffffff, toneMapped: false, vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  applyRestore(neon, shared, new THREE.Color(0x123c46))

  const water = new THREE.MeshPhysicalMaterial({
    color: 0xcfeaf8, roughness: 0.13, metalness: 0.0,
    transmission: tier === 'high' ? 0.70 : 0.0,
    opacity: tier === 'high' ? 1.0 : 0.55, transparent: tier !== 'high',
    // A short attenuation distance against a large sphere. Seventy feet of
    // water does not show you what is on the far side of it: from outside, the
    // goals should be a shape you half-see and then lose, and it is only when
    // the camera goes *inside* that the pitch is legible.
    // Clear, not milky.
    //
    // Thirteen units of attenuation across a seventy-unit sphere is a ball of
    // paint: the goals and the board were inside it the whole time and not one
    // pixel of them reached the glass. The point of building a stadium is that
    // it can be seen into, so the water now reads as water — a tint and a
    // refraction — rather than as a filter.
    thickness: 12, attenuationColor: new THREE.Color(0x5fb6e0), attenuationDistance: 52,
    ior: 1.333, emissive: new THREE.Color(0x3990c8), emissiveIntensity: 0.62,
    clearcoat: 0.5, clearcoatRoughness: 0.10,
    // FrontSide, so that standing inside the sphere — which the camera does
    // for one chapter — the near wall is culled and the pitch inside is
    // visible. With DoubleSide the shot is a blue wall two metres from the
    // lens and nothing else.
    side: THREE.FrontSide,
  })
  applyRestore(water, shared, new THREE.Color(0x59c8ff))
  // The older model's pool, once scaled and lifted into the basin.
  applyWaves(water, time, new THREE.Vector3(0, 25 * CITY_SCALE + CITY_LIFT, 0),
             21 * CITY_SCALE)

  const falls = new THREE.MeshStandardMaterial({
    color: 0x9fd8e4, roughness: 0.18, metalness: 0.0, transparent: true, opacity: 0.72,
    emissive: new THREE.Color(0x1d5f70), emissiveIntensity: 0.5, side: THREE.DoubleSide,
  })
  applyRestore(falls, shared, new THREE.Color(0x7fe2ff))

  const sea = createWaterMaterial(time, night, sunDir)
  const far = new THREE.MeshBasicMaterial({ color: 0x1a1017, fog: true })
  // The far ring is city, not ruin. Without this it stood on the horizon of
  // the opening shot, a skyline of intact towers behind a dead one.
  applyRestore(far, shared, new THREE.Color(0x2ba7c4))

  // What the ruin is made of. Its own restored layers — Clad, Neon, Pool,
  // Falls — are deliberately absent from this table: the city that replaces it
  // is the other model, and drawing both would put two Zanarkands on the same
  // ground.
  // Only the ground survives the transformation. Every ruined building is
  // taken away by the same front that brings the city in.
  for (const m of [stone, dark, metal, glow]) applyDissolve(m, shared)

  const RUIN_MATS: Record<string, THREE.Material> = {
    Rock: rock,
    Stone: stone,
    StoneDark: dark,
    Metal: metal,
    Glow: glow,
    Sea: sea,
  }

  // The restored city. Everything in it is clipped by the front, so the whole
  // model rises out of the ruin as one.
  const cityStone = new THREE.MeshStandardMaterial({
    color: 0x2e3a3c, roughness: 0.7, metalness: 0.12, flatShading: true,
    // A lit city spills onto its own walls. Without this the stone stayed the
    // same value at midnight as at dusk and the towers read as cut paper.
    emissive: new THREE.Color(0x12303f), emissiveIntensity: 0.55,
  })
  const cityDark = new THREE.MeshStandardMaterial({
    color: 0x141a1e, roughness: 0.85, metalness: 0.06, flatShading: true,
  })
  for (const m of [cityStone, cityDark]) applyRestore(m, shared, new THREE.Color(0x2ba7c4))

  // The older model carries no wear colours, so it needs its own copies of
  // anything that reads them. A material with `vertexColors` on and no COLOR_0
  // attribute to read multiplies everything by black, which is exactly what
  // the first attempt did: a city that loaded, drew, and was invisible.
  const cityClad = new THREE.MeshStandardMaterial({
    color: 0x1b3a3c, roughness: 0.44, metalness: 0.42, flatShading: true,
    emissive: new THREE.Color(0x134050), emissiveIntensity: 0.65,
  })
  const cityMetal = new THREE.MeshStandardMaterial({
    color: 0x4a4d55, roughness: 0.34, metalness: 0.9, flatShading: true,
  })
  // The city's own light.
  //
  // This model's lit surface is *small* — individual window panes set into
  // reveals, not the broad glowing bands the older one had — so at half
  // opacity the whole city read as unlit stone. Additive on tiny quads needs
  // to be near full strength before any of it reaches the eye.
  const cityNeon = new THREE.MeshBasicMaterial({
    color: 0xcfeaff, toneMapped: false, transparent: true, opacity: 1.0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const cityGlow = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })
  for (const m of [cityClad, cityMetal]) {
    applyRestore(m, shared, new THREE.Color(0x2ba7c4))
  }
  // 45% of the lit surface goes warm — enough that the city reads as lamplit
  // rather than as a circuit board, and not so much that it stops being
  // Zanarkand, which is a blue city with warm rooms in it.
  applyRestore(cityNeon, shared, new THREE.Color(0x2ba7c4), 0.45)
  applyRestore(cityGlow, shared, new THREE.Color(0x2ba7c4), 0.6)

  // Inside the sphere.
  //
  // The goals, the net and the scoreboard are drawn with the same materials as
  // the rest of the city, which meant two things went wrong at once: the board
  // was additive, so it never entered the transmission buffer and could not be
  // seen through the water at all, and the frames were unlit stone at the far
  // end of a night. They get their own lit, *opaque* materials so they land in
  // the buffer the water samples and read as a floodlit pitch.
  const pitchFrame = new THREE.MeshStandardMaterial({
    color: 0xe8f4ff, roughness: 0.3, metalness: 0.4,
    emissive: new THREE.Color(0x8ad6f8), emissiveIntensity: 2.4, flatShading: true,
  })
  const pitchNet = new THREE.MeshStandardMaterial({
    color: 0xbfe4f5, roughness: 0.5, metalness: 0.1,
    emissive: new THREE.Color(0x59b6dc), emissiveIntensity: 1.5, flatShading: true,
  })
  const pitchBoard = new THREE.MeshStandardMaterial({
    color: 0xfff2d8, roughness: 0.35, metalness: 0.0,
    emissive: new THREE.Color(0xffc470), emissiveIntensity: 2.1, flatShading: true,
  })
  for (const m of [pitchFrame, pitchNet, pitchBoard]) {
    applyRestore(m, shared, new THREE.Color(0x59c8ff))
  }

  // The names come from the generator: ztower's parts are Tower*, and the
  // things zarena adds for itself are Arena*.
  const CITY_MATS: Record<string, THREE.Material> = {
    TowerStone: cityStone,
    TowerTrim: cityClad,
    TowerGlass: cityNeon,
    TowerMetal: cityMetal,
    ArenaWater: water,
    ArenaNeon: cityNeon,
    ArenaFar: far,
    ArenaSea: cityDark,
    ArenaDeck: cityDark,
  }

  // ---- pyreflies -----------------------------------------------------------
  const pyre = { value: 0 }
  const flies = createPyreflies(tier === 'high' ? 130 : 50, time, pyre)
  scene.add(flies.mesh)

  // ---- the model -----------------------------------------------------------
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath(DRACO_PATH)
  loader.setDRACOLoader(draco)

  const disposables: Array<{ dispose(): void }> = []
  const roots: THREE.Object3D[] = []
  let city: THREE.Object3D | null = null
  let windows: ReturnType<typeof createWindows> | null = null

  const dress = (root: THREE.Object3D, table: Record<string, THREE.Material>) => {
    const drop: THREE.Mesh[] = []
    root.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const original = mesh.material as THREE.Material
      const name = original?.name ?? ''
      // splitPitch has already cut the pitch out of the city meshes and marked
      // it; all that is left here is to hand it the lit materials.
      const inside = mesh.userData.pitch as string | undefined
      let replacement = inside
        ? (inside === 'TowerGlass' ? pitchBoard : inside === 'TowerTrim' ? pitchNet : pitchFrame)
        : table[name]
      if (!replacement) {
        // a layer this model is not responsible for — remove it outright
        drop.push(mesh)
        return
      }
      mesh.material = replacement
      if (original && !Object.values(table).includes(original)) original.dispose()
      // both models ship without normals; the smooth surfaces need them back
      if (replacement === water || replacement === falls || replacement === sea) {
        mesh.geometry.computeVertexNormals()
      }
      if (replacement === neon || replacement === cityNeon) mesh.renderOrder = 2
      if (replacement === water || replacement === falls) mesh.renderOrder = 3
      mesh.frustumCulled = true
      disposables.push(mesh.geometry)
    })
    for (const mesh of drop) {
      mesh.geometry.dispose()
      mesh.removeFromParent()
    }
  }

  const load = (url: string, onEach?: (n: number) => void) =>
    new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(
        url,
        gltf => resolve(gltf.scene),
        evt => {
          if (onEach && evt.total > 0) onEach(Math.min(1, evt.loaded / evt.total))
        },
        err => reject(err),
      )
    })

  // Both are fetched at once. The city is not needed until the reader has
  // scrolled, but it is the same request the browser would make later anyway
  // and asking for it up front means the restoration never stutters.
  const progressOf = [0, 0]
  const bumpProgress = () => onProgress?.((progressOf[0] * 0.6 + progressOf[1] * 0.4))

  const ready = Promise.all([
    load(RUIN_URL, v => {
      progressOf[0] = v
      bumpProgress()
    }),
    load(CITY_URL, v => {
      progressOf[1] = v
      bumpProgress()
    }),
  ]).then(([ruinRoot, cityRoot]) => {
    dress(ruinRoot, RUIN_MATS)
    cityRoot.scale.setScalar(CITY_SCALE)
    cityRoot.position.y = CITY_LIFT
    cityRoot.updateMatrixWorld(true)
    windows = createWindows(cityRoot, shared, night)

    // Where the ball of water actually is, measured off the model rather than
    // guessed — the guessed radius in the wave shader was less than half of it.
    let pool: THREE.Sphere | undefined
    cityRoot.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      if ((mesh.material as THREE.Material)?.name !== 'ArenaWater') return
      mesh.geometry.computeBoundingSphere()
      const bs = mesh.geometry.boundingSphere
      if (!bs) return
      pool = new THREE.Sphere(bs.center.clone().applyMatrix4(mesh.matrixWorld),
                              bs.radius * CITY_SCALE)
    })
    if (pool) splitPitch(cityRoot, pool)
    dress(cityRoot, CITY_MATS)
    scene.add(ruinRoot, cityRoot)
    roots.push(ruinRoot, cityRoot)
    // The whole city is switched off until the restoration actually starts.
    // Clipping alone was not enough: the far silhouette ring had never been
    // given the front at all, and the sphere's own transmission pass put the
    // blitzball goals on screen in the opening shot — in a ruin that is not
    // supposed to have a stadium in it.
    city = cityRoot
    cityRoot.visible = false
    scene.add(windows.mesh)
  })

  // ---- camera: one orbit ---------------------------------------------------
  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()
  const wantPos = new THREE.Vector3()
  const wantTarget = new THREE.Vector3()
  let seeded = false

  /**
   * Where the camera is at a given scroll position.
   *
   * A circle, eased. The angle is linear in the scroll — anything else makes
   * the turn feel like it is being steered — while the radius and the height
   * ease, so the approach happens in the middle of the move rather than all at
   * the start.
   */
  const orbitAt = (p: number, pos: THREE.Vector3, target: THREE.Vector3) => {
    // The scroll snaps to chapter *centres*, so the page comes to rest at
    // 0.1, 0.3, 0.5, 0.7 and 0.9 and never at 0 or 1. Running the orbit over
    // the raw 0..1 meant the two frames that were actually composed — the
    // opening shot on the rim and the closing shot on the sphere — were the
    // only two the reader never saw at rest; the last chapter stopped a tenth
    // of a turn short, with the sphere off to one side. Mapped onto the
    // resting range, chapter 00 *is* the opening frame and chapter 04 *is*
    // the sphere, centred.
    // Derived, not written down: the chapters rest at (i + 0.5) / n, so the
    // first is half a chapter in and the last half a chapter short of the end.
    const half = 0.5 / SECTIONS.length
    const t = clamp01((clamp01(p) - half) / (1 - 2 * half))
    const e = smoothstep(0, 1, t)
    const a = ORBIT.startAngle + Math.PI * 2 * ORBIT.turns * t
    const r = lerp(ORBIT.radius[0], ORBIT.radius[1], e)
    const h = lerp(ORBIT.height[0], ORBIT.height[1], e)
    // three.js: the model's +X is +X and its +Y is -Z
    // A narrow window does not crop the top and bottom off this shot — the
    // vertical field is fixed — it crops the *sides*, and the stadium is wider
    // than it is tall. On a 3:2 laptop the stands ran off both edges and only
    // the sphere was left. Backing off by the shortfall keeps the whole bowl
    // in frame whatever shape the window is.
    const wide = clamp01((16 / 9 - camera.aspect) / (16 / 9 - 1.2))
    pos.set(Math.cos(a) * r * (1 + 0.30 * wide), h, -Math.sin(a) * r * (1 + 0.30 * wide))
    // The aim swings onto the arena much earlier than the camera arrives.
    // Easing both on the same curve meant that for most of the turn the shot
    // was pointed seventy units off the axis, at a spot left over from the
    // opening frame — so the building sat in a corner and the middle of the
    // screen was empty sky.
    const te = smoothstep(0, 0.26, t)
    const [t0, t1] = ORBIT.target
    target.set(lerp(t0[0], t1[0], te), lerp(t0[1], t1[1], te), lerp(t0[2], t1[2], te))
  }

  let progress = 0
  const setProgress = (p: number) => {
    progress = clamp01(p)
  }

  // ---- render --------------------------------------------------------------
  let width = 1
  let height = 1

  const resize = (w: number, h: number, dpr: number) => {
    width = Math.max(1, w)
    height = Math.max(1, h)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    composer.setPixelRatio(tier === 'high' ? dpr : Math.min(dpr, 1))
    composer.setSize(width, height)
    bloom.resolution.set(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    // Capped low. This scales the pyreflies with the window so they keep the
    // same apparent size, but on a tall display the old 1.6 ceiling made them
    // nearly twice the size they were tuned at — the motes came back as the
    // big bright worms they were supposed to have stopped being.
    flies.material.uniforms.uScale.value = Math.max(0.75, Math.min(1.1, height / 900))
  }

  const render = (dt: number) => {
    const step = Math.min(dt, 0.05)
    time.value += step

    // ---- where the camera is
    orbitAt(progress, wantPos, wantTarget)

    if (!seeded) {
      camPos.copy(wantPos)
      camTarget.copy(wantTarget)
      seeded = true
    } else {
      // Critically-damped-ish follow. The scroller can jump — a snap, a key,
      // a click on the index — and a camera that teleports with it reads as a
      // cut rather than as a move.
      // Deliberately NOT the clamped step. The clamp exists so a tab that has
      // been backgrounded does not teleport the world on its first frame back,
      // but feeding it to the camera means that on a slow frame the follow
      // falls behind real time and the shot never actually arrives — the
      // composed frame is only ever approached, never reached.
      const k = 1 - Math.exp(-Math.min(dt, 0.5) * 9.0)
      camPos.lerp(wantPos, k)
      camTarget.lerp(wantTarget, k)
    }

    camera.position.copy(camPos)
    camera.lookAt(camTarget)
    sky.mesh.position.copy(camPos)
    sky.mesh.scale.setScalar(6000)

    // ---- the state of the world
    const restore = smoothstep(RESTORE_RANGE[0], RESTORE_RANGE[1], progress)
    shared.uFront.value = lerp(RESTORE_FRONT[0], RESTORE_FRONT[1], restore)
    // the seam is widest mid-rebuild and gone by the end
    shared.uSeam.value = 6 + 40 * Math.sin(restore * Math.PI) ** 0.8

    // Nothing of the city exists until the front starts moving.
    if (city) city.visible = restore > 0.0004
    if (windows) {
      windows.mesh.visible = restore > 0.0004
      windows.uniforms.uTime.value = time.value
    }

    pyre.value = smoothstep(PYRE_RANGE[0], PYRE_RANGE[1], progress)
    const n = smoothstep(NIGHT_RANGE[0], NIGHT_RANGE[1], progress)
    night.value = n
    sky.uniforms.uNight.value = n
    sky.uniforms.uTime.value = time.value

    // A night city lights itself. The moon is a rim light and nothing more —
    // what makes the buildings readable is the bounce off the city's own
    // windows, which is why the fill and the ambient climb so much harder
    // than the key does. The version before this had a correct night and an
    // unreadable one: a black sculpture against a black sky.
    sun.intensity = lerp(3.4, 2.6, n)
    sun.color.lerpColors(PALETTE.sunWarm, PALETTE.moonCool, n)
    ambient.intensity = lerp(0.55, 2.6, n)
    ambient.color.lerpColors(PALETTE.ambientDusk, PALETTE.ambientNight, n)
    fill.intensity = lerp(0.5, 6.2, n)

    const fog = scene.fog as THREE.FogExp2
    fog.color.lerpColors(PALETTE.fogDusk, PALETTE.fogNight, n)
    fog.density = lerp(0.00016, 0.00024, n)
    ;(sea.uniforms.uFog.value as THREE.Color).copy(fog.color)
    sea.uniforms.uFogDensity.value = fog.density

    // the city has far more of its own light than the ruin does, so the bloom
    // comes up with it rather than sitting at one strength throughout
    bloom.strength = lerp(0.62, 1.30, n)

    composer.render()
  }

  const dispose = () => {
    for (const d of disposables) d.dispose()
    for (const m of [...Object.values(RUIN_MATS), ...Object.values(CITY_MATS)]) m.dispose()
    for (const r of roots) r.removeFromParent()
    sky.material.dispose()
    sky.mesh.geometry.dispose()
    flies.dispose()
    windows?.dispose()
    for (const m of [pitchFrame, pitchNet, pitchBoard]) m.dispose()
    draco.dispose()
    composer.dispose()
    renderer.dispose()
  }

  return { ready, render, resize, setProgress, dispose }
}
