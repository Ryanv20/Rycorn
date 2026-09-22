import type { DemandProvider } from '../contracts/DemandProvider.js';
import type { CargoDemand } from '../domain/CargoDemand.js';

export class StaticDemandProvider implements DemandProvider {
  constructor(private readonly demands: readonly CargoDemand[]) {}

  getCargoDemands(): readonly CargoDemand[] {
    return this.demands;
  }
}