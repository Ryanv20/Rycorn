import { PortDelayModifier } from '../ConditionModel';
import { SeededRng } from '../SeededRng';

export class PortDelayModel implements PortDelayModifier {
  constructor(private rng: SeededRng, private maxDelayHours: number = 2) {}
  
  getAdditionalDelay(portNodeId: string, operationType: 'LOAD' | 'UNLOAD', time: number): number {
    const factor = this.rng.next(portNodeId + operationType + time.toString());
    return factor * this.maxDelayHours;
  }
}
