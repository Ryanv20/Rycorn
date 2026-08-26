import { SimulationEvent } from './SimulationEvent';

export class EventQueue {
  private events: SimulationEvent[] = [];

  enqueue(event: SimulationEvent): void {
    this.events.push(event);
    this.events.sort((a, b) => {
      if (a.simulationTime !== b.simulationTime) {
        return a.simulationTime - b.simulationTime;
      }
      return a.eventType.localeCompare(b.eventType);
    });
  }

  dequeue(): SimulationEvent | undefined {
    return this.events.shift();
  }

  peek(): SimulationEvent | undefined {
    return this.events[0];
  }

  isEmpty(): boolean {
    return this.events.length === 0;
  }

  size(): number {
    return this.events.length;
  }
}
