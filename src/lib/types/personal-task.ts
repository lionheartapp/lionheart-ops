import { z } from 'zod'

export const CreatePersonalTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  dueDate: z.coerce.date().optional(),
})

export const UpdatePersonalTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export type CreatePersonalTaskInput = z.infer<typeof CreatePersonalTaskSchema>
export type UpdatePersonalTaskInput = z.infer<typeof UpdatePersonalTaskSchema>
