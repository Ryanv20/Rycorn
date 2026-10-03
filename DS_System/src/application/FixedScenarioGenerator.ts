import type { CargoDemand } from '../domain/CargoDemand.js';
import { scenarioPlanSchema, type ScenarioPlan } from '../domain/ScenarioPlan.js';

const tradeFlows = [
  { id: 'FLOW-001', origin: '19WPI-16080', destination: '19WPI-16300', quantity: 1800, cargoType: 'CONTAINERIZED_GOODS', reason: 'Models coastal container replenishment between Los Angeles and San Francisco.' },
  { id: 'FLOW-002', origin: '19WPI-16080', destination: '19WPI-17730', quantity: 2400, cargoType: 'CONTAINERIZED_GOODS', reason: 'Models Pacific coast cargo replenishment between Los Angeles and Seattle.' },
  { id: 'FLOW-003', origin: '19WPI-18150', destination: '19WPI-17730', quantity: 900, cargoType: 'GENERAL', reason: 'Models regional cargo movement between Vancouver and Seattle.' },
  { id: 'FLOW-004', origin: '19WPI-53650', destination: '19WPI-55060', quantity: 1300, cargoType: 'CONTAINERIZED_GOODS', reason: 'Models an Oceania replenishment lane between Sydney and Auckland.' },
  { id: 'FLOW-005', origin: '19WPI-53650', destination: '19WPI-55320', quantity: 700, cargoType: 'GENERAL', reason: 'Models regional cargo movement between Sydney and Lyttelton.' },
  { id: 'FLOW-006', origin: '19WPI-53490', destination: '19WPI-53650', quantity: 1200, cargoType: 'GENERAL', reason: 'Models Australian east-coast distribution between Brisbane and Sydney.' },
  { id: 'FLOW-007', origin: '19WPI-53490', destination: '19WPI-55060', quantity: 1100, cargoType: 'CONTAINERIZED_GOODS', reason: 'Models Australia-to-New Zealand regional container replenishment.' },
  { id: 'FLOW-008', origin: '19WPI-50000', destination: '19WPI-57840', quantity: 2100, cargoType: 'CONTAINERIZED_GOODS', reason: 'Models Southeast Asian regional shipping between Singapore and Hong Kong.' },
  { id: 'FLOW-009', origin: '19WPI-46820', destination: '19WPI-46850', quantity: 800, cargoType: 'GENERAL', reason: 'Models southern African coastal distribution between Gqeberha and Durban.' },
  { id: 'FLOW-010', origin: '19WPI-48840', destination: '19WPI-46850', quantity: 1600, cargoType: 'RAW_MATERIALS', reason: 'Models an Indian Ocean supply lane between Mumbai and Durban.' },
] as const;

const scenarioDefinitions = [
  { id: 'NEXT-STOP-01', name: 'Pacific Coast Replenishment', summary: 'Three verified North American Pacific coast movements.', flows: [0, 1, 2] },
  { id: 'NEXT-STOP-02', name: 'Oceania Coastal Supply', summary: 'Four verified Australian and New Zealand regional movements.', flows: [3, 4, 5, 6] },
  { id: 'NEXT-STOP-03', name: 'Southern Africa Distribution', summary: 'Coastal distribution and Indian Ocean supply into Durban.', flows: [8, 9] },
  { id: 'NEXT-STOP-04', name: 'Singapore–Hong Kong Shuttle', summary: 'A focused Southeast Asian container replenishment service.', flows: [7] },
  { id: 'NEXT-STOP-05', name: 'Pacific Port Pair Study', summary: 'Compare three Pacific coast port pairs under one operating plan.', flows: [0, 1, 2] },
  { id: 'NEXT-STOP-06', name: 'Australia–New Zealand Service', summary: 'A two-lane Oceania service with staggered departures.', flows: [3, 6] },
  { id: 'NEXT-STOP-07', name: 'Indian Ocean Supply', summary: 'A WPI-backed Indian Ocean origin and destination pair.', flows: [9] },
  { id: 'NEXT-STOP-08', name: 'Southern Ports Service', summary: 'Southern Africa and Oceania coastal movements.', flows: [4, 5, 8] },
  { id: 'NEXT-STOP-09', name: 'Regional Fleet Stress Test', summary: 'All ten verified route legs operated concurrently.', flows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'NEXT-STOP-10', name: 'Continuous Trade Loop', summary: 'Repeats the verified global scenario indefinitely, issuing a new demand cycle after each completed batch.', flows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], continuous: true },
] as const;

export class FixedScenarioGenerator {
  list() {
    return scenarioDefinitions.map(({ id, name, summary, flows, continuous = false }, index) => ({
      id,
      number: index + 1,
      name,
      summary,
      flowCount: flows.length,
      continuous,
    }));
  }

  generate(options: { fleetCount: number; scenarioId?: string; generatedAt?: Date }): ScenarioPlan {
    const generatedAt = options.generatedAt ?? new Date();
    const scenario = scenarioDefinitions.find(item => item.id === (options.scenarioId ?? scenarioDefinitions[0].id)) ?? scenarioDefinitions[0];
    const selectedFlows = scenario.flows.map(index => tradeFlows[index]);
    const cargoDemands: CargoDemand[] = selectedFlows.map((flow, index) => ({
      requestId: `${scenario.id}-${flow.id}`,
      origin: `node-${flow.origin}`,
      destination: `node-${flow.destination}`,
      quantity: flow.quantity,
      earliestDeparture: index * 0.25,
      deadline: 24 * (7 + (index % 8)),
      cargoType: flow.cargoType,
      status: 'PENDING',
    }));

    return scenarioPlanSchema.parse({
      id: scenario.id,
      name: `Next Stop: ${scenario.name}`,
      generatedAt: generatedAt.toISOString(),
      generationMode: 'FIXED_RULES',
      summary: scenario.summary,
      rationale: selectedFlows.map(flow => `${flow.id}: ${flow.reason}`),
      assumptions: [
        'Demand quantities are illustrative scenario inputs, not current bookings or measured throughput.',
        'The 100-vessel fleet is synthetic simulation supply with varied vessel types and WPI port starting locations.',
        'Cargo categories and deadlines are fixed rules for this scenario and can be replaced by a future Gemini-backed generator.',
      ],
      limitations: [
        'Route previews are visualization aids from a generalized sea-lane graph; they are not navigational advice.',
        'No live AIS, inventory, order book, or market feed is connected.',
        'Gemini integration is not enabled and no model token is required or stored.',
      ],
      sourceNote: 'Port identities use NGA World Port Index canonical IDs. Trade explanations are fixed human-authored scenario assumptions, not claims of real-time trade intelligence.',
      cargoDemands,
      fleetCount: options.fleetCount,
      continuous: 'continuous' in scenario ? scenario.continuous : false,
      routePreviewOnly: true,
    });
  }
}