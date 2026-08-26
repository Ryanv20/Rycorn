import { VesselCapability } from '../../domain/network/VesselCapability';

export class CargoCompatibilityPolicy {
  isCompatible(cargoType: string, vesselCapability: VesselCapability): boolean {
    // Phase 8: all cargo types compatible with all vessel classes
    return true;
  }
}
