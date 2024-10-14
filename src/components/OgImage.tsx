import satori from 'satori'
import sharp from 'sharp'

export async function getOgImage(text: string) {
  const fontData = (await getFontData()) as ArrayBuffer
  // 30文字以上は省略
  const v = text.length > 40 ? text.slice(0, 40) + '...' : text
  // TODO 画像を取得する
  const svg = await satori(
    <main
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#444',
        color: '#fff',
        padding: '10px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'absolute',
        }}
      >
        <img
          src={
            'https://github.com/ryomak/ryomak.github.io/assets/21288308/d57e4437-66c9-49fc-8f64-31e4841bfd05'
          }
        />
      </div>
      <section style={{ maxWidth: 800, paddingBottom: 24, paddingRight: 8 }}>
        <h1 style={{ fontSize: '40px' }}>{v}</h1>
      </section>
    </main>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          style: 'normal',
        },
      ],
    },
  )

  return await sharp(Buffer.from(svg)).png().toBuffer()
}

async function getFontData() {
  const API = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700`

  const css = await (
    await fetch(API, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    })
  ).text()

  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (!resource) return

  return await fetch(resource[1]).then(res => res.arrayBuffer())
}
