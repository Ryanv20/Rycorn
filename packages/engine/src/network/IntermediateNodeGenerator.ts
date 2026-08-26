import { GeoPosition } from '../domain/shared/GeoPosition';
import { distance } from '@turf/turf';
import { point } from '@turf/helpers';

export class IntermediateNodeGenerator {
  static calculateDistanceKm(p1: GeoPosition, p2: GeoPosition): number {
    return distance(
      point([p1.longitude, p1.latitude]),
      point([p2.longitude, p2.latitude]),
      { units: 'kilometers' }
    );
  }

  static generate(p1: GeoPosition, p2: GeoPosition, intervalKm: number = 5): GeoPosition[] {
    const dist = this.calculateDistanceKm(p1, p2);
    if (dist <= intervalKm) return [];
    
    const count = Math.floor(dist / intervalKm);
    const intermediates: GeoPosition[] = [];
    
    for (let i = 1; i <= count; i++) {
      const fraction = (i * intervalKm) / dist;
      const lat = p1.latitude + (p2.latitude - p1.latitude) * fraction;
      const lon = p1.longitude + (p2.longitude - p1.longitude) * fraction;
      intermediates.push({ latitude: lat, longitude: lon });
    }
    return intermediates;
  }
}
