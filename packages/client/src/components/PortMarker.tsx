import { DivIcon } from 'leaflet';
import { memo, useMemo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';

function PortMarker({ port, showLabel = false, onFollow, onOpenPortConsole, onOpenLekkiPortConsole }: { port: any; showLabel?: boolean; onFollow?: () => void; onOpenPortConsole?: () => void; onOpenLekkiPortConsole?: () => void }) {
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
      <Popup><strong>{port.name}</strong><br />{port.country ?? 'Port node'}{port.id && <><br /><small>{port.id}</small></>}{onOpenPortConsole && <><br /><button type="button" className="port-console-link" onClick={event => { event.stopPropagation(); onOpenPortConsole() }}>Open Port of Los Angeles console ↗</button></>}{onOpenLekkiPortConsole && <><br /><button type="button" className="port-console-link" onClick={event => { event.stopPropagation(); onOpenLekkiPortConsole() }}>Open Lekki Port console ↗</button></>}</Popup>
    </Marker>
  );
}

// Map state updates arrive for every simulation event. Port coordinates and
// labels are static, so avoid asking Leaflet to reconcile every port marker
// whenever only vessel positions or simulation time have changed.
function samePortMarker(previous: Parameters<typeof PortMarker>[0], next: Parameters<typeof PortMarker>[0]) {
  return previous.showLabel === next.showLabel
    && previous.port.portId === next.port.portId
    && previous.port.name === next.port.name
    && previous.port.country === next.port.country
    && previous.port.latitude === next.port.latitude
    && previous.port.longitude === next.port.longitude;
}

export default memo(PortMarker, samePortMarker);
