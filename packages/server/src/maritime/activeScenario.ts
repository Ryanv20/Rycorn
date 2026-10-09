import type { ScenarioNetwork } from './ScenarioNetwork.js';
import type { ScenarioPlan } from '@rycon/ds-system';

let activeScenario: ScenarioNetwork | null = null;
let selectedScenarioPlan: ScenarioPlan | null = null;

export function setActiveScenario(scenario: ScenarioNetwork): void {
  activeScenario = scenario;
}

export function mergeActiveScenario(scenario: ScenarioNetwork, replaceRouteRequestIds: readonly string[] = []): void {
  if (!activeScenario) {
    activeScenario = scenario;
    return;
  }

  for (const [nodeId, node] of scenario.network.nodes) {
    if (!activeScenario.network.nodes.has(nodeId)) activeScenario.network.nodes.set(nodeId, node);
    if (!activeScenario.network.adjacency.has(nodeId)) activeScenario.network.adjacency.set(nodeId, []);
  }
  for (const [edgeId, edge] of scenario.network.edges) {
    if (activeScenario.network.edges.has(edgeId)) continue;
    activeScenario.network.edges.set(edgeId, edge);
    const fromEdges = activeScenario.network.adjacency.get(edge.fromNodeId) ?? [];
    fromEdges.push(edgeId);
    activeScenario.network.adjacency.set(edge.fromNodeId, fromEdges);
  }
  if (replaceRouteRequestIds.length > 0) {
    const replaced = new Set(replaceRouteRequestIds);
    activeScenario.plannedRoutes = activeScenario.plannedRoutes.filter(route => !replaced.has(route.requestId));
  }
  activeScenario.plannedRoutes.push(...scenario.plannedRoutes);
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
