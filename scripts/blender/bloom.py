"""Bloom, applied outside Blender.

Blender 5's compositor moved to a scene node group and every wiring I tried
rendered a blank frame, so the glow is done here instead. Three gaussian
passes at increasing radius, added back over the original — which is what a
bloom is — plus a mild chromatic spread so the halo separates the way light
through a lens actually does.
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def bloom(src, dst, threshold=0.55, radii=(4, 14, 42), gains=(0.55, 0.40, 0.30),
          chroma=1.35):
    img = np.asarray(Image.open(src).convert("RGB"), dtype=np.float32) / 255.0
    # work in something closer to linear, so the halo behaves like light
    lin = np.power(img, 2.2)

    luma = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = np.clip((luma - threshold) / max(1e-5, 1.0 - threshold), 0.0, 1.0)
    bright = lin * mask[..., None]

    glow = np.zeros_like(lin)
    for r, g in zip(radii, gains):
        for c in range(3):
            # the channels are blurred at slightly different radii, which is
            # what gives the halo its coloured fringe
            rr = r * (1.0 + (c - 1) * 0.11 * (chroma - 1.0) * 4.0)
            glow[..., c] += gaussian_filter(bright[..., c], rr) * g

    out = lin + glow
    out = out / (1.0 + out * 0.22)          # gentle rolloff, no hard clipping
    out = np.power(np.clip(out, 0.0, 1.0), 1.0 / 2.2)
    Image.fromarray((out * 255.0 + 0.5).astype(np.uint8)).save(dst)
    return dst


if __name__ == "__main__":
    print(bloom(sys.argv[1], sys.argv[2]))
