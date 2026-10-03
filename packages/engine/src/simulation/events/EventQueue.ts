import { SimulationEvent, type EventType } from './SimulationEvent';

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

  nextTime(eventType: EventType, entityId: string): number | undefined {
    const event = this.events.find(candidate => candidate.eventType === eventType && candidate.entityId === entityId);
    return event?.simulationTime;
  }

  remove(eventType: EventType, entityId: string): void {
    this.events = this.events.filter(event => event.eventType !== eventType || event.entityId !== entityId);
  }
}
