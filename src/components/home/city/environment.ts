import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

export const noiseGLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(.17,.31,.73));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
      mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
      mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p) {
    return noise(p)*.55 + noise(p*2.02)*.25 + noise(p*4.03)*.125 + noise(p*8.01)*.0625;
  }
`

export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec3 vDirection;
      ${noiseGLSL}
      void main() {
        vec3 d = normalize(vDirection);
        float h = max(0.0,d.y);
        vec3 dusk = mix(vec3(.54,.24,.11), vec3(.17,.105,.17), smoothstep(0.0,.32,h));
        dusk = mix(dusk,vec3(.035,.052,.10),smoothstep(.25,.8,h));
        vec3 night = mix(vec3(.035,.085,.13),vec3(.005,.012,.037),smoothstep(0.0,.65,h));
        vec3 c = mix(dusk,night,uNight);
        // A small low sun, to the left of the city. Its glow is wider than its disc.
        vec3 sun = normalize(vec3(-.45,.075,-1.0));
        float sd = max(0.0,dot(d,sun));
        c += vec3(.9,.36,.12) * pow(sd,36.0) * (1.0-uNight)*.55;
        c += vec3(1.8,.95,.42) * smoothstep(.99965,.99985,sd) * (1.0-uNight);
        vec3 moon = normalize(vec3(.50,.49,-1.0));
        float md = max(0.0,dot(d,moon));
        c += vec3(.10,.23,.38)*pow(md,60.0)*uNight;
        c += vec3(.75,.90,1.0)*smoothstep(.99978,.9999,md)*uNight;
        // Stratified cloud cover gives scale without a photographic skybox.
        float f = fbm(vec3(d.x*3.0,d.y*12.0,d.z*3.0)+vec3(uTime*.002,0,0));
        float cloud = smoothstep(.40,.68,f) * (1.0-smoothstep(.12,.65,h));
        c = mix(c,mix(vec3(.075,.057,.083),vec3(.015,.032,.06),uNight),cloud*.75);
        // Stars live in angular cells and have an antialiased radial profile.
        vec2 starUV = vec2(atan(d.z,d.x),asin(d.y)) * 310.0;
        vec2 cell = floor(starUV);
        float seed = hash(vec3(cell,17.0));
        vec2 delta = fract(starUV)-vec2(.2+.6*fract(seed*19.0),.2+.6*fract(seed*37.0));
        float stars = (1.0-smoothstep(.035,.15,length(delta))) * step(.975,seed);
        c += vec3(.55,.73,1.0)*stars*uNight*smoothstep(.04,.3,h)*(1.0-cloud);
        // A very faint, broad auroral veil, visible only in the restored sky.
        float ribbon = exp(-pow((h-.33-.055*sin(d.x*5.0+uTime*.016))/.075,2.0));
        c += vec3(.015,.09,.085)*ribbon*fbm(d*6.0)*uNight;
        gl_FragColor = vec4(c,1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4200, 32, 20), material)
  mesh.renderOrder = -10
  return { mesh, material }
}

export function createOcean(high: boolean) {
  const shader = {
    name: 'TidalReflection',
    uniforms: {
      tDiffuse: { value: null },
      color: { value: new THREE.Color(0x708a99) },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uReflection: { value: high ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vReflection;
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position,1.0)).xyz;
        vReflection = textureMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime, uNight, uReflection;
      varying vec4 vReflection;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float w1 = sin(p.x*.047+p.y*.021+uTime*.7);
        float w2 = sin(p.y*.076-p.x*.014-uTime*.49);
        float w3 = sin(p.x*.19+p.y*.16+uTime*.9);
        vec3 n = normalize(vec3(w1*.09+w3*.022,1.0,w2*.07+w3*.019));
        vec3 view = normalize(cameraPosition-vWorld);
        float fresnel = .08+.78*pow(1.0-max(0.0,dot(n,view)),3.0);
        vec3 deep = mix(vec3(.036,.031,.034),vec3(.007,.034,.047),uNight);
        vec3 sky = mix(vec3(.30,.15,.083),vec3(.035,.083,.13),uNight);
        vec3 c = mix(deep,sky,fresnel);
        if (uReflection>.5 && vReflection.w>0.0) {
          vec2 uv = vReflection.xy/vReflection.w + n.xz*.025;
          vec2 edge = smoothstep(vec2(0),vec2(.025),uv)*(1.0-smoothstep(vec2(.975),vec2(1),uv));
          vec3 reflected = texture2D(tDiffuse,clamp(uv,.001,.999)).rgb;
          c = mix(c,reflected*vec3(.72,.86,.91),(.22+fresnel*.65)*edge.x*edge.y);
        }
        vec3 sun = normalize(vec3(-.45,.075,-1.0));
        float spec = pow(max(0.0,dot(n,normalize(sun+view))),180.0);
        c += vec3(1.0,.46,.17)*spec*(1.0-uNight)*.7;
        float caustic = pow(max(0.0,w1*w2),9.0);
        c += vec3(.01,.09,.12)*caustic*uNight*exp(-length(p)*.006);
        float fog = 1.0-exp(-length(cameraPosition-vWorld)*.00030);
        c = mix(c,mix(vec3(.20,.11,.083),vec3(.022,.047,.075),uNight),fog);
        gl_FragColor = vec4(c,1.0);
        #include <colorspace_fragment>
      }
    `,
  }
  const geometry = new THREE.PlaneGeometry(8000, 8000)
  const mesh = high
    ? new Reflector(geometry, {
        textureWidth: 768,
        textureHeight: 512,
        multisample: 0,
        clipBias: 0.003,
        shader,
      })
    : new THREE.Mesh(geometry, new THREE.ShaderMaterial(shader))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.15
  const material = mesh.material as THREE.ShaderMaterial
  return {
    mesh,
    material,
    resize(w: number, h: number) {
      if (mesh instanceof Reflector) {
        const scale = Math.min(1, 768 / Math.max(w, h))
        mesh
          .getRenderTarget()
          .setSize(
            Math.max(1, Math.round(w * scale)),
            Math.max(1, Math.round(h * scale)),
          )
      }
    },
    dispose() {
      geometry.dispose()
      if (mesh instanceof Reflector) mesh.dispose()
      else material.dispose()
    },
  }
}

/** An optically deep water volume: rippled normals, Fresnel edge and internal caustics. */
export function createSphereMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uBuild: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld, vNormal, vLocal;
      void main() {
        vec3 p = position;
        float ripple = sin(p.x*.12+uTime*.65)*sin(p.y*.10-uTime*.5)*sin(p.z*.13+uTime*.3);
        p += normal*ripple*.65;
        vLocal = p;
        vWorld = (modelMatrix*vec4(p,1.0)).xyz;
        vNormal = normalize(mat3(modelMatrix)*normal);
        gl_Position = projectionMatrix*viewMatrix*vec4(vWorld,1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBuild;
      varying vec3 vWorld, vNormal, vLocal;
      ${noiseGLSL}
      void main() {
        vec3 view = normalize(cameraPosition-vWorld);
        vec3 n = normalize(vNormal + .065*vec3(
          sin(vLocal.y*.7+uTime),sin(vLocal.z*.63-uTime*.7),sin(vLocal.x*.8+uTime*.6)));
        float facing = max(0.0,dot(view,n));
        float fresnel = pow(1.0-facing,3.0);
        vec3 flow = vLocal*.055+vec3(0,uTime*.05,uTime*.018);
        float field = fbm(flow);
        float caustic = pow(1.0-abs(sin(field*24.0+vLocal.y*.025)),14.0);
        vec3 c = mix(vec3(.009,.09,.13),vec3(.04,.36,.43),facing*.6);
        c += vec3(.12,.63,.72)*caustic*.28;
        c += vec3(.12,.57,.64)*fresnel*1.6;
        float spec = pow(max(0.0,dot(n,normalize(view+normalize(vec3(-.4,1,.5))))),100.0);
        c += vec3(.6,.85,1.0)*spec*.8;
        gl_FragColor = vec4(c,(.94+fresnel*.05)*uBuild);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Overflow from the raised districts, placed against the authored terrace lips. */
export function createWaterfalls() {
  const group = new THREE.Group()
  const geometry = new THREE.PlaneGeometry(48, 43, 1, 1)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uBuild: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv=uv;
        vec3 p=position;
        p.z += sin(uv.x*25.0+uTime*1.4)*.35;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime,uBuild;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        float flow = fbm(vec3(vUv.x*28.0,vUv.y*3.0+uTime*1.1,3.0));
        float thread = pow(.5+.5*sin(vUv.x*230.0+flow*5.0),3.0);
        float edge = smoothstep(0.0,.05,vUv.x)*(1.0-smoothstep(.95,1.0,vUv.x));
        float foam = pow(1.0-vUv.y,7.0);
        vec3 color = mix(vec3(.07,.29,.34),vec3(.45,.78,.83),flow);
        color += vec3(.15,.37,.36)*foam;
        float alpha = edge*(.22+flow*.25+thread*.22)*uBuild;
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }
    `,
  })
  for (const [x, z] of [
    [-300, -160],
    [300, -230],
    [-480, -320],
    [480, -380],
  ]) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, 21.5, z + 75)
    mesh.renderOrder = 2
    group.add(mesh)
  }
  return {
    group,
    material,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
