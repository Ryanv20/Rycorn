import { MovementModifier } from '../ConditionModel';
import { SeededRng } from '../SeededRng';

export class WeatherModel implements MovementModifier {
  constructor(private rng: SeededRng, private maxImpact: number = 0.3) {}
  
  getSpeedMultiplier(from: string, to: string, time: number): number {
    const factor = this.rng.next(from + to + time.toString());
    return 1.0 - factor * this.maxImpact;
  }
}
