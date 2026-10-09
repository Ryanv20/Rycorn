import { DivIcon } from 'leaflet';
import { useMemo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';

export default function PortMarker({ port, showLabel = false, onFollow }: { port: any; showLabel?: boolean; onFollow?: () => void }) {
  const latitude = port.position?.latitude ?? port.latitude;
  const longitude = port.position?.longitude ?? port.longitude;
  const icon = useMemo(() => new DivIcon({
    className: 'asset-map-icon port-map-icon',
    html: '<img src="/visual_component/icons/port.svg" alt="" />',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }), []);

  return (
    <Marker position={[latitude, longitude]} icon={icon} eventHandlers={{ dblclick: event => { event.originalEvent.preventDefault(); event.originalEvent.stopPropagation(); onFollow?.(); } }}>
      {showLabel && <Tooltip direction="top" offset={[0, -6]} permanent className="port-label">{port.name}</Tooltip>}
      <Popup><strong>{port.name}</strong><br />{port.country ?? 'Port node'}{port.id && <><br /><small>{port.id}</small></>}<br /><small>Double-click node to follow</small></Popup>
    </Marker>
  );
}
