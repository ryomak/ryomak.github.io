import { defineCollection, z } from 'astro:content'
import {FeedItem} from "@/types/config";

const postsCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    published: z.string().transform((str) => new Date(str)),
    draft: z.boolean().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    external: z.boolean().optional(),
    link: z.string().optional(),
  }),
})




export const collections = {
  posts: postsCollection,
  feed: postsCollection,
}
