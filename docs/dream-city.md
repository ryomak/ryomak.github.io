# The water-city home page

The home page is a continuous journey from a ruined water city at sunset to its illuminated, restored form. The original granular pyrefly trails are preserved; per-fly fades increase the population gradually from a sparse opening to the full swarm. The architecture is newly authored, rather than a reskin of the previous Zanarkand GLBs.

## Composition

- A central stadium with eighteen seating tiers, concourses, curved buttresses and a suspended water volume.
- Three tower silhouettes, recessed warm/cool windows, bronze cornices and patinated ribs.
- Two rings of open aqueducts, a ceremonial causeway and four raised districts with overflow waterfalls.
- Matching ruined buildings on the same footprints, with hollow fractured crowns, missing bridge spans and rubble.
- Long views between the content sections. Native document scrolling drives a slow lateral camera move; wheel and keyboard input are not intercepted.

Visual references: the sunset ruins in the [official FFX HD gallery](https://store.steampowered.com/app/359870/FINAL_FANTASY_XX2_HD_Remaster/) and the layered water-city architecture visible in the game's opening. The project contains no extracted game models or textures.

## Files

| File | Responsibility |
| --- | --- |
| `scripts/blender/dream_city.py` | Reproducible original geometry, mineral base-color/normal textures, GLB export and offline look-development renders |
| `public/models/dream-city.glb` | Ready-to-use compressed model; Blender is not needed to build or run the website |
| `src/components/home/city/journey.ts` | Pure scroll-to-camera and era mapping |
| `src/components/home/city/scene.ts` | Model lifecycle, PBR lighting, restoration, HDR bloom and output transform |
| `src/components/home/city/environment.ts` | Procedural sky, planar sea reflection, water volume and waterfalls |
| `src/components/home/city/machinery.ts` | Counter-rotating annular gears, bearings, flywheels and telescoping actuators; restored-city metalwork |
| `src/components/home/city/pyreflies.ts` | Original multicoloured grain trails and heads |
| `src/components/home/city/atmosphere.ts` | Low sea mist and restoration particles |
| `src/scripts/home-city.ts` | Native scroll binding, progressive loading, reduced motion and Swup cleanup |

## Regenerate the asset

```sh
blender --background --factory-startup --python scripts/blender/dream_city.py
```

The generator writes `public/models/dream-city.glb` and an editable `.blend` plus preview PNGs under the ignored `.preview/dream-city/` directory. The GLB has separate `Permanent`, `Ruins` and `Dream` roots. `WaterVolume` is replaced by a live water shader. Materials must be cloned per era because ruin and restoration use opposite clipping fields.

## Runtime budget and fallback

The single GLB is approximately 4.3 MB, including two embedded 512-pixel PBR maps. Meshes are batched by era and material. Desktop reflections have a maximum 768-pixel target dimension. Narrow/low-memory devices omit the reflection pass and cap device pixel ratio at 1.15. Geometry, textures, image bitmaps, postprocessing buffers and decoder workers are disposed on navigation; late loading completions are released too.

Reduced motion skips the animated renderer entirely. Model/shader failures and lost contexts leave the normal document readable. Scenery never owns focus or traps scrolling. Animation pauses in background tabs.

## Verification

```sh
npx tsx --test scripts/tests/dream-city.test.ts
npx biome check src/components/home/city src/scripts/home-city.ts scripts/tests/dream-city.test.ts
npx astro build
```

The tests check era endpoints, continuity and water/stadium clearance at five aspect ratios, invalid scroll input, required model roots, embedded textures, surface normals and asset/triangle budgets. Visual review is still required for lighting, material feel, text contrast and device performance.
