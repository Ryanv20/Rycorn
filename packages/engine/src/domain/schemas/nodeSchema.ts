import { z } from 'zod';
import { geoPositionSchema } from './portSchema';

export const geographicNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['PORT', 'INTERMEDIATE']),
  position: geoPositionSchema,
  portId: z.string().optional(),
}).refine(data => {
  if (data.type === 'PORT') return data.portId !== undefined;
  if (data.type === 'INTERMEDIATE') return data.portId === undefined;
  return true;
}, { message: "portId is required for PORT nodes and must be omitted for INTERMEDIATE nodes" });
