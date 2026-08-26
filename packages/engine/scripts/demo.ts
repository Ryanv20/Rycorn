/**
 * RYCON — Interactive Demo Script
 * Run with: pnpm tsx scripts/demo.ts
 *
 * Demonstrates: 3 vessels, 5 cargoes, multiple routes, vessel reuse.
 * Prints a full event log with simulation times.
 */
import { SimulationEngine } from '../src/simulation/engine/SimulationEngine.js';
import { NetworkBuilder } from '../src/network/NetworkBuilder.js';
import { VesselCapability } from '../src/domain/network/VesselCapability.js';
import { StaticDemandProvider } from '../src/integration/DemandInterface.js';
import { DemandAdapter } from '../src/integration/DemandAdapter.js';

// ── 1. Build a small maritime network ─────────────────────────────────────
const builder = new NetworkBuilder();

builder.addPorts([
  { id: 'PORT-ALPHA',  name: 'Alpha Port',  country: 'XX', position: { latitude: 51.5, longitude:  0.0 }, sourceId: '1' } as any,
  { id: 'PORT-BETA',   name: 'Beta Port',   country: 'YY', position: { latitude: 51.5, longitude:  5.0 }, sourceId: '2' } as any,
  { id: 'PORT-GAMMA',  name: 'Gamma Port',  country: 'ZZ', position: { latitude: 48.0, longitude:  2.0 }, sourceId: '3' } as any,
]);

builder.addEdges([
  { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-BETA',  minimumCapability: VesselCapability.B },
  { fromPortId: 'PORT-BETA',  toPortId: 'PORT-ALPHA', minimumCapability: VesselCapability.B },
  { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-GAMMA', minimumCapability: VesselCapability.A },
  { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-ALPHA', minimumCapability: VesselCapability.A },
  { fromPortId: 'PORT-BETA',  toPortId: 'PORT-GAMMA', minimumCapability: VesselCapability.A },
  { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-BETA',  minimumCapability: VesselCapability.A },
]);

const network = builder.build();
console.log(`\n✓ Network built: ${network.nodes.size} nodes, ${network.edges.size} edges\n`);

// ── 2. Inject cargo via the demand interface ───────────────────────────────
const demandProvider = new StaticDemandProvider([
  { requestId: 'CARGO-001', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity: 100, earliestDeparture: 0, deadline: 200, cargoType: 'GENERAL' },
  { requestId: 'CARGO-002', origin: 'node-PORT-ALPHA', destination: 'node-PORT-GAMMA', quantity:  50, earliestDeparture: 0, deadline: 200, cargoType: 'GENERAL' },
  { requestId: 'CARGO-003', origin: 'node-PORT-BETA',  destination: 'node-PORT-ALPHA', quantity: 200, earliestDeparture: 0, deadline: 300, cargoType: 'GENERAL' },
  { requestId: 'CARGO-004', origin: 'node-PORT-GAMMA', destination: 'node-PORT-BETA',  quantity:  75, earliestDeparture: 0, deadline: 300, cargoType: 'GENERAL' },
  { requestId: 'CARGO-005', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity:  30, earliestDeparture: 0, deadline: 400, cargoType: 'GENERAL' },
]);

const adapter = new DemandAdapter();
const cargoes = adapter.toBatch(demandProvider.getCargoRequests());

// ── 3. Define vessels ──────────────────────────────────────────────────────
const vessels = [
  { id: 'VESSEL-001', capability: VesselCapability.C, startNodeId: 'node-PORT-ALPHA' },
  { id: 'VESSEL-002', capability: VesselCapability.B, startNodeId: 'node-PORT-ALPHA' },
  { id: 'VESSEL-003', capability: VesselCapability.D, startNodeId: 'node-PORT-BETA'  },
];

// ── 4. Run simulation ──────────────────────────────────────────────────────
const engine = new SimulationEngine();
engine.initialize({ vessels, cargoes, network });

console.log('─'.repeat(70));
console.log('  RYCON SIMULATION — RUNNING');
console.log('─'.repeat(70));

const result = engine.run();

// ── 5. Print event log ─────────────────────────────────────────────────────
console.log(`\n  EVENT LOG (${result.events.length} events)\n`);
console.log('  TIME(h)   TYPE                   VESSEL/CARGO       LOCATION');
console.log('  ' + '─'.repeat(66));

for (const ev of result.events) {
  const time   = ev.simulationTime.toFixed(2).padStart(7);
  const type   = ev.eventType.padEnd(22);
  const entity = ev.entityId.padEnd(18);
  const loc    = ev.locationNodeId.replace('node-', '');
  console.log(`  ${time}h  ${type} ${entity} @ ${loc}`);
}

// ── 6. Final states ────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(70));
console.log('  FINAL CARGO STATES\n');
for (const [id, state] of result.finalCargoStates) {
  const icon = state.status === 'DELIVERED' ? '✓' : '✗';
  console.log(`  ${icon} ${id.padEnd(12)} → ${state.status}`);
}

console.log('\n  FINAL VESSEL STATES\n');
for (const [id, state] of result.finalVesselStates) {
  const icon = state.status === 'IDLE' ? '✓' : '⚠';
  console.log(`  ${icon} ${id.padEnd(12)} → ${state.status}  (now at ${state.currentNodeId.replace('node-', '')})`);
}

console.log('\n' + '─'.repeat(70));
console.log(`  Total simulated time: ${result.totalSimulatedHours.toFixed(2)} hours`);

const allDelivered  = [...result.finalCargoStates.values()].every(c => c.status === 'DELIVERED');
const allIdle       = [...result.finalVesselStates.values()].every(v => v.status === 'IDLE');
const timesOrdered  = (() => {
  const t = result.events.map(e => e.simulationTime);
  return t.every((v, i) => i === 0 || v >= t[i - 1]);
})();

console.log('\n  ACCEPTANCE CRITERIA\n');
console.log(`  ${allDelivered  ? '✓' : '✗'} All cargo DELIVERED`);
console.log(`  ${allIdle       ? '✓' : '✗'} All vessels IDLE`);
console.log(`  ${timesOrdered  ? '✓' : '✗'} Events chronologically ordered`);
console.log('\n' + '─'.repeat(70) + '\n');
