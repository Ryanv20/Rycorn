import { CargoRequest } from './CargoRequest';

export interface DemandProvider {
  getCargoRequests(): Promise<CargoRequest[]> | CargoRequest[];
}

export class StaticDemandProvider implements DemandProvider {
  constructor(private requests: CargoRequest[]) {}
  getCargoRequests(): CargoRequest[] {
    return this.requests;
  }
}
