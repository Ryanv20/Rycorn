import { z } from 'zod';
import { geoPositionSchema } from './portSchema';

export const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  boundary: z.array(geoPositionSchema).min(3),
}).refine(data => {
  if (data.boundary.length === 0) return true;
  const first = data.boundary[0];
  const last = data.boundary[data.boundary.length - 1];
  return first.latitude === last.latitude && first.longitude === last.longitude;
}, { message: "Region boundary must be a closed loop" });
