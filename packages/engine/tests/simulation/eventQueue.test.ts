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

  it('finds and replaces a vessel availability event without keeping stale wake-ups', () => {
    const queue = new EventQueue();
    queue.enqueue({ eventId: 'future', simulationTime: 20, eventType: 'SHIP_AVAILABLE', entityId: 'v1', locationNodeId: 'n1', metadata: {} });
    expect(queue.nextTime('SHIP_AVAILABLE', 'v1')).toBe(20);
    queue.remove('SHIP_AVAILABLE', 'v1');
    queue.enqueue({ eventId: 'earlier', simulationTime: 10, eventType: 'SHIP_AVAILABLE', entityId: 'v1', locationNodeId: 'n1', metadata: {} });
    expect(queue.nextTime('SHIP_AVAILABLE', 'v1')).toBe(10);
    expect(queue.dequeue()?.eventId).toBe('earlier');
    expect(queue.nextTime('SHIP_AVAILABLE', 'v1')).toBeUndefined();
  });
});
