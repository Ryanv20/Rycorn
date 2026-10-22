import type { CargoDemand } from '../domain/CargoDemand.js';

export interface DemandProvider {
  getCargoDemands(): Promise<readonly CargoDemand[]> | readonly CargoDemand[];
}