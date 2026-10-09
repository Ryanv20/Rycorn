import { createRequire } from 'node:module';
import { MaritimeNetwork, VesselCapability } from '@rycon/engine';
import type { CargoDemand } from '@rycon/ds-system';
import type { EdgeId, NetworkEdge, NetworkNode } from '@rycon/engine';
import type { NodeId } from '@rycon/engine';
import { getCanonicalPorts, getPortByNodeId, type CanonicalPortRecord } from '../data/portCatalog.js';
import { screenNetworkEdgesAgainstLand } from './CoastlineScreen.js';
import { getTradeRegionId } from './TradeRegions.js';

interface SeaRouteFeature {
  type: 'Feature';
  properties: { length?: number; units?: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

type SeaRouteFunction = (origin: unknown, destination: unknown, units?: string) => SeaRouteFeature | null;
const require = createRequire(import.meta.url);
const seaRoute = require('searoute-js') as SeaRouteFunction;

export interface PlannedRoute {
  requestId: string;
  originPortId: string;
  destinationPortId: string;
  originName: string;
  destinationName: string;
  originRegionId: string;
  destinationRegionId: string;
  distanceKm: number;
  pathNodeIds: string[];
  coordinates: [number, number][];
  coastlineScreen: { clear: boolean; dataset: string; warning?: string };
  previewOnly: true;
}

export interface ScenarioNetwork {
  network: MaritimeNetwork;
  plannedRoutes: PlannedRoute[];
}

function distanceKm(from: [number, number], to: [number, number]): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[1] - from[1]) * radians;
  const longitudeDelta = (to[0] - from[0]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function addNode(network: MaritimeNetwork, node: NetworkNode): void {
  network.nodes.set(node.id, node);
  if (!network.adjacency.has(node.id)) network.adjacency.set(node.id, []);
}

function addBidirectionalEdge(network: MaritimeNetwork, from: NetworkNode, to: NetworkNode, id: string): void {
  const distance = distanceKm(
    [from.position.longitude, from.position.latitude],
    [to.position.longitude, to.position.latitude],
  );
  const forwardId = `${id}-FWD` as EdgeId;
  const reverseId = `${id}-REV` as EdgeId;
  const forward: NetworkEdge = {
    id: forwardId,
    fromNodeId: from.id,
    toNodeId: to.id,
    distanceKm: distance,
    minimumVesselCapability: VesselCapability.A,
  };
  const reverse: NetworkEdge = {
    id: reverseId,
    fromNodeId: to.id,
    toNodeId: from.id,
    distanceKm: distance,
    minimumVesselCapability: VesselCapability.A,
  };
  network.edges.set(forwardId, forward);
  network.edges.set(reverseId, reverse);
  network.adjacency.get(from.id)!.push(forwardId);
  network.adjacency.get(to.id)!.push(reverseId);
}

function toFeature(port: CanonicalPortRecord) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [port.longitude, port.latitude] },
  };
}

function stableRouteId(requestId: string): string {
  return requestId.replace(/[^A-Za-z0-9-]/g, '-');
}

export async function buildScenarioNetwork(
  demands: readonly CargoDemand[],
  vesselPortNodeIds: readonly string[] = [],
  routeIdentitySuffix = '',
): Promise<ScenarioNetwork> {
  const network = new MaritimeNetwork();
  const routePlans: Array<Omit<PlannedRoute, 'coastlineScreen'>> = [];
  const portNodes = new Map<string, NetworkNode>();
  const portConnectorPairs = new Set<string>();
  const endpointApproachExemptions = new Map<string, { fromStartKm: number; fromEndKm: number }>();

  const getOrAddPortNode = (port: CanonicalPortRecord): NetworkNode => {
    const existing = portNodes.get(port.portId);
    if (existing) return existing;
    const node: NetworkNode = {
      id: `node-${port.portId}` as NodeId,
      type: 'PORT',
      position: { latitude: port.latitude, longitude: port.longitude },
      portId: port.portId as NetworkNode['portId'],
    };
    addNode(network, node);
    portNodes.set(port.portId, node);
    return node;
  };

  const demandPortNodes = [...new Set(demands.flatMap(demand => [demand.origin, demand.destination]))];
  const additionalVesselPortNodes = [...new Set(vesselPortNodeIds)].filter(nodeId => !demandPortNodes.includes(nodeId));
  const anchorNodeId = demandPortNodes[0] ?? additionalVesselPortNodes[0];
  const connectorDestinations = demandPortNodes.length > 0
    ? additionalVesselPortNodes
    : additionalVesselPortNodes.slice(1);
  const connectorDemands: CargoDemand[] = anchorNodeId
    ? connectorDestinations.map((destination, index) => ({
      requestId: `NETWORK-CONNECTOR-${String(index + 1).padStart(3, '0')}`,
      origin: anchorNodeId,
      destination,
      quantity: 1,
      earliestDeparture: 0,
      deadline: 1,
      cargoType: 'GENERAL',
      status: 'PENDING',
    }))
    : [];
  const connectorIds = new Set(connectorDemands.map(demand => demand.requestId));
  for (const nodeId of vesselPortNodeIds) {
    const port = getPortByNodeId(nodeId);
    if (!port) throw new Error(`Fleet references an unknown WPI port at ${nodeId}`);
    getOrAddPortNode(port);
  }

  for (const demand of [...demands, ...connectorDemands]) {
    const origin = getPortByNodeId(demand.origin);
    const destination = getPortByNodeId(demand.destination);
    if (!origin || !destination) throw new Error(`Scenario ${demand.requestId} references an unknown WPI port`);

    const seaLine = seaRoute(toFeature(origin), toFeature(destination), 'kilometers');
    if (!seaLine || seaLine.geometry.coordinates.length < 2) {
      throw new Error(`No generalized sea-lane path found for ${demand.requestId}`);
    }
    const coordinates = seaLine.geometry.coordinates;
    const originNode = getOrAddPortNode(origin);
    const destinationNode = getOrAddPortNode(destination);
    const routeId = stableRouteId(routeIdentitySuffix ? `${demand.requestId}-${routeIdentitySuffix}` : demand.requestId);
    const intermediateNodes: NetworkNode[] = coordinates.map((coordinate, index) => {
      const [longitude, latitude] = coordinate;
      const node: NetworkNode = {
        id: `sea-${routeId}-${index}` as NodeId,
        type: 'INTERMEDIATE',
        position: { latitude, longitude },
      };
      addNode(network, node);
      return node;
    });
    const path = [originNode, ...intermediateNodes, destinationNode];

    const routeSegmentLengths = path.slice(1).map((node, index) => distanceKm(
      [path[index].position.longitude, path[index].position.latitude],
      [node.position.longitude, node.position.latitude],
    ));
    const routeDistanceKm = routeSegmentLengths.reduce((total, length) => total + length, 0);
    let distanceFromOriginKm = 0;

    for (let index = 0; index < path.length - 1; index += 1) {
      addBidirectionalEdge(network, path[index], path[index + 1], `route-${routeId}-${index}`);
      const length = routeSegmentLengths[index];
      const pair = [path[index].id, path[index + 1].id].sort().join('|');
      endpointApproachExemptions.set(pair, {
        fromStartKm: Math.max(0, Math.min(length, 30 - distanceFromOriginKm)),
        fromEndKm: Math.max(0, Math.min(length, 30 - (routeDistanceKm - distanceFromOriginKm - length))),
      });
      if (index === 0 || index === path.length - 2) {
        portConnectorPairs.add(pair);
      }
      distanceFromOriginKm += length;
    }

    if (!connectorIds.has(demand.requestId) && !demand.requestId.startsWith('NETWORK-CONNECTOR-')) {
      routePlans.push({
        requestId: demand.requestId,
        originPortId: origin.portId,
        destinationPortId: destination.portId,
        originName: origin.name,
        destinationName: destination.name,
        originRegionId: getTradeRegionId(origin),
        destinationRegionId: getTradeRegionId(destination),
        distanceKm: routeDistanceKm,
        pathNodeIds: path.map(node => node.id),
        coordinates: path.map(node => [node.position.longitude, node.position.latitude]),
        previewOnly: true,
      });
    }
  }

  const networkScreen = await screenNetworkEdgesAgainstLand(network, portConnectorPairs, endpointApproachExemptions);
  if (networkScreen.reason === 'Edge references a missing network node') {
    throw new Error(`Network edge ${networkScreen.crossingEdgeId}: ${networkScreen.reason}`);
  }
  const coordinateText = networkScreen.crossingCoordinates
    ?.map(([longitude, latitude]) => `${longitude.toFixed(4)},${latitude.toFixed(4)}`)
    .join(' → ');
  const coastlineWarning = networkScreen.clear ? undefined
    : `Generalized route preview flagged by coastline screening at ${networkScreen.crossingEdgeId}: ${networkScreen.reason ?? 'unknown crossing'}${coordinateText ? ` (${coordinateText})` : ''}.`;

  return {
    network,
    plannedRoutes: routePlans.map(route => ({
      ...route,
      coastlineScreen: { clear: networkScreen.clear, dataset: networkScreen.dataset, warning: coastlineWarning },
    })),
  };
}

export function listAllPorts() {
  return getCanonicalPorts();
}
