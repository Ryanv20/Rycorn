import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { DivIcon } from 'leaflet';
import { LatLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import PortMarker from './PortMarker';
import FleetCanvas from './FleetCanvas';
import SpecialVesselMarker, { type SpecialVesselRecord } from './SpecialVesselMarker';
import { API } from '../api';

const GlobeView = lazy(() => import('./GlobeView'));

const routeColors = ['#ff9f68', '#5dd5c5', '#e2c569', '#83b7d1', '#e47d70'];
const bunkerIcon = new DivIcon({ className: 'asset-map-icon bunker-map-icon', html: '<img src="/visual_component/icons/bunker.svg" alt="" />', iconSize: [30, 30], iconAnchor: [15, 15] });

interface MapProps {
  vessels: any[];
  plannedRoutes: Array<{ requestId: string; originPortId?: string; destinationPortId?: string; coordinates: [number, number][]; distanceKm: number; originName?: string; destinationName?: string; originRegionId?: string; destinationRegionId?: string }>;
  specialVessels: SpecialVesselRecord[];
  showPorts: boolean;
  showRoutes: boolean;
  showSpecial: boolean;
  showShips: boolean;
  showBunkers: boolean;
  showTraffic: boolean;
  showNodeLabels: boolean;
  routesOnly: boolean;
  projection: 'map' | 'globe';
  cameraFollow: boolean;
  selectedVesselId: string | null;
  followPoint: [number, number] | null;
  onSelectVessel: (vesselId: string) => void;
  onFollowNode: (point: [number, number]) => void;
  simulationTimeHours: number;
  simulationRunning: boolean;
  clockProfileId?: string;
}

function FitNetwork({ nodes }: { nodes: any[] }) {
  const map = useMap();

  useEffect(() => {
    const ports = nodes.filter(node => node.type === 'PORT');
    if (ports.length > 0) {
      map.fitBounds(new LatLngBounds(ports.map(port => [port.latitude, port.longitude])), { padding: [42, 42], maxZoom: 7 });
    }
  }, [map, nodes]);

  return null;
}

function regionLabel(regionId: string | undefined): string {
  return regionId?.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) ?? 'Regional market';
}

function routeGeometryKey(coordinates: [number, number][]): string {
  const encode = (points: [number, number][]) => points.map(([longitude, latitude]) => `${longitude.toFixed(2)},${latitude.toFixed(2)}`).join('|');
  const forward = encode(coordinates);
  const reverse = encode([...coordinates].reverse());
  return forward < reverse ? forward : reverse;
}

export default function Map({ vessels, plannedRoutes, specialVessels, showPorts, showRoutes, showSpecial, showShips, showBunkers, showTraffic, showNodeLabels, routesOnly, projection, cameraFollow, selectedVesselId, followPoint, onSelectVessel, onFollowNode, simulationTimeHours, simulationRunning, clockProfileId }: MapProps) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [bunkerSpots, setBunkerSpots] = useState<any[]>([]);
  const nodeById = useMemo(() => new globalThis.Map(nodes.map(node => [node.id, node])), [nodes]);
  const tradeLaneRoutes = useMemo(() => {
    const seen = new Set<string>();
    return plannedRoutes.filter(route => {
      const key = routeGeometryKey(route.coordinates);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [plannedRoutes]);
  const fleetPortKey = [...new Set(vessels.map(vessel => vessel.currentNodeId)
    .filter((nodeId: unknown): nodeId is string => typeof nodeId === 'string' && nodeId.startsWith('node-19WPI-')))].sort().join('|');
  const visiblePortIds = useMemo(() => new Set([
    ...tradeLaneRoutes.flatMap(route => [route.originPortId, route.destinationPortId].filter((portId): portId is string => Boolean(portId))),
    ...fleetPortKey.split('|').filter(Boolean).map(nodeId => nodeId.slice('node-'.length)),
  ]), [tradeLaneRoutes, fleetPortKey]);
  const tradePorts = useMemo(() => ports.filter(port => visiblePortIds.has(port.portId)), [ports, visiblePortIds]);

  const getCoordinates = (node: any): [number, number] | null => {
    if (!node) return null;
    const latitude = node.position?.latitude ?? node.latitude;
    const longitude = node.position?.longitude ?? node.longitude;
    return typeof latitude === 'number' && typeof longitude === 'number'
      ? [latitude, longitude]
      : null;
  };

  const getRoute = (vessel: any): [number, number][] => (vessel.currentRoute?.path ?? [])
    .map((nodeId: string) => getCoordinates(nodeById.get(nodeId)))
    .filter((point: [number, number] | null): point is [number, number] => point !== null);
  const activeRoutes = useMemo(() => {
    const grouped = new globalThis.Map<string, { vesselId: string; points: [number, number][]; traffic: number }>();
    for (const vessel of vessels) {
      if (vessel.status !== 'SAILING' && vessel.status !== 'REPOSITIONING') continue;
      const points = getRoute(vessel);
      if (points.length < 2) continue;
      const key = routeGeometryKey(points.map(([latitude, longitude]) => [longitude, latitude] as [number, number]));
      const existing = grouped.get(key);
      if (existing) existing.traffic += 1;
      else grouped.set(key, { vesselId: vessel.vesselId, points, traffic: 1 });
    }
    return [...grouped.entries()].map(([key, route]) => ({ key, ...route }));
  }, [vessels, nodeById]);
  const activeTrafficByRoute = useMemo(() => new globalThis.Map(activeRoutes.map(route => [route.key, route.traffic])), [activeRoutes]);
  const plannedRouteKeys = useMemo(() => new Set(tradeLaneRoutes.map(route => routeGeometryKey(route.coordinates))), [tradeLaneRoutes]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/network/nodes`).then(response => response.json()),
      fetch(`${API}/network/ports`).then(response => response.json()),
      fetch(`${API}/network/bunker-spots`).then(response => response.json()),
    ]).then(([nextNodes, nextPorts, nextBunkerSpots]) => {
      setNodes(nextNodes);
      setPorts(nextPorts);
      setBunkerSpots(nextBunkerSpots);
    }).catch(() => {
      setNodes([]);
      setPorts([]);
      setBunkerSpots([]);
    });
  }, [plannedRoutes]);

  if (projection === 'globe') {
    return <Suspense fallback={<div className="globe-loading" role="status">Loading global view…</div>}>
      <GlobeView
        routes={showRoutes ? tradeLaneRoutes : []}
        vessels={vessels}
        showRoutes={showRoutes}
        showPorts={showPorts}
        showShips={showShips}
        selectedVesselId={selectedVesselId}
        onSelectVessel={onSelectVessel}
        simulationTimeHours={simulationTimeHours}
        simulationRunning={simulationRunning}
        clockProfileId={clockProfileId}
      />
    </Suspense>;
  }

  return (
    <MapContainer className="leaflet-map" center={[30, -28]} zoom={4} zoomControl={false} preferCanvas>
      <TileLayer
        className="nautical-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <FitNetwork nodes={nodes} />
      <FleetCanvas vessels={vessels} nodes={nodes} simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} selectedVesselId={selectedVesselId} cameraFollow={cameraFollow} followPoint={followPoint} onSelectVessel={onSelectVessel} showShips={showShips} />
      <div className={`map-symbol-legend ${routesOnly ? 'route-atlas-legend' : ''}`} aria-label={routesOnly ? 'Route traffic legend' : 'Map symbols'}>
        {routesOnly ? <><span><i className="route-legend-active" /> Active</span><span><i className="route-legend-inactive" /> Inactive</span><span><i className="route-legend-high" /> High traffic · 3+ ships</span></> : <>
          <span><i className="ship-legend-sailing" /> Sailing</span><span><i className="ship-legend-loading" /> Loading</span><span><i className="ship-legend-idle" /> Idle / arrived</span>
          <span><img src="/visual_component/icons/route.svg" alt="" /> Route</span><span><img src="/visual_component/icons/port.svg" alt="" /> Port</span><span><img src="/visual_component/icons/bunker.svg" alt="" /> Bunker</span>
        </>}
      </div>
      {showPorts && (routesOnly ? tradePorts : ports).map(port => (
        <PortMarker key={port.portId} port={{ ...port, id: `node-${port.portId}`, position: { latitude: port.latitude, longitude: port.longitude } }} showLabel={showNodeLabels} onFollow={() => onFollowNode([port.latitude, port.longitude])} />
      ))}
      {showBunkers && !routesOnly && bunkerSpots.map(spot => <Marker
        key={`bunker-${spot.portId}`}
        position={[spot.latitude, spot.longitude]}
        icon={bunkerIcon}
      ><Popup><strong>{spot.name}</strong><br />Simulated bunker station</Popup></Marker>)}
      {showRoutes && tradeLaneRoutes.map((route, index) => {
        const positions = route.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
        const key = routeGeometryKey(route.coordinates);
        const traffic = activeTrafficByRoute.get(key) ?? 0;
        const atlasColor = traffic >= 3 ? '#ed805b' : traffic > 0 ? '#54d0b7' : '#758b98';
        const color = showTraffic ? atlasColor : routeColors[index % routeColors.length];
        return <Fragment key={`lane-${route.requestId}`}>
          <Polyline positions={positions} pathOptions={{ className: `route-lane-core ${traffic >= 3 ? 'is-high-traffic' : traffic > 0 ? 'is-active-route' : 'is-inactive-route'}`, color, weight: routesOnly ? 2.3 : 1.6, opacity: routesOnly ? 0.82 : 0.48, lineCap: 'round', lineJoin: 'round' }}>
            <Popup><strong>{route.originName ?? 'Origin'} → {route.destinationName ?? 'Destination'}</strong><br />
              {regionLabel(route.originRegionId)} → {regionLabel(route.destinationRegionId)}<br />
              {Math.round(route.distanceKm).toLocaleString()} km · generalized modeled sea lane
            </Popup>
          </Polyline>
          {routesOnly && positions.length > 1 && [positions[0], positions[positions.length - 1]].map((point, endpoint) => <CircleMarker
            key={`${route.requestId}-endpoint-${endpoint}`}
            center={point}
            radius={3.5}
            pathOptions={{ className: 'route-endpoint', color, weight: 1.5, fillColor: '#eafff7', fillOpacity: 0.82 }}
          ><Popup>{endpoint ? route.destinationName ?? 'Destination' : route.originName ?? 'Origin'}</Popup></CircleMarker>)}
        </Fragment>;
      })}
      {showRoutes && activeRoutes.filter(route => !plannedRouteKeys.has(route.key)).map((route, index) => <Polyline
        key={`route-${route.vesselId}`}
        positions={route.points}
        pathOptions={{ className: `active-route-core ${route.traffic >= 3 ? 'is-high-traffic' : 'is-active-route'}`, color: showTraffic ? route.traffic >= 3 ? '#ed805b' : '#54d0b7' : routeColors[index % routeColors.length], weight: 2.1, opacity: 0.82, lineCap: 'round', lineJoin: 'round' }}
      />)}
      {showSpecial && !routesOnly && specialVessels.map(vessel => <SpecialVesselMarker
        key={vessel.id}
        vessel={vessel}
        simulationTimeHours={simulationTimeHours}
        running={simulationRunning}
        clockProfileId={clockProfileId}
      />)}
    </MapContainer>
  );
}
