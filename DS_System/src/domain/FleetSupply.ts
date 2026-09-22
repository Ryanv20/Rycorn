import { z } from 'zod';

export const vesselCapabilitySchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const vesselSupplySchema = z.object({
  id: z.string().min(1),
  capability: vesselCapabilitySchema,
  startNodeId: z.string().min(1),
});

export type VesselCapability = z.infer<typeof vesselCapabilitySchema>;
export type VesselSupply = z.infer<typeof vesselSupplySchema>;