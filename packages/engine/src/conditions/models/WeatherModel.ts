import { MovementModifier } from '../ConditionModel';
import { SeededRng } from '../SeededRng';

export class WeatherModel implements MovementModifier {
  constructor(private rng: SeededRng, private maxImpact: number = 0.3) {
    if (!Number.isFinite(maxImpact) || maxImpact < 0 || maxImpact > 0.9) {
      throw new Error('Weather speed impact must be between 0 and 0.9');
    }
  }
  
  getSpeedMultiplier(from: string, to: string, time: number): number {
    const factor = this.rng.next(from + to + time.toString());
    return 1.0 - factor * this.maxImpact;
  }
}
