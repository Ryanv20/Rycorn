import { useEffect, useState } from 'react';
import Map from './components/Map';
import SimulationControls from './components/SimulationControls';
import EventLog from './components/EventLog';
import Clock from './components/Clock';
import AdminSidebar from './components/AdminSidebar';

export interface AppState {
  vessels: any[];
  cargoes: any[];
  events: any[];
  simulationTime: number;
  connected: boolean;
  systemStatus: any;
  errors: any[];
}

export default function App() {
  const [state, setState] = useState<AppState>({
    vessels: [],
    cargoes: [],
    events: [],
    simulationTime: 0,
    connected: false,
    systemStatus: null,
    errors: [],
  });
  const [eventLogOpen, setEventLogOpen] = useState(true);

  const resetSimulation = () => setState(s => ({ ...s, vessels: [], cargoes: [], events: [], simulationTime: 0 }));

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:3000/ws');
    
    ws.onopen = () => setState(s => ({ ...s, connected: true }));
    ws.onclose = () => setState(s => ({ ...s, connected: false }));
    
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'SIMULATION_EVENT') {
        setState(s => ({ ...s, events: [...s.events, data.event] }));
      } else if (data.type === 'STATE_UPDATE') {
        setState(s => ({
          ...s,
          vessels: data.vessels,
          cargoes: data.cargoes,
          simulationTime: data.simulationTime,
        }));
      } else if (data.type === 'ADMIN') {
        setState(s => ({ ...s, systemStatus: data.payload }));
      } else if (data.type === 'ERROR_LOG') {
        setState(s => ({ ...s, errors: data.errors ?? [] }));
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <AdminSidebar connected={state.connected} systemStatus={state.systemStatus} errors={state.errors} vessels={state.vessels} cargoes={state.cargoes} simulationTime={state.simulationTime} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', padding: 10, background: '#eee', gap: 20 }}>
        <SimulationControls onReset={resetSimulation} />
        <Clock simulationTime={state.simulationTime} />
        <div>Status: {state.connected ? 'Connected' : 'Disconnected'}</div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Map vessels={state.vessels} />
        </div>
        <div style={{ width: eventLogOpen ? 'clamp(220px, 30vw, 400px)' : 42, minWidth: eventLogOpen ? 220 : 42, borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease' }}>
          <EventLog events={state.events} open={eventLogOpen} onToggle={() => setEventLogOpen(open => !open)} />
        </div>
      </div>
      </div>
    </div>
  );
}
