import { z } from 'zod';

export const wpiRecordSchema = z.object({
  'World Port Index Number': z.string().min(1, 'Source ID cannot be empty'),
  'Main Port Name': z.string().min(1, 'Port name cannot be empty'),
  'Country Code': z.string().min(1, 'Country code cannot be empty'),
  'Latitude': z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-90).max(90)
  ),
  'Longitude': z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(-180).max(180)
  ),
  'Harbor Type': z.string().optional(),
  'Harbor Size': z.string().optional(),
  'Maximum Vessel Size': z.string().optional(),
});

export type WorldPortIndexRecord = z.infer<typeof wpiRecordSchema>;
