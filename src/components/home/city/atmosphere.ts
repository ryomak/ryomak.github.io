import * as THREE from 'three'

type Uniform = { value: number }

/** Soft banks of sea mist, with depth testing against the actual architecture. */
export function createAtmosphere(
  time: Uniform,
  night: Uniform,
  front: Uniform,
) {
  const group = new THREE.Group()
  const quad = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = quad.index
  geometry.attributes.position = quad.attributes.position
  geometry.attributes.uv = quad.attributes.uv
  const seeds = new Float32Array(32 * 4)
  for (let i = 0; i < 32; i++) {
    const a = i * 2.399963
    const r = 140 + ((i * 137) % 660)
    seeds.set([Math.cos(a) * r, 8 + (i % 5) * 6, Math.sin(a) * r, i], i * 4)
  }
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
  geometry.instanceCount = 32
  const mist = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: time, uNight: night },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying float vDepth;
      void main() {
        vec3 p = aSeed.xyz;
        p.x += sin(uTime * 0.035 + aSeed.w) * 24.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        mv.xy += position.xy * vec2(180.0 + mod(aSeed.w, 4.0) * 35.0, 28.0);
        vUv = uv;
        vSeed = aSeed.w;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec2 vUv;
      varying float vSeed;
      varying float vDepth;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float shape = exp(-dot(p * vec2(1.5, 2.0), p * vec2(1.5, 2.0)));
        shape *= 1.0 - smoothstep(0.65, 1.0, max(abs(p.x), abs(p.y)));
        float wisp = 0.65 + 0.35 * sin(p.x * 9.0 + sin(p.y * 5.0 + vSeed) + uTime * 0.12);
        float fade = smoothstep(80.0, 230.0, vDepth);
        vec3 color = mix(vec3(0.30, 0.16, 0.10), vec3(0.10, 0.25, 0.32), uNight);
        gl_FragColor = vec4(color, shape * wisp * fade * 0.13);
        #include <colorspace_fragment>
      }
    `,
  })
  const banks = new THREE.Mesh(geometry, mist)
  banks.frustumCulled = false
  group.add(banks)

  // GPU particles converge on the rising restoration front around the arena.
  const count = 1200
  const points = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions.set([i / count, (i * 0.618034) % 1, (i * 0.414214) % 1], i * 3)
  }
  points.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const energy = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uFront: front, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFront;
      uniform float uPixelRatio;
      varying float vFade;
      varying float vHue;
      void main() {
        float angle = position.x * 62.83185 + uTime * 0.13;
        float r = 92.0 + position.y * 150.0;
        float rise = fract(position.z + uTime * 0.06);
        vec3 p = vec3(cos(angle) * r, uFront - 12.0 + rise * 80.0, sin(angle) * r);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vFade = sin(rise * 3.14159) * smoothstep(-30.0, 20.0, uFront)
          * (1.0 - smoothstep(240.0, 430.0, uFront));
        vHue = position.y;
        gl_PointSize = clamp(650.0 / max(1.0, -mv.z), 1.0, 3.0) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFade;
      varying float vHue;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.1, 1.0, r)) * vFade;
        if (alpha < 0.01) discard;
        vec3 color = mix(vec3(0.12, 0.85, 1.5), vec3(0.65, 1.3, 0.65), vHue);
        gl_FragColor = vec4(color, alpha * 0.65);
        #include <colorspace_fragment>
      }
    `,
  })
  const sparks = new THREE.Points(points, energy)
  sparks.frustumCulled = false
  group.add(sparks)
  return {
    group,
    resize(dpr: number) {
      energy.uniforms.uPixelRatio.value = Math.min(dpr, 1.8)
    },
    dispose() {
      geometry.dispose()
      quad.dispose()
      mist.dispose()
      points.dispose()
      energy.dispose()
      group.removeFromParent()
    },
  }
}
