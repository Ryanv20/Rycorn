import { z } from 'zod';

export const demandStatusSchema = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'DELIVERED_LATE',
  'CANCELLED',
  'FAILED',
]);

export const cargoDemandSchema = z.object({
  requestId: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  quantity: z.number().positive(),
  earliestDeparture: z.number().nonnegative(),
  deadline: z.number().positive(),
  cargoType: z.string().min(1).default('GENERAL'),
  originRegionId: z.string().min(1).optional(),
  destinationRegionId: z.string().min(1).optional(),
  tradeLaneId: z.string().min(1).optional(),
  cycleNumber: z.number().int().positive().optional(),
  failureReason: z.string().min(1).optional(),
  status: demandStatusSchema.default('PENDING'),
});

export type CargoDemand = z.infer<typeof cargoDemandSchema>;
export type DemandStatus = z.infer<typeof demandStatusSchema>;
