import * as THREE from 'three'

// Preserve the original multicoloured, granular trails and swimming motion.
function buildOriginalPyreflies(
  count: number,
  time: { value: number },
  alive: { value: number },
) {
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
      jit[k * 3 + 0] = Math.random() * 2 - 1
      jit[k * 3 + 1] = Math.random() * 2 - 1
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
  const uPopulation = { value: 0.08 }

  // Shared by both passes: where a fly is, and where its tail used to be.
  const COMMON = /* glsl */ `
    uniform float uTime;
    uniform float uScale;
    uniform float uPopulation;

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
    uniforms: { uTime: time, uAlive: alive, uScale, uPopulation },
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
        // A stable threshold per fly fades its head and every tail grain together.
        float arrival = 0.04 + (aRoll / 6.2831853) * 0.92;
        vFade *= smoothstep(arrival - 0.035, arrival + 0.035, uPopulation);
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
  headGeo.setAttribute(
    'aSeed',
    new THREE.InstancedBufferAttribute(headSeeds, 4),
  )
  headGeo.setAttribute(
    'aRoll',
    new THREE.InstancedBufferAttribute(headRolls, 1),
  )
  headGeo.instanceCount = count

  const headMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uAlive: alive, uScale, uPopulation },
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
        // A stable threshold per fly fades its head and every tail grain together.
        float arrival = 0.04 + (aRoll / 6.2831853) * 0.92;
        vFade *= smoothstep(arrival - 0.035, arrival + 0.035, uPopulation);
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

export function createPyreflies(high: boolean) {
  const flies = buildOriginalPyreflies(
    high ? 130 : 50,
    { value: 0 },
    { value: 1 },
  )
  // Time is shared with the head material by the original builder.
  return {
    ...flies,
    setPopulation(value: number) {
      flies.material.uniforms.uPopulation.value = value
    },
    resize(height: number) {
      flies.material.uniforms.uScale.value = Math.max(
        0.75,
        Math.min(1.1, height / 900),
      )
    },
  }
}
