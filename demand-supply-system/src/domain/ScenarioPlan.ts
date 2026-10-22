import { z } from 'zod';
import { cargoDemandSchema } from './CargoDemand.js';

export const scenarioPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  generatedAt: z.string().datetime(),
  generationMode: z.literal('FIXED_RULES'),
  continuous: z.boolean().default(false),
  summary: z.string().min(1),
  rationale: z.array(z.string().min(1)).min(1),
  assumptions: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
  sourceNote: z.string().min(1),
  regionBreakdown: z.array(z.object({
    regionId: z.string().min(1),
    regionName: z.string().min(1),
    flowCount: z.number().int().nonnegative(),
    modelUnits: z.number().nonnegative(),
  })).default([]),
  cycleModel: z.object({
    label: z.string().min(1),
    volumeVariationPercent: z.number().nonnegative(),
    note: z.string().min(1),
  }).optional(),
  cargoDemands: z.array(cargoDemandSchema),
  fleetCount: z.number().int().positive(),
  routePreviewOnly: z.literal(true),
});

export type ScenarioPlan = z.infer<typeof scenarioPlanSchema>;
