import { useState } from 'react';

// Demo scenario — matches scripts/demo.ts exactly
// VesselCapability: A=0, B=1, C=2, D=3, E=4
const DEMO_SCENARIO = {
  vessels: [
    { id: 'VESSEL-001', capability: 2, startNodeId: 'node-PORT-ALPHA' },  // Class C
    { id: 'VESSEL-002', capability: 1, startNodeId: 'node-PORT-ALPHA' },  // Class B
    { id: 'VESSEL-003', capability: 3, startNodeId: 'node-PORT-BETA'  },  // Class D
    { id: 'VESSEL-004', capability: 2, startNodeId: 'node-PORT-GAMMA' },  // Class C
    { id: 'VESSEL-005', capability: 1, startNodeId: 'node-PORT-DELTA' },  // Class B
    { id: 'VESSEL-006', capability: 3, startNodeId: 'node-PORT-BETA'  },  // Class D
  ],
  cargoes: [
    { id: 'CARGO-001', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity: 100 },
    { id: 'CARGO-002', origin: 'node-PORT-ALPHA', destination: 'node-PORT-GAMMA', quantity:  50 },
    { id: 'CARGO-003', origin: 'node-PORT-BETA',  destination: 'node-PORT-ALPHA', quantity: 200 },
    { id: 'CARGO-004', origin: 'node-PORT-GAMMA', destination: 'node-PORT-BETA',  quantity:  75 },
    { id: 'CARGO-005', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity:  30 },
    { id: 'CARGO-006', origin: 'node-PORT-DELTA', destination: 'node-PORT-ALPHA', quantity: 120 },
    { id: 'CARGO-007', origin: 'node-PORT-GAMMA', destination: 'node-PORT-DELTA', quantity: 80 },
    { id: 'CARGO-008', origin: 'node-PORT-BETA', destination: 'node-PORT-DELTA', quantity: 60 },
    { id: 'CARGO-009', origin: 'node-PORT-DELTA', destination: 'node-PORT-GAMMA', quantity: 90 },
    { id: 'CARGO-010', origin: 'node-PORT-ALPHA', destination: 'node-PORT-DELTA', quantity: 40 },
  ],
};

export default function SimulationControls({ onReset }: { onReset: () => void }) {
  const [speed, setSpeed] = useState(1);

  const post = (url: string, body?: object) =>
    fetch(`http://localhost:3000${url}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

  const init  = () => post('/simulation/initialize', DEMO_SCENARIO);
  const run   = () => post('/simulation/run');
  const pause = () => post('/simulation/pause');
  const step  = () => post('/simulation/step');
  const reset = () => { void post('/simulation/reset'); onReset(); };
  const changeSpeed = (value: number) => {
    setSpeed(value);
    void post('/simulation/speed', { multiplier: value });
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <strong style={{ marginRight: 8 }}>Rycon</strong>
      <button onClick={init}>Initialize</button>
      <button onClick={run}>Run</button>
      <button onClick={pause}>Pause</button>
      <button onClick={step}>Step</button>
      <button onClick={reset}>Reset</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Speed {speed.toFixed(2)}x
        <input
          aria-label="Simulation speed"
          type="range"
          min="0.25"
          max="2"
          step="0.25"
          value={speed}
          onChange={event => changeSpeed(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
