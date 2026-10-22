import { FixedScenarioGenerator, InMemoryDemandSupplyStore } from '@rycon/ds-system';
import { setSelectedScenarioPlan } from './maritime/activeScenario.js';

const scenarioGenerator = new FixedScenarioGenerator();
const scenarioSeed = scenarioGenerator.generate({ fleetCount: 1, scenarioId: 'NEXT-STOP-10' });
const scenarioPorts = [...new Set(scenarioSeed.cargoDemands.flatMap(demand => [demand.origin, demand.destination]))];
const initialScenario = scenarioGenerator.generate({ fleetCount: scenarioPorts.length * 2, scenarioId: 'NEXT-STOP-10' });
setSelectedScenarioPlan(initialScenario);
// Start every port participating in this scenario with two docked vessels.
// The simulation engine can dispatch them when cargo demand requires it.
const initialVessels = scenarioPorts.flatMap(portNodeId => [portNodeId, portNodeId]);

const fleet = initialVessels.map((_, index) => {
  const vesselType = (['CONTAINER', 'BULK_CARRIER', 'TANKER', 'GENERAL_CARGO', 'REEFER'] as const)[index % 5];
  const deadweightTonnes = [18000, 52000, 76000, 24000, 32000][index % 5];
  const fuelCapacityTonnes = [1500, 2100, 2800, 1300, 1700][index % 5];
  const portNodeId = initialVessels[index];
  return {
    id: `RYC-MER-${String(index + 1).padStart(3, '0')}`,
    capability: index < 30
      ? (['D', 'E', 'C'] as const)[index % 3]
      : (['B', 'C', 'D', 'E', 'E'] as const)[index % 5],
    startNodeId: portNodeId,
    vesselType,
    deadweightTonnes,
    fuelCapacityTonnes,
    fuelRemainingTonnes: Math.round(fuelCapacityTonnes * (0.68 + (index % 4) * 0.08)),
    fuelBurnTonnesPerHour: [0.19, 0.22, 0.3, 0.16, 0.2][index % 5],
  };
});

export const dsStore = new InMemoryDemandSupplyStore(initialScenario.cargoDemands, fleet);
export { initialScenario };
