import { VesselState } from './VesselState';
import { CargoState } from './CargoState';
import { SimulationError } from '../../errors/SimulationError';

export class SimulationContext {
  vessels: Map<string, VesselState> = new Map();
  cargoes: Map<string, CargoState> = new Map();
  
  getVessel(id: string): VesselState {
    const v = this.vessels.get(id);
    if (!v) throw new SimulationError(`Vessel ${id} not found`);
    return v;
  }
  
  getCargo(id: string): CargoState {
    const c = this.cargoes.get(id);
    if (!c) throw new SimulationError(`Cargo ${id} not found`);
    return c;
  }
  
  updateVessel(id: string, update: Partial<VesselState>): void {
    const v = this.getVessel(id);
    this.vessels.set(id, { ...v, ...update });
  }
  
  updateCargo(id: string, update: Partial<CargoState>): void {
    const c = this.getCargo(id);
    this.cargoes.set(id, { ...c, ...update });
  }
}
