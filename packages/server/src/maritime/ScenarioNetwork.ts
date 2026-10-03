import { createRequire } from 'node:module';
import { MaritimeNetwork, VesselCapability } from '@rycon/engine';
import type { CargoDemand } from '@rycon/ds-system';
import type { EdgeId, NetworkEdge, NetworkNode } from '@rycon/engine';
import type { NodeId } from '@rycon/engine';
import { getCanonicalPorts, getPortByNodeId, type CanonicalPortRecord } from '../data/portCatalog.js';
import { screenRouteAgainstLand } from './CoastlineScreen.js';

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
  distanceKm: number;
  pathNodeIds: string[];
  coordinates: [number, number][];
  coastlineScreen: { clear: boolean; dataset: string };
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

export async function buildScenarioNetwork(demands: readonly CargoDemand[]): Promise<ScenarioNetwork> {
  const network = new MaritimeNetwork();
  const routePlans: PlannedRoute[] = [];
  const portNodes = new Map<string, NetworkNode>();

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

  for (const demand of demands) {
    const origin = getPortByNodeId(demand.origin);
    const destination = getPortByNodeId(demand.destination);
    if (!origin || !destination) throw new Error(`Scenario ${demand.requestId} references an unknown WPI port`);

    const seaLine = seaRoute(toFeature(origin), toFeature(destination), 'kilometers');
    if (!seaLine || seaLine.geometry.coordinates.length < 2) {
      throw new Error(`No generalized sea-lane path found for ${demand.requestId}`);
    }
    const routeCoordinates = [
      [origin.longitude, origin.latitude] as [number, number],
      ...seaLine.geometry.coordinates,
      [destination.longitude, destination.latitude] as [number, number],
    ];
    const coastlineScreen = await screenRouteAgainstLand(routeCoordinates);
    if (!coastlineScreen.clear) {
      throw new Error(`Sea-lane preview ${demand.requestId} segment ${coastlineScreen.crossingSegment} intersects Natural Earth land geometry`);
    }

    const originNode = getOrAddPortNode(origin);
    const destinationNode = getOrAddPortNode(destination);
    const routeId = stableRouteId(demand.requestId);
    const intermediateNodes: NetworkNode[] = seaLine.geometry.coordinates.map((coordinate, index) => {
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

    for (let index = 0; index < path.length - 1; index += 1) {
      addBidirectionalEdge(network, path[index], path[index + 1], `route-${routeId}-${index}`);
    }

    routePlans.push({
      requestId: demand.requestId,
      originPortId: origin.portId,
      destinationPortId: destination.portId,
      originName: origin.name,
      destinationName: destination.name,
      distanceKm: seaLine.properties.length ?? path.slice(1).reduce((total, node, index) => total + distanceKm(
        [path[index].position.longitude, path[index].position.latitude],
        [node.position.longitude, node.position.latitude],
      ), 0),
      pathNodeIds: path.map(node => node.id),
      coordinates: path.map(node => [node.position.longitude, node.position.latitude]),
      coastlineScreen,
      previewOnly: true,
    });
  }

  return { network, plannedRoutes: routePlans };
}

export function listAllPorts() {
  return getCanonicalPorts();
}
