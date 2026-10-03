import { CircleMarker, Popup, Tooltip } from 'react-leaflet';

export default function PortMarker({ port, showLabel = false }: { port: any; showLabel?: boolean }) {
  const latitude = port.position?.latitude ?? port.latitude;
  const longitude = port.position?.longitude ?? port.longitude;

  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={2.5}
      pathOptions={{ color: '#d7fbf2', fillColor: '#47d0bb', fillOpacity: 1, weight: 2 }}
    >
      {showLabel && <Tooltip direction="top" offset={[0, -6]} permanent className="port-label">{port.name}</Tooltip>}
      <Popup>{port.name} ({port.id})</Popup>
    </CircleMarker>
  );
}
