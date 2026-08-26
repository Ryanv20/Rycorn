import { VesselCapability } from '../../domain/network/VesselCapability';

export interface VesselCapacityConfig {
  [vesselCapability: string]: number; // max cargo units
}

export class CapacityPolicy {
  constructor(private config: VesselCapacityConfig) {}
  
  canAccept(vesselCapability: VesselCapability, currentLoad: number, additionalQuantity: number): boolean {
    return this.remainingCapacity(vesselCapability, currentLoad) >= additionalQuantity;
  }
  
  remainingCapacity(vesselCapability: VesselCapability, currentLoad: number): number {
    const maxCap = this.config[vesselCapability];
    if (maxCap === undefined) {
      throw new Error(`No capacity configured for vessel capability ${vesselCapability}`);
    }
    return Math.max(0, maxCap - currentLoad);
  }
}
