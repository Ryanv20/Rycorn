import { MovementModifier } from './ConditionModel';

export class CompositeMovementModifier implements MovementModifier {
  constructor(private modifiers: MovementModifier[]) {}
  
  getSpeedMultiplier(from: string, to: string, time: number): number {
    return this.modifiers.reduce(
      (acc, m) => acc * m.getSpeedMultiplier(from, to, time),
      1.0
    );
  }
}
