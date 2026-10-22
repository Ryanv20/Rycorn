import { z } from 'zod';

export const vesselCapabilitySchema = z.enum(['A', 'B', 'C', 'D', 'E']);
export const vesselTypeSchema = z.enum([
  'CONTAINER',
  'BULK_CARRIER',
  'TANKER',
  'GENERAL_CARGO',
  'REEFER',
]);

export const vesselSupplySchema = z.object({
  id: z.string().min(1),
  capability: vesselCapabilitySchema,
  startNodeId: z.string().min(1),
  vesselType: vesselTypeSchema.default('GENERAL_CARGO'),
  deadweightTonnes: z.number().positive().default(12000),
  fuelCapacityTonnes: z.number().positive().default(1200),
  fuelRemainingTonnes: z.number().nonnegative().default(900),
  fuelBurnTonnesPerHour: z.number().positive().default(0.12),
}).refine(vessel => vessel.fuelRemainingTonnes <= vessel.fuelCapacityTonnes, {
  message: 'Remaining fuel cannot exceed fuel capacity',
  path: ['fuelRemainingTonnes'],
});

export type VesselCapability = z.infer<typeof vesselCapabilitySchema>;
export type VesselType = z.infer<typeof vesselTypeSchema>;
export type VesselSupply = z.infer<typeof vesselSupplySchema>;