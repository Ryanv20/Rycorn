import { FixedScenarioGenerator, InMemoryDemandSupplyStore } from '@rycon/ds-system';
import { setSelectedScenarioPlan } from './maritime/activeScenario.js';

const initialScenario = new FixedScenarioGenerator().generate({ fleetCount: 100, scenarioId: 'NEXT-STOP-10' });
setSelectedScenarioPlan(initialScenario);
const scenarioOrigins = [...new Set(initialScenario.cargoDemands.map(demand => demand.origin.slice('node-'.length)))];
const initialVessels = Array.from(
  { length: initialScenario.fleetCount },
  (_, index) => scenarioOrigins[index % scenarioOrigins.length],
);

const fleet = initialVessels.slice(0, initialScenario.fleetCount).map((portId, index) => {
  const vesselType = (['CONTAINER', 'BULK_CARRIER', 'TANKER', 'GENERAL_CARGO', 'REEFER'] as const)[index % 5];
  const deadweightTonnes = [18000, 52000, 76000, 24000, 32000][index % 5];
  const fuelCapacityTonnes = [1500, 2100, 2800, 1300, 1700][index % 5];
  return {
    id: `RYC-MER-${String(index + 1).padStart(3, '0')}`,
    capability: index < 30
      ? (['D', 'E', 'C'] as const)[index % 3]
      : (['B', 'C', 'D', 'E', 'E'] as const)[index % 5],
    startNodeId: `node-${portId}`,
    vesselType,
    deadweightTonnes,
    fuelCapacityTonnes,
    fuelRemainingTonnes: Math.round(fuelCapacityTonnes * (0.68 + (index % 4) * 0.08)),
    fuelBurnTonnesPerHour: [0.19, 0.22, 0.3, 0.16, 0.2][index % 5],
  };
});

export const dsStore = new InMemoryDemandSupplyStore(initialScenario.cargoDemands, fleet);
export { initialScenario };
