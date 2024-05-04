import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getOgImage } from '@components/OgImage.tsx';

export async function getStaticPaths() {
    const posts = await getCollection('posts');

    return posts.map((post) => ({
        params: {
            slug: post.slug,
        },
    }));
}

export async function GET({ params }: APIContext) {
    const { slug,type } = params;

    if (!slug) return { status: 404 };

    // @ts-ignore
    const post = (await getCollection('posts')).find((post) => post.slug === slug);
    const title = post?.data.title ?? 'I am ryomak(kurisu).';

    const body = await getOgImage(title);

    return new Response(body, {
        headers: {
            'content-type': 'image/png',
        },
    });
}