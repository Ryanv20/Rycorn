import type { ScenarioNetwork } from './ScenarioNetwork.js';
import type { ScenarioPlan } from '@rycon/ds-system';

let activeScenario: ScenarioNetwork | null = null;
let selectedScenarioPlan: ScenarioPlan | null = null;

export function setActiveScenario(scenario: ScenarioNetwork): void {
  activeScenario = scenario;
}

export function getActiveScenario(): ScenarioNetwork | null {
  return activeScenario;
}

export function setSelectedScenarioPlan(plan: ScenarioPlan): void {
  selectedScenarioPlan = plan;
}

export function getSelectedScenarioPlan(): ScenarioPlan | null {
  return selectedScenarioPlan;
}