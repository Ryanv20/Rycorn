import { useEffect, useState } from 'react';
import { LatLngBounds } from 'leaflet';
import { MapContainer, Polyline, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import PortMarker from './PortMarker';
import VesselMarker from './VesselMarker';
import SpecialVesselMarker, { type SpecialVesselRecord } from './SpecialVesselMarker';
import GlobeView from './GlobeView';

const routeColors = ['#ff9f68', '#5dd5c5', '#e2c569', '#83b7d1', '#e47d70'];

interface MapProps {
  vessels: any[];
  plannedRoutes: Array<{ requestId: string; coordinates: [number, number][]; distanceKm: number }>;
  specialVessels: SpecialVesselRecord[];
  showPorts: boolean;
  showRoutes: boolean;
  showSpecial: boolean;
  routesOnly: boolean;
  projection: 'map' | 'globe';
  cameraFollow: boolean;
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
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

function FollowVessel({ enabled, vessel, nodes, ports }: { enabled: boolean; vessel: any; nodes: any[]; ports: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !vessel) return;
    const node = nodes.find(item => item.id === vessel.currentNodeId);
    const port = ports.find(item => `node-${item.portId}` === vessel.currentNodeId);
    const latitude = node?.latitude ?? node?.position?.latitude ?? port?.latitude;
    const longitude = node?.longitude ?? node?.position?.longitude ?? port?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 6), { duration: 0.75 });
    }
  }, [enabled, vessel?.currentNodeId, nodes, ports, map]);
  return null;
}

export default function Map({ vessels, plannedRoutes, specialVessels, showPorts, showRoutes, showSpecial, routesOnly, projection, cameraFollow, selectedVesselId, onSelectVessel }: MapProps) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);

  const getCoordinates = (node: any): [number, number] | null => {
    if (!node) return null;
    const latitude = node.position?.latitude ?? node.latitude;
    const longitude = node.position?.longitude ?? node.longitude;
    return typeof latitude === 'number' && typeof longitude === 'number'
      ? [latitude, longitude]
      : null;
  };

  const getRoute = (vessel: any): [number, number][] => (vessel.currentRoute?.path ?? [])
    .map((nodeId: string) => getCoordinates(nodes.find(node => node.id === nodeId)))
    .filter((point: [number, number] | null): point is [number, number] => point !== null);

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:3000/network/nodes').then(response => response.json()),
      fetch('http://127.0.0.1:3000/network/ports').then(response => response.json()),
    ]).then(([nextNodes, nextPorts]) => {
      setNodes(nextNodes);
      setPorts(nextPorts);
    }).catch(() => {
      setNodes([]);
      setPorts([]);
    });
  }, []);

  if (projection === 'globe') {
    return <GlobeView
      routes={showRoutes ? plannedRoutes : []}
      vessels={vessels}
      selectedVesselId={selectedVesselId}
      onSelectVessel={onSelectVessel}
    />;
  }

  return (
    <MapContainer className="leaflet-map" center={[30, -28]} zoom={4} zoomControl={false}>
      <TileLayer
        className="nautical-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <FitNetwork nodes={nodes} />
      <FollowVessel enabled={cameraFollow} vessel={vessels.find(vessel => vessel.vesselId === selectedVesselId)} nodes={nodes} ports={ports} />
      {showPorts && !routesOnly && ports.map(port => (
        <PortMarker key={port.portId} port={{ ...port, id: `node-${port.portId}`, position: { latitude: port.latitude, longitude: port.longitude } }} />
      ))}
      {showRoutes && plannedRoutes.map((route, index) => <Polyline
        key={`planned-${route.requestId}`}
        positions={route.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])}
        pathOptions={{ color: routeColors[index % routeColors.length], weight: 2.5, opacity: routesOnly ? 0.92 : 0.63, dashArray: '6 8', lineCap: 'round' }}
      />)}
      {showRoutes && vessels.map(vessel => {
        const route = getRoute(vessel);
        if (route.length < 2) return null;
        return (
          <Polyline
            key={`route-shadow-${vessel.vesselId}`}
            positions={route}
            pathOptions={{ color: '#08191e', weight: 8, opacity: 0.68 }}
          />
        );
      })}
      {showRoutes && vessels.map((vessel, index) => {
        const route = getRoute(vessel);
        if (route.length < 2) return null;
        return (
          <Polyline
            key={`route-${vessel.vesselId}`}
            positions={route}
            pathOptions={{ color: routeColors[index % routeColors.length], weight: 3, opacity: 0.96, dashArray: '7 8', lineCap: 'round' }}
          />
        );
      })}
      {vessels.map((vessel, index) => (
        <VesselMarker
          key={vessel.vesselId}
          vessel={vessel}
          nodes={nodes}
          vesselIndex={index}
          selected={selectedVesselId === vessel.vesselId}
          onSelect={() => onSelectVessel(vessel.vesselId)}
        />
      ))}
      {showSpecial && !routesOnly && specialVessels.map(vessel => <SpecialVesselMarker key={vessel.id} vessel={vessel} />)}
    </MapContainer>
  );
}
