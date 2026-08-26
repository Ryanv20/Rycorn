import { z } from 'zod';

export const cargoRequestSchema = z.object({
  requestId:         z.string().min(1),
  origin:            z.string().min(1),      // Rycon node ID
  destination:       z.string().min(1),      // Rycon node ID
  quantity:          z.number().positive(),
  earliestDeparture: z.number().nonnegative(), // simulation hours from t=0
  deadline:          z.number().positive(),    // simulation hours from t=0
  cargoType:         z.string().default('GENERAL'),
});

export type CargoRequest = z.infer<typeof cargoRequestSchema>;
