import { z } from 'zod';
import { HarborType, HarborSize } from '../shared/enums';

export const geoPositionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const provenanceSchema = z.object({
  source: z.string(),
  sourceId: z.string(),
  sourceVersion: z.string(),
});

export const portSchema = z.object({
  id: z.string() as unknown as z.ZodType<any, any, any>,
  name: z.string(),
  country: z.string(),
  position: geoPositionSchema,
  harborType: z.nativeEnum(HarborType),
  harborSize: z.nativeEnum(HarborSize),
  maximumVesselSize: z.string(),
  provenance: provenanceSchema,
});
