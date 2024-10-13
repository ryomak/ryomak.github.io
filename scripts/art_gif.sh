#!/bin/bash

# Directory setup
if [ $# -lt 2 ]; then
  echo "Usage: $0 <language> <name>"
  exit 1
fi
language="$1"
name="$2"

gallery_dir="public/art/${language}/${name}"
file_name="${language}_${name}"
mkdir -p "$gallery_dir"

# WASM setup
wasm_dir="public/wasm"

# Run the WASM to generate parameters for the artwork
wasm_exec="${wasm_dir}/wasm_exec.js"
wasm_file="${wasm_dir}/${file_name}.wasm"

# Generate multiple frames from canvas using Node.js and Puppeteer for headless browser automation
# Install the required Chrome version if it is not available
frames=20
node -e '
  const puppeteer = require("puppeteer");
  const fs = require("fs");
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  (async () => {
    const browser = await puppeteer.launch({});
    const page = await browser.newPage();

    // Navigate to the local server running at localhost:4321
    await page.goto("http://localhost:4321/art/detail/'${file_name}'/");

    // Wait for the canvas to be rendered
    await sleep(2000);

    // Capture multiple frames
    for (let i = 1; i <= '${frames}'; i++) {
      const canvasElement = await page.$("#canvas-detail");
      if (canvasElement) {
        await canvasElement.screenshot({ path: `'${gallery_dir}'/frame_${i}.png` });
        console.log(`Captured frame ${i}`);
        await sleep(100); // Add delay between frames if necessary
      } else {
        console.error("Canvas element not found.");
        break;
      }
    }

    await browser.close();
  })();
'

# Create a GIF from the generated frames
magick convert -delay 10 -loop 0 ${gallery_dir}/frame_*.png ${gallery_dir}/art.gif

# Clean up individual frames
rm ${gallery_dir}/frame_*.png

if [ -f "${gallery_dir}/art.gif" ]; then
  echo "Animated GIF has been successfully generated in the ${gallery_dir} directory."
else
  echo "Failed to generate animated GIF."
fi