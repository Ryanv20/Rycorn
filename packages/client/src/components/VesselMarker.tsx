import { DivIcon } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';

export default function VesselMarker({ vessel, nodes, vesselIndex, selected, onSelect }: {
  vessel: any;
  nodes: any[];
  vesselIndex: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const getCoordinates = (node: any): [number, number] | null => {
    if (!node) return null;
    const latitude = node.position?.latitude ?? node.latitude;
    const longitude = node.position?.longitude ?? node.longitude;
    return typeof latitude === 'number' && typeof longitude === 'number'
      ? [latitude, longitude]
      : null;
  };

  const routePoints = (vessel.currentRoute?.path ?? [])
    .map((nodeId: string) => getCoordinates(nodes.find(node => node.id === nodeId)))
    .filter((point: [number, number] | null): point is [number, number] => point !== null);
  const currentPoint = getCoordinates(nodes.find(node => node.id === vessel.currentNodeId));
  const destinationPoint = routePoints[routePoints.length - 1] ?? currentPoint;
  const [position, setPosition] = useState<[number, number] | null>(currentPoint);
  const positionRef = useRef<[number, number] | null>(currentPoint);
  const animationFrame = useRef<number | null>(null);

  const updatePosition = (nextPosition: [number, number]) => {
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  };

  useEffect(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);

    if (vessel.status !== 'SAILING' || routePoints.length < 2) {
      if (vessel.status !== 'ARRIVED' || !destinationPoint) {
        if (currentPoint) updatePosition(currentPoint);
        return;
      }

      const start = positionRef.current ?? currentPoint;
      if (!start) return;
      const startedAt = performance.now();
      const durationMs = 1500;
      const glideToPort = (now: number) => {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        updatePosition([
          start[0] + (destinationPoint[0] - start[0]) * progress,
          start[1] + (destinationPoint[1] - start[1]) * progress,
        ]);
        if (progress < 1) animationFrame.current = requestAnimationFrame(glideToPort);
      };
      animationFrame.current = requestAnimationFrame(glideToPort);
      return;
    }

    const startedAt = performance.now();
    const durationMs = 8000;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const segmentPosition = progress * (routePoints.length - 1);
      const segmentIndex = Math.min(Math.floor(segmentPosition), routePoints.length - 2);
      const segmentProgress = segmentPosition - segmentIndex;
      const from = routePoints[segmentIndex];
      const to = routePoints[segmentIndex + 1];
      if (!from || !to) return;
      updatePosition([
        from[0] + (to[0] - from[0]) * segmentProgress,
        from[1] + (to[1] - from[1]) * segmentProgress,
      ]);
      if (progress < 1) animationFrame.current = requestAnimationFrame(animate);
    };

    animationFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, [vessel.status, vessel.currentNodeId, vessel.currentRoute?.path?.join('|'), nodes.length]);

  if (!position) return null;

  const offset = vesselIndex % 3 - 1;
  const displayPosition: [number, number] = [position[0] + offset * 0.18, position[1] + offset * 0.22];

  const icon = new DivIcon({
    className: `ship-avatar ${selected ? 'is-selected' : ''}`,
    html: `<span class="ship-symbol" title="${vessel.vesselId}"><span class="ship-heading">➤</span></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

  return (
    <Marker
      position={displayPosition}
      icon={icon}
      eventHandlers={{ click: onSelect }}
    >
      <Popup>
        <strong>{vessel.vesselId}</strong><br/>
        Status: {vessel.status}<br/>
        Class: {vessel.vesselCapability}
      </Popup>
    </Marker>
  );
}
