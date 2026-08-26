import { VesselCapability } from '../domain/network/VesselCapability';
import { RouteResult } from '../routing/Router';
import { MovementModifier } from '../conditions/ConditionModel';

export interface SpeedProfile {
  capability: VesselCapability;
  nominalSpeedKnots: number;
}

export interface TravelEstimate {
  distanceKm: number;
  durationHours: number;
}

export class MovementCalculator {
  private speedMap = new Map<VesselCapability, number>();

  constructor(speeds?: SpeedProfile[], private modifier?: MovementModifier) {
    const defaultSpeeds: SpeedProfile[] = [
      { capability: VesselCapability.A, nominalSpeedKnots: 8 },
      { capability: VesselCapability.B, nominalSpeedKnots: 10 },
      { capability: VesselCapability.C, nominalSpeedKnots: 12 },
      { capability: VesselCapability.D, nominalSpeedKnots: 14 },
      { capability: VesselCapability.E, nominalSpeedKnots: 16 },
    ];
    const profiles = speeds || defaultSpeeds;
    for (const sp of profiles) {
      this.speedMap.set(sp.capability, sp.nominalSpeedKnots);
    }
  }

  calculate(route: RouteResult & { found: true }, capability: VesselCapability, simulationTime: number = 0): TravelEstimate {
    const speedKnots = this.speedMap.get(capability);
    if (speedKnots === undefined) {
      throw new Error(`No speed profile for capability ${capability}`);
    }

    const speedKmh = speedKnots * 1.852;
    
    const multiplier = this.modifier
      ? this.modifier.getSpeedMultiplier(route.path[0], route.path[route.path.length - 1], simulationTime)
      : 1.0;
      
    const durationHours = (route.totalDistanceKm / speedKmh) * (1 / multiplier);

    return {
      distanceKm: route.totalDistanceKm,
      durationHours
    };
  }
}
