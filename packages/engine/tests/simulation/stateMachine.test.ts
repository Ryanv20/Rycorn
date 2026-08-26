import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../src/simulation/state/StateMachine';
import { SimulationError } from '../../src/errors/SimulationError';

describe('StateMachine', () => {
  it('allows valid transitions', () => {
    expect(() => StateMachine.transitionVessel('IDLE', 'ASSIGNED')).not.toThrow();
    expect(() => StateMachine.transitionCargo('CREATED', 'ASSIGNED')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => StateMachine.transitionVessel('IDLE', 'UNLOADING')).toThrowError(SimulationError);
    expect(() => StateMachine.transitionCargo('IN_TRANSIT', 'ASSIGNED')).toThrowError(SimulationError);
  });
});
