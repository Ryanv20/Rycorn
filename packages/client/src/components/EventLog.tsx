import { useState } from 'react';
import { Activity, Anchor, CircleAlert, Navigation, Package, Ship } from 'lucide-react';

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

function EventIcon({ eventType }: { eventType: string }) {
  if (eventType === 'DEPARTED' || eventType === 'ARRIVED') return <Navigation size={15} />;
  if (eventType.includes('LOAD') || eventType.includes('UNLOAD')) return <Package size={15} />;
  if (eventType === 'WAITING_FOR_BERTH') return <CircleAlert size={15} />;
  if (eventType.startsWith('SHIP_')) return <Ship size={15} />;
  if (eventType === 'SHIP_AVAILABLE') return <Anchor size={15} />;
  return <Activity size={15} />;
}

export default function EventLog({ events, compact = false }: { events: any[]; compact?: boolean }) {
  const [category, setCategory] = useState<Category>('Main');
  const visibleEvents = events.filter(event => matchesCategory(event, category));
  const renderedEvents = compact ? visibleEvents.slice(-12) : visibleEvents;

  return (
    <section className={`event-log ${compact ? 'is-compact' : ''}`}>
      <header className="event-log-heading"><div><p className="eyebrow">LOGBOOK</p><h3>{compact ? 'Recent activity' : 'Event history'}</h3></div><span>{visibleEvents.length}</span></header>
      <div className="event-filters" role="tablist" aria-label="Filter events">
        {categories.map(item => <button key={item} role="tab" aria-selected={item === category} className={item === category ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <ol className="event-list">
        {renderedEvents.map((event, index) => <li key={`${event.eventId ?? event.entityId}-${index}`}>
          <span className={`event-icon event-${event.eventType.toLowerCase()}`}><EventIcon eventType={event.eventType} /></span>
          <div className="event-copy"><strong>{event.eventType.replaceAll('_', ' ')}</strong><small>{event.entityId} · {event.locationNodeId}</small></div>
          <time>T+{Number(event.simulationTime).toFixed(2)}h</time>
        </li>)}
        {visibleEvents.length === 0 && <li className="event-empty">No events in this category yet.</li>}
      </ol>
    </section>
  );
}
