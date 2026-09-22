import { z } from 'zod';

export const cargoDemandSchema = z.object({
  requestId: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  quantity: z.number().positive(),
  earliestDeparture: z.number().nonnegative(),
  deadline: z.number().positive(),
  cargoType: z.string().min(1).default('GENERAL'),
});

export type CargoDemand = z.infer<typeof cargoDemandSchema>;