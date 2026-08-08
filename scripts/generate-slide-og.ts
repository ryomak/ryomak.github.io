import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import puppeteer from 'puppeteer'
import sharp from 'sharp'

const distDir = join(process.cwd(), 'dist')

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const relativePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
  let filePath = join(distDir, relativePath)

  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
    response.setHeader('content-type', contentTypes[extname(filePath)] ?? 'application/octet-stream')
    createReadStream(filePath).pipe(response)
  } catch {
    response.statusCode = 404
    response.end('Not found')
  }
})

await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

const address = server.address()
if (!address || typeof address === 'string') throw new Error('Could not start the slide preview server')

const browser = await puppeteer.launch({ headless: true })

try {
  const slidesDir = join(distDir, 'slides')
  const entries = await readdir(slidesDir, { withFileTypes: true })
  const slugs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  for (const slug of slugs) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
    await page.goto(`http://127.0.0.1:${address.port}/slides/${encodeURIComponent(slug)}/`, {
      waitUntil: 'networkidle0',
    })

    await page.evaluate(async () => {
      await document.fonts.ready

      document.querySelectorAll<HTMLElement>(
        '.deck-ui, .deck-progress, .deck-thumbs, .deck-presenter, .deck-help',
      ).forEach(element => element.remove())

      const stage = document.querySelector<HTMLElement>('[data-deck-stage]')
      if (stage) {
        stage.style.left = '50%'
        stage.style.top = '50%'
        stage.style.transform = 'translate(-50%, -50%)'
      }

      document.querySelectorAll<HTMLElement>('.slide').forEach((slide, index) => {
        slide.classList.toggle('is-current', index === 0)
        slide.style.transition = 'none'
      })
    })

    const screenshot = await page.screenshot({ type: 'png' })
    await sharp(screenshot)
      .resize(1200, 675)
      .png()
      .toFile(join(distDir, 'og', 'slides', `${slug}.png`))
    await page.close()
  }
} finally {
  await browser.close()
  server.close()
}
