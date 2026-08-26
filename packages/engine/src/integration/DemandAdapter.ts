import { CargoRequest } from './CargoRequest';
import { CargoDefinition } from '../simulation/engine/SimulationEngine';

export class DemandAdapter {
  toCargoDefinition(request: CargoRequest): CargoDefinition & { quantity?: number } {
    return {
      id: request.requestId,
      origin: request.origin,
      destination: request.destination,
      quantity: request.quantity
    };
  }
  
  toBatch(requests: CargoRequest[]): (CargoDefinition & { quantity?: number })[] {
    return requests.map(r => this.toCargoDefinition(r));
  }
}
