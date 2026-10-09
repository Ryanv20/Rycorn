import { VesselStatus } from './VesselState';
import { CargoStatus } from './CargoState';
import { SimulationError } from '../../errors/SimulationError';

export class StateMachine {
  static transitionVessel(current: VesselStatus, target: VesselStatus): void {
    const valid: Record<VesselStatus, VesselStatus[]> = {
      IDLE: ['ASSIGNED', 'REPOSITIONING'],
      REPOSITIONING: ['IDLE'],
      ASSIGNED: ['LOADING'],
      LOADING: ['SAILING'],
      SAILING: ['ARRIVED'],
      ARRIVED: ['UNLOADING'],
      UNLOADING: ['IDLE']
    };
    
    if (!valid[current]?.includes(target)) {
      throw new SimulationError(`Invalid vessel transition: ${current} -> ${target}`);
    }
  }

  static transitionCargo(current: CargoStatus, target: CargoStatus): void {
    const valid: Record<CargoStatus, CargoStatus[]> = {
      CREATED: ['ASSIGNED'],
      ASSIGNED: ['IN_TRANSIT'],
      IN_TRANSIT: ['DELIVERED'],
      DELIVERED: []
    };
    
    if (!valid[current]?.includes(target)) {
      throw new SimulationError(`Invalid cargo transition: ${current} -> ${target}`);
    }
  }
}
