import { SpeedProfile } from '../movement/MovementCalculator';

import { PortCapacityConfig } from '../operations/policies/PortCapacityPolicy';
import { VesselCapacityConfig } from '../operations/policies/CapacityPolicy';
import { MovementModifier, PortDelayModifier } from '../conditions/ConditionModel';

export interface EnvironmentConfig {
  enabled: boolean;
  seed: string;
  maxWeatherImpact?: number;
  congestionEnabled?: boolean;
  maxPortDelayHours?: number;
}

export interface SimulationConfig {
  loadDurationHours: number;
  unloadDurationHours: number;
  speedProfiles?: SpeedProfile[];
  berthWaitHours?: number;
  portCapacity?: PortCapacityConfig;
  vesselCapacity?: VesselCapacityConfig;
  movementModifier?: MovementModifier;
  portDelayModifier?: PortDelayModifier;
  environment?: EnvironmentConfig;
  bunkerPortNodeIds?: string[];
  bunkeringDurationHours?: number;
}
