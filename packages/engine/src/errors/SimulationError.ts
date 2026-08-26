export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}
