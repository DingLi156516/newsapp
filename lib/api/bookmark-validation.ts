import { z } from 'zod'

export const bookmarkStoryIdSchema = z.object({
  storyId: z.string().uuid('Invalid story ID'),
})

export type BookmarkStoryId = z.infer<typeof bookmarkStoryIdSchema>
