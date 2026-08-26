import { MovementModifier } from '../ConditionModel';

export class CongestionModel implements MovementModifier {
  getSpeedMultiplier(from: string, to: string, time: number): number {
    const hour = time % 24;
    return (hour >= 8 && hour <= 18) ? 0.9 : 1.0;
  }
}
