import { describe, it, expect } from 'vitest';
import { EventQueue } from '../../src/simulation/events/EventQueue';
import { SimulationEvent } from '../../src/simulation/events/SimulationEvent';

describe('EventQueue', () => {
  it('orders by time and deterministic tie-breaking', () => {
    const queue = new EventQueue();
    
    queue.enqueue({ eventId: '1', simulationTime: 10, eventType: 'DEPARTED', entityId: 'v1', locationNodeId: 'n1', metadata: {} });
    queue.enqueue({ eventId: '2', simulationTime: 5, eventType: 'LOAD_STARTED', entityId: 'v1', locationNodeId: 'n1', metadata: {} });
    queue.enqueue({ eventId: '3', simulationTime: 5, eventType: 'LOAD_COMPLETED', entityId: 'v1', locationNodeId: 'n1', metadata: {} });
    
    const e1 = queue.dequeue()!;
    expect(e1.eventId).toBe('3');
    
    const e2 = queue.dequeue()!;
    expect(e2.eventId).toBe('2');
    
    const e3 = queue.dequeue()!;
    expect(e3.eventId).toBe('1');
  });
});
