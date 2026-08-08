import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'
import { getOgImage } from '@components/OgImage.tsx'

export async function getStaticPaths() {
  const decks = await getCollection(
    'slides',
    ({ data }) => import.meta.env.DEV || !data.draft,
  )

  return decks.map(deck => ({
    params: { slug: deck.slug },
    props: { title: deck.data.title },
  }))
}

export async function GET({ props }: APIContext) {
  const body = await getOgImage(props.title as string)

  return new Response(body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
