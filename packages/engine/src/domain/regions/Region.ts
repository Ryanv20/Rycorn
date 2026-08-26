import { GeoPosition } from '../shared/GeoPosition';

export type RegionId = string & { readonly __brand: unique symbol };

export interface Region {
  id: RegionId;
  name: string;
  boundary: GeoPosition[];
}
