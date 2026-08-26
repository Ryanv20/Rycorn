import { CircleMarker, Popup } from 'react-leaflet';

export default function PortMarker({ port }: { port: any }) {
  const latitude = port.position?.latitude ?? port.latitude;
  const longitude = port.position?.longitude ?? port.longitude;

  return (
    <CircleMarker 
      center={[latitude, longitude]} 
      radius={6} 
      pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.8 }}
    >
      <Popup>{port.name} ({port.id})</Popup>
    </CircleMarker>
  );
}
