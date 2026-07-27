import { defineCollection, z } from 'astro:content'

const postsCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    published: z.date(),
    draft: z.boolean().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    external: z.boolean().optional(),
    link: z.string().optional(),
  }),
})

const feedCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    published: z.string().transform(str => new Date(str)),
    draft: z.boolean().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    external: z.boolean().optional(),
    link: z.string().optional(),
  }),
})

const slidesCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    published: z.date(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
    event: z.string().optional(),
    theme: z.enum(['midnight', 'paper', 'studio', 'terminal', 'sunset']).default('midnight'),
    /** flips on the slide splitter in src/plugins/remark-slides.mjs */
    slides: z.literal(true).default(true),
  }),
})

export const collections = {
  posts: postsCollection,
  feed: feedCollection,
  slides: slidesCollection,
}
