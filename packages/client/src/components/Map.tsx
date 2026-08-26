import React, { useEffect } from 'react';
import { LatLngBounds } from 'leaflet';
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import PortMarker from './PortMarker';
import VesselMarker from './VesselMarker';

// For simplicity, we hardcode some port positions or fetch them
const routeColors: Record<string, string> = {
  'VESSEL-001': '#f97316',
  'VESSEL-002': '#06b6d4',
  'VESSEL-003': '#84cc16',
};
const fallbackRouteColors = ['#e11d48', '#8b5cf6', '#f59e0b'];

function FitNetwork({ nodes }: { nodes: any[] }) {
  const map = useMap();

  useEffect(() => {
    const ports = nodes.filter(node => node.type === 'PORT');
    if (ports.length > 0) {
      map.fitBounds(new LatLngBounds(ports.map(port => [port.latitude, port.longitude])), { padding: [30, 30] });
    }
  }, [map, nodes]);

  return null;
}

export default function Map({ vessels }: { vessels: any[] }) {
  const [nodes, setNodes] = React.useState<any[]>([]);

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
    fetch('http://localhost:3000/network/nodes')
      .then(r => r.json())
      .then(data => setNodes(data))
      .catch(console.error);
  }, []);

  return (
    <MapContainer center={[51.2, 2]} zoom={6} style={{ height: '100%', width: '100%', background: '#b8dce8' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitNetwork nodes={nodes} />
      {nodes.filter(n => n.type === 'PORT').map(port => (
        <PortMarker key={port.id} port={port} />
      ))}
      {vessels.map(vessel => {
        const route = getRoute(vessel);
        if (route.length < 2) return null;
        return (
          <Polyline
            key={`route-shadow-${vessel.vesselId}`}
            positions={route}
            pathOptions={{ color: '#0f172a', weight: 7, opacity: 0.18, dashArray: '10 8' }}
          />
        );
      })}
      {vessels.map((vessel, index) => {
        const route = getRoute(vessel);
        if (route.length < 2) return null;
        return (
          <Polyline
            key={`route-${vessel.vesselId}`}
            positions={route}
            pathOptions={{ color: routeColors[vessel.vesselId] ?? fallbackRouteColors[index % fallbackRouteColors.length], weight: 3, opacity: 0.9, dashArray: '10 8' }}
          />
        );
      })}
      {vessels.map((vessel, index) => (
        <VesselMarker key={vessel.vesselId} vessel={vessel} nodes={nodes} vesselIndex={index} />
      ))}
    </MapContainer>
  );
}
