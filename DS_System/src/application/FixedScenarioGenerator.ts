import type { CargoDemand } from '../domain/CargoDemand.js';
import { scenarioPlanSchema, type ScenarioPlan } from '../domain/ScenarioPlan.js';

interface TradeFlow {
  id: string;
  laneId: string;
  origin: string;
  destination: string;
  quantity: number;
  cargoType: string;
  originRegionId: string;
  destinationRegionId: string;
  reason: string;
}

const tradeFlows: TradeFlow[] = [
  { id: 'FLOW-001', laneId: 'PACIFIC-COAST', origin: '19WPI-16080', destination: '19WPI-16300', quantity: 1800, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'north-america', destinationRegionId: 'north-america', reason: 'Illustrative coastal container replenishment between Los Angeles and San Francisco.' },
  { id: 'FLOW-002', laneId: 'PACIFIC-COAST', origin: '19WPI-16080', destination: '19WPI-17730', quantity: 2400, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'north-america', destinationRegionId: 'north-america', reason: 'Illustrative Pacific coast replenishment between Los Angeles and Seattle.' },
  { id: 'FLOW-003', laneId: 'PACIFIC-COAST', origin: '19WPI-18150', destination: '19WPI-17730', quantity: 900, cargoType: 'GENERAL', originRegionId: 'north-america', destinationRegionId: 'north-america', reason: 'Illustrative regional cargo movement between Vancouver and Seattle.' },
  { id: 'FLOW-004', laneId: 'OCEANIA-SERVICE', origin: '19WPI-53650', destination: '19WPI-55060', quantity: 1300, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'oceania', destinationRegionId: 'oceania', reason: 'Illustrative Oceania replenishment lane between Sydney and Auckland.' },
  { id: 'FLOW-005', laneId: 'OCEANIA-SERVICE', origin: '19WPI-53650', destination: '19WPI-55320', quantity: 700, cargoType: 'GENERAL', originRegionId: 'oceania', destinationRegionId: 'oceania', reason: 'Illustrative regional cargo movement between Sydney and Lyttelton.' },
  { id: 'FLOW-006', laneId: 'OCEANIA-COASTAL', origin: '19WPI-53490', destination: '19WPI-53650', quantity: 1200, cargoType: 'GENERAL', originRegionId: 'oceania', destinationRegionId: 'oceania', reason: 'Illustrative Australian east-coast distribution between Brisbane and Sydney.' },
  { id: 'FLOW-007', laneId: 'OCEANIA-SERVICE', origin: '19WPI-53490', destination: '19WPI-55060', quantity: 1100, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'oceania', destinationRegionId: 'oceania', reason: 'Illustrative Australia-to-New Zealand regional container replenishment.' },
  { id: 'FLOW-008', laneId: 'ASIA-REGIONAL', origin: '19WPI-50000', destination: '19WPI-57840', quantity: 2100, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'east-southeast-asia', destinationRegionId: 'east-southeast-asia', reason: 'Illustrative Southeast Asian regional shipping between Singapore and Hong Kong.' },
  { id: 'FLOW-009', laneId: 'SOUTHERN-AFRICA', origin: '19WPI-46820', destination: '19WPI-46850', quantity: 800, cargoType: 'GENERAL', originRegionId: 'africa', destinationRegionId: 'africa', reason: 'Illustrative southern African coastal distribution between Gqeberha and Durban.' },
  { id: 'FLOW-010', laneId: 'INDIAN-OCEAN', origin: '19WPI-48840', destination: '19WPI-46850', quantity: 1600, cargoType: 'RAW_MATERIALS', originRegionId: 'south-asia', destinationRegionId: 'africa', reason: 'Illustrative Indian Ocean supply movement between Mumbai and Durban.' },
];

const globalLanePairs: Array<Omit<TradeFlow, 'id' | 'origin' | 'destination' | 'originRegionId' | 'destinationRegionId'> & {
  origin: string;
  destination: string;
  originRegionId: string;
  destinationRegionId: string;
}> = [
  { laneId: 'PACIFIC-ASIA', origin: '19WPI-16080', destination: '19WPI-59970', quantity: 75, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'north-america', destinationRegionId: 'east-southeast-asia', reason: 'Illustrative trans-Pacific exchange between Los Angeles and Shanghai.' },
  { laneId: 'NORTH-ATLANTIC', origin: '19WPI-7640', destination: '19WPI-31140', quantity: 70, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'north-america', destinationRegionId: 'europe', reason: 'Illustrative North Atlantic exchange between New York and Rotterdam.' },
  { laneId: 'PANAMA-CANAL-ALTERNATIVE', origin: '19WPI-16080', destination: '19WPI-7640', quantity: 35, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'north-america', destinationRegionId: 'north-america', reason: 'Illustrative U.S. coast-to-coast repositioning lane connecting Pacific and Atlantic services.' },
  { laneId: 'SOUTH-ATLANTIC', origin: '19WPI-12970', destination: '19WPI-31140', quantity: 55, cargoType: 'RAW_MATERIALS', originRegionId: 'south-america', destinationRegionId: 'europe', reason: 'Illustrative South Atlantic exchange between Santos and Rotterdam.' },
  { laneId: 'EUROPE-WEST-AFRICA', origin: '19WPI-31140', destination: '19WPI-46130', quantity: 55, cargoType: 'GENERAL', originRegionId: 'europe', destinationRegionId: 'africa', reason: 'Illustrative Europe–West Africa exchange between Rotterdam and Lagos, Nigeria.' },
  { laneId: 'INDIAN-OCEAN', origin: '19WPI-46850', destination: '19WPI-48840', quantity: 60, cargoType: 'RAW_MATERIALS', originRegionId: 'africa', destinationRegionId: 'south-asia', reason: 'Illustrative Indian Ocean exchange between Durban and Mumbai.' },
  { laneId: 'GULF-SOUTH-ASIA', origin: '19WPI-48276', destination: '19WPI-48840', quantity: 50, cargoType: 'ENERGY', originRegionId: 'middle-east', destinationRegionId: 'south-asia', reason: 'Illustrative Gulf–South Asia energy and goods movement between Jabal Ali and Mumbai.' },
  { laneId: 'SOUTHEAST-ASIA', origin: '19WPI-50000', destination: '19WPI-59970', quantity: 80, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'east-southeast-asia', destinationRegionId: 'east-southeast-asia', reason: 'Illustrative Asian regional exchange between Singapore and Shanghai.' },
  { laneId: 'ASIA-EUROPE', origin: '19WPI-31140', destination: '19WPI-50000', quantity: 65, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'europe', destinationRegionId: 'east-southeast-asia', reason: 'Illustrative Asia–Europe exchange between Rotterdam and Singapore.' },
  { laneId: 'ASIA-OCEANIA', origin: '19WPI-59970', destination: '19WPI-53650', quantity: 50, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'east-southeast-asia', destinationRegionId: 'oceania', reason: 'Illustrative Asia–Oceania exchange between Shanghai and Sydney.' },
  { laneId: 'OCEANIA-SERVICE', origin: '19WPI-53650', destination: '19WPI-55060', quantity: 45, cargoType: 'GENERAL', originRegionId: 'oceania', destinationRegionId: 'oceania', reason: 'Illustrative regional exchange between Sydney and Auckland.' },
  { laneId: 'WEST-AFRICA-COASTAL', origin: '19WPI-46130', destination: '19WPI-46000', quantity: 40, cargoType: 'GENERAL', originRegionId: 'africa', destinationRegionId: 'africa', reason: 'Illustrative West African coastal exchange between Lagos and Abidjan.' },
  { laneId: 'SOUTH-ASIA-REGIONAL', origin: '19WPI-48840', destination: '19WPI-49450', quantity: 45, cargoType: 'GENERAL', originRegionId: 'south-asia', destinationRegionId: 'south-asia', reason: 'Illustrative Indian Ocean regional exchange between Mumbai and Chennai.' },
  { laneId: 'EAST-ASIA-REGIONAL', origin: '19WPI-59970', destination: '19WPI-61380', quantity: 55, cargoType: 'CONTAINERIZED_GOODS', originRegionId: 'east-southeast-asia', destinationRegionId: 'east-southeast-asia', reason: 'Illustrative East Asian regional exchange between Shanghai and Tokyo.' },
];

const globalTradeFlows: TradeFlow[] = globalLanePairs.flatMap((lane, index) => [
  { ...lane, id: `GLOBAL-${String(index + 1).padStart(2, '0')}-OUT` },
  {
    ...lane,
    id: `GLOBAL-${String(index + 1).padStart(2, '0')}-BACK`,
    origin: lane.destination,
    destination: lane.origin,
    originRegionId: lane.destinationRegionId,
    destinationRegionId: lane.originRegionId,
    reason: `${lane.reason} The reciprocal leg balances the modeled service cycle.`,
  },
]);

const regionLabels: Record<string, string> = {
  'north-america': 'North America & Caribbean',
  'south-america': 'South America',
  europe: 'Europe & Mediterranean',
  africa: 'Africa',
  'middle-east': 'Middle East & Gulf',
  'south-asia': 'South Asia',
  'east-southeast-asia': 'East & Southeast Asia',
  oceania: 'Oceania & Pacific Islands',
};

const scenarioDefinitions = [
  { id: 'NEXT-STOP-01', name: 'Pacific Coast Replenishment', summary: 'Three illustrative North American Pacific coast movements.', flows: [0, 1, 2] },
  { id: 'NEXT-STOP-02', name: 'Oceania Coastal Supply', summary: 'Four illustrative Australian and New Zealand regional movements.', flows: [3, 4, 5, 6] },
  { id: 'NEXT-STOP-03', name: 'Southern Africa Distribution', summary: 'Coastal distribution and Indian Ocean supply into Durban.', flows: [8, 9] },
  { id: 'NEXT-STOP-04', name: 'Singapore–Hong Kong Shuttle', summary: 'A focused Southeast Asian container replenishment service.', flows: [7] },
  { id: 'NEXT-STOP-05', name: 'Pacific Port Pair Study', summary: 'Compare three Pacific coast port pairs under one operating plan.', flows: [0, 1, 2] },
  { id: 'NEXT-STOP-06', name: 'Australia–New Zealand Service', summary: 'A two-lane Oceania service with staggered departures.', flows: [3, 6] },
  { id: 'NEXT-STOP-07', name: 'Indian Ocean Supply', summary: 'An illustrative WPI-backed Indian Ocean origin and destination pair.', flows: [9] },
  { id: 'NEXT-STOP-08', name: 'Southern Ports Service', summary: 'Southern Africa and Oceania coastal movements.', flows: [4, 5, 8] },
  { id: 'NEXT-STOP-09', name: 'Regional Fleet Stress Test', summary: 'All ten illustrative regional route legs operated concurrently.', flows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'NEXT-STOP-10', name: 'Global Trade System Loop', summary: 'A continuous, balanced cycle of illustrative trade lanes linking the major maritime regions.', flows: [], continuous: true, globalTrade: true },
] as const;

export class FixedScenarioGenerator {
  list() {
    return scenarioDefinitions.map(({ id, name, summary, flows, continuous = false }, index) => ({
      id,
      number: index + 1,
      name,
      summary,
      flowCount: id === 'NEXT-STOP-10' ? globalTradeFlows.length : flows.length,
      continuous,
      regionCount: id === 'NEXT-STOP-10' ? 8 : new Set(flows.flatMap(flowIndex => [tradeFlows[flowIndex].originRegionId, tradeFlows[flowIndex].destinationRegionId])).size,
    }));
  }

  generate(options: { fleetCount: number; scenarioId?: string; generatedAt?: Date }): ScenarioPlan {
    const generatedAt = options.generatedAt ?? new Date();
    const scenario = scenarioDefinitions.find(item => item.id === (options.scenarioId ?? scenarioDefinitions[0].id)) ?? scenarioDefinitions[0];
    const isGlobalTrade = 'globalTrade' in scenario && scenario.globalTrade;
    const selectedFlows = 'globalTrade' in scenario && scenario.globalTrade
      ? globalTradeFlows
      : scenario.flows.map(index => tradeFlows[index]);
    const cargoDemands: CargoDemand[] = selectedFlows.map((flow, index) => ({
      requestId: `${scenario.id}-${flow.id}`,
      origin: `node-${flow.origin}`,
      destination: `node-${flow.destination}`,
      quantity: flow.quantity,
      earliestDeparture: index * 0.25,
      deadline: 24 * (isGlobalTrade ? 45 + (index % 15) : 7 + (index % 8)),
      cargoType: flow.cargoType,
      originRegionId: flow.originRegionId,
      destinationRegionId: flow.destinationRegionId,
      tradeLaneId: flow.laneId,
      status: 'PENDING',
    }));
    const regionTotals = new Map<string, { flowCount: number; modelUnits: number }>();
    for (const flow of selectedFlows) {
      const current = regionTotals.get(flow.originRegionId) ?? { flowCount: 0, modelUnits: 0 };
      current.flowCount += 1;
      current.modelUnits += flow.quantity;
      regionTotals.set(flow.originRegionId, current);
    }

    return scenarioPlanSchema.parse({
      id: scenario.id,
      name: `Next Stop: ${scenario.name}`,
      generatedAt: generatedAt.toISOString(),
      generationMode: 'FIXED_RULES',
      summary: scenario.summary,
      rationale: selectedFlows.map(flow => `${flow.id}: ${flow.reason}`),
      assumptions: [
        'Volumes are model units for comparing scenarios, not observed tonnage, trade value, or current bookings.',
        'The global loop balances the two directions of each illustrative lane so the synthetic fleet can continue moving between service ports.',
        'The fleet is synthetic simulation supply distributed across the selected trade-lane hubs.',
        'Voyage durations include repeatable seeded weather, daytime congestion, and port-handling delay sensitivities; these are not live condition reports.',
        'Cycle-to-cycle volume variation is a bounded sensitivity setting, not a forecast.',
      ],
      limitations: [
        'WPI provides port identities and locations, not trade volumes or origin-destination matrices.',
        'Trade-lane choices and demand weights are human-authored model assumptions; there is no live AIS, order book, customs, or market feed.',
        'Any demand still unassigned when a continuous cycle closes is reported as failed for that cycle so it does not silently roll into the next one.',
        'Sea routes are generalized visualization and simulation paths, not navigational advice.',
        'Regional groupings are Rycon market regions based on port country and are not official economic or customs boundaries.',
      ],
      sourceNote: 'Port identities and coordinates use the NGA World Port Index. Flow relationships and model volumes are illustrative assumptions, not claims of observed global trade.',
      regionBreakdown: [...regionTotals].map(([regionId, totals]) => ({
        regionId,
        regionName: regionLabels[regionId] ?? regionId,
        ...totals,
      })),
      cycleModel: 'continuous' in scenario && scenario.continuous ? {
        label: 'Continuous balanced trade cycle',
        volumeVariationPercent: 10,
        note: 'Each completed cycle issues the same regional lanes with a deterministic ±10% sensitivity adjustment and advances the modeled clock.',
      } : undefined,
      cargoDemands,
      fleetCount: options.fleetCount,
      continuous: 'continuous' in scenario ? scenario.continuous : false,
      routePreviewOnly: true,
    });
  }
}
