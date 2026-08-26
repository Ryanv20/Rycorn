import { useState } from 'react';

type Category = 'Main' | 'Ship Log' | 'Cargo Log' | 'Route Log' | 'Alerts' | 'All Events';
const categories: Category[] = ['Main', 'Ship Log', 'Cargo Log', 'Route Log', 'Alerts', 'All Events'];

function matchesCategory(event: any, category: Category): boolean {
  if (category === 'All Events') return true;
  if (category === 'Route Log') return event.eventType === 'DEPARTED' || event.eventType === 'ARRIVED';
  if (category === 'Alerts') return event.eventType === 'WAITING_FOR_BERTH';
  if (category === 'Cargo Log') return Array.isArray(event.metadata?.cargoIds) && event.metadata.cargoIds.length > 0;
  if (category === 'Ship Log') return event.eventType.startsWith('SHIP_');
  return event.eventType === 'DEPARTED' || event.eventType === 'ARRIVED' || event.eventType === 'WAITING_FOR_BERTH';
}

export default function EventLog({ events, open, onToggle }: { events: any[]; open: boolean; onToggle: () => void }) {
  const [category, setCategory] = useState<Category>('Main');
  const visibleEvents = events.filter(event => matchesCategory(event, category));

  return (
    <div style={{ padding: open ? 10 : '10px 6px', overflowY: open ? 'auto' : 'hidden', flex: 1 }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
        <h3 style={{ margin: 0 }}>{open ? 'Event Log' : '» Event Log'}</h3>
      </button>
      {open && <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '10px 0' }}>
          {categories.map(item => (
            <button key={item} onClick={() => setCategory(item)} style={{ padding: '4px 6px', border: '1px solid #ccc', background: item === category ? '#dbeafe' : '#fff', cursor: 'pointer', fontSize: 11 }}>
              {item} ({events.filter(event => matchesCategory(event, item)).length})
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {visibleEvents.map((event, index) => (
          <div key={`${event.eventId ?? event.entityId}-${index}`} style={{ borderBottom: '1px solid #eee', paddingBottom: 5 }}>
            <span style={{ color: '#666' }}>T+{event.simulationTime.toFixed(2)}h</span>
            <strong style={{ marginLeft: 10 }}>{event.eventType}</strong>
            <div style={{ fontSize: '0.9em', color: '#444' }}>
              Entity: {event.entityId} | Loc: {event.locationNodeId}
            </div>
          </div>
        ))}
        {visibleEvents.length === 0 && <span style={{ color: '#777' }}>No events in this category</span>}
        </div>
      </>}
    </div>
  );
}
