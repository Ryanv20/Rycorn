import { SpeedProfile } from '../movement/MovementCalculator';

import { PortCapacityConfig } from '../operations/policies/PortCapacityPolicy';
import { VesselCapacityConfig } from '../operations/policies/CapacityPolicy';
import { MovementModifier, PortDelayModifier } from '../conditions/ConditionModel';

export interface SimulationConfig {
  loadDurationHours: number;
  unloadDurationHours: number;
  speedProfiles?: SpeedProfile[];
  berthWaitHours?: number;
  portCapacity?: PortCapacityConfig;
  vesselCapacity?: VesselCapacityConfig;
  movementModifier?: MovementModifier;
  portDelayModifier?: PortDelayModifier;
  bunkerPortNodeIds?: string[];
  bunkeringDurationHours?: number;
}
