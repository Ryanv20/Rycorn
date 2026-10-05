import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { API } from '../api';

const RADIUS = 2.15;

interface PortRecord {
  portId: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteRecord {
  requestId: string;
  coordinates: [number, number][];
}

interface NodeRecord {
  id: string;
  latitude: number;
  longitude: number;
}

interface VesselRecord {
  vesselId: string;
  currentNodeId: string;
  status: string;
  currentRoute?: { path?: string[]; found?: boolean };
}

interface GlobeViewProps {
  routes: RouteRecord[];
  vessels: VesselRecord[];
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
}

function vectorFor(latitude: number, longitude: number, radius = RADIUS) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    -radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
  );
}

function addGraticule(group: THREE.Group): void {
  const material = new THREE.LineBasicMaterial({ color: 0x5a9297, transparent: true, opacity: 0.22 });
  const addCurve = (coordinates: THREE.Vector3[]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(coordinates);
    group.add(new THREE.Line(geometry, material));
  };

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 3) points.push(vectorFor(latitude, longitude, RADIUS + 0.006));
    addCurve(points);
  }
  for (let longitude = -150; longitude <= 180; longitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let latitude = -87; latitude <= 87; latitude += 3) points.push(vectorFor(latitude, longitude, RADIUS + 0.006));
    addCurve(points);
  }
}

function addRouteLines(group: THREE.Group, routes: RouteRecord[], color: number, radiusOffset: number, opacity: number): number {
  let count = 0;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  for (const route of routes) {
    for (let pointIndex = 0; pointIndex < route.coordinates.length - 1; pointIndex += 1) {
      const [longitudeA, latitudeA] = route.coordinates[pointIndex];
      const [longitudeB, latitudeB] = route.coordinates[pointIndex + 1];
      const start = vectorFor(latitudeA, longitudeA, RADIUS + radiusOffset);
      const end = vectorFor(latitudeB, longitudeB, RADIUS + radiusOffset);
      const middle = start.clone().add(end).normalize().multiplyScalar(RADIUS + radiusOffset + 0.075);
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radiusOffset > 0.02 ? 0.008 : 0.005, 5, false), material));
      count += 1;
    }
  }
  return count;
}

function addPorts(group: THREE.Group, ports: PortRecord[]): void {
  const positions: number[] = [];
  for (const port of ports) positions.push(...vectorFor(port.latitude, port.longitude, RADIUS + 0.02).toArray());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x8be0ce, size: 0.018, sizeAttenuation: true, transparent: true, opacity: 0.8 });
  group.add(new THREE.Points(geometry, material));
}

function addVessels(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[], selectedVesselId: string | null): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const vesselIds: string[] = [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  for (const vessel of vessels) {
    const path = vessel.status === 'SAILING' ? (vessel.currentRoute?.path ?? []).map(id => nodeById.get(id)).filter((node): node is NodeRecord => !!node) : [];
    const node = path.length >= 2 ? path[Math.floor((path.length - 1) / 2)] : nodeById.get(vessel.currentNodeId);
    if (!node) continue;
    positions.push(...vectorFor(node.latitude, node.longitude, RADIUS + 0.055).toArray());
    const color = vessel.vesselId === selectedVesselId
      ? new THREE.Color(0xffffff)
      : vessel.status === 'SAILING' ? new THREE.Color(0xff916d) : new THREE.Color(0xf2d181);
    colors.push(color.r, color.g, color.b);
    vesselIds.push(vessel.vesselId);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ships = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, transparent: true, opacity: 1, vertexColors: true, depthWrite: false }));
  ships.userData.vesselIds = vesselIds;
  ships.userData.kind = 'vessels';
  group.add(ships);
}

function addActiveRoutes(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[]): number {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const routes = vessels.filter(vessel => vessel.status === 'SAILING').map(vessel => ({
    requestId: vessel.vesselId,
    coordinates: (vessel.currentRoute?.path ?? []).map(id => nodeById.get(id)).filter((node): node is NodeRecord => !!node).map(node => [node.longitude, node.latitude] as [number, number]),
  })).filter(route => route.coordinates.length > 1);
  return addRouteLines(group, routes, 0x56e0ce, 0.034, 0.98);
}

function disposeGroup(group: THREE.Group): void {
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(item => item.dispose());
      else material.dispose();
    }
  });
}

export default function GlobeView({ routes, vessels, selectedVesselId, onSelectVessel }: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ routes, vessels, selectedVesselId, onSelectVessel });
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const nodesRef = useRef<NodeRecord[]>([]);
  const [portCount, setPortCount] = useState(0);
  const [routeCount, setRouteCount] = useState(0);
  const [error, setError] = useState('');

  dataRef.current = { routes, vessels, selectedVesselId, onSelectVessel };

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    const host = hostRef.current;
    if (!host) return;

    const load = async () => {
      try {
        const [portsResponse, nodesResponse] = await Promise.all([
          fetch(`${API}/network/ports`),
          fetch(`${API}/network/nodes`),
        ]);
        if (!portsResponse.ok || !nodesResponse.ok) throw new Error('The server port catalogue is unavailable.');
        const [ports, nodes] = await Promise.all([portsResponse.json(), nodesResponse.json()]) as [PortRecord[], NodeRecord[]];
        if (disposed) return;
        setPortCount(ports.length);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#102a31');
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0.15, 7.35);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.replaceChildren(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional globe with WPI ports, planned route arcs, and simulated vessels');

        const globeGroup = new THREE.Group();
        scene.add(globeGroup);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS, 72, 48),
          new THREE.MeshStandardMaterial({ color: 0x174651, roughness: 0.86, metalness: 0.06 }),
        );
        globeGroup.add(sphere);
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS * 1.012, 48, 32),
          new THREE.MeshBasicMaterial({ color: 0x52c5bb, transparent: true, opacity: 0.075, side: THREE.BackSide }),
        );
        globeGroup.add(atmosphere);
        addGraticule(globeGroup);
        addPorts(globeGroup, ports);
        globeGroupRef.current = globeGroup;
        nodesRef.current = nodes;
        const dynamicGroup = new THREE.Group();
        dynamicGroupRef.current = dynamicGroup;
        setRouteCount(addRouteLines(dynamicGroup, dataRef.current.routes, 0xffad72, 0.018, 0.58) + addActiveRoutes(dynamicGroup, dataRef.current.vessels, nodes));
        addVessels(dynamicGroup, dataRef.current.vessels, nodes, dataRef.current.selectedVesselId);
        globeGroup.add(dynamicGroup);

        scene.add(new THREE.HemisphereLight(0xa5d8d3, 0x0e2028, 2.0));
        const keyLight = new THREE.DirectionalLight(0xffdfb2, 1.7);
        keyLight.position.set(-4, 3, 6);
        scene.add(keyLight);

        const resize = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let lastInteraction = performance.now();
        const onPointerDown = (event: PointerEvent) => {
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
          lastInteraction = performance.now();
          renderer.domElement.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!dragging) return;
          globeGroup.rotation.y += (event.clientX - lastX) * 0.006;
          globeGroup.rotation.x += (event.clientY - lastY) * 0.006;
          globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x, -1.35, 1.35);
          lastX = event.clientX;
          lastY = event.clientY;
          lastInteraction = performance.now();
        };
        const onPointerUp = () => { dragging = false; };
        const onWheel = (event: WheelEvent) => {
          camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.003, 3.4, 10);
          lastInteraction = performance.now();
        };
        const onClick = (event: MouseEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          const raycaster = new THREE.Raycaster();
          raycaster.params.Points!.threshold = 0.08;
          raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
          const intersections = raycaster.intersectObject(globeGroup, true);
          const pointHit = intersections.find(hit => hit.object instanceof THREE.Points && hit.object.userData.kind === 'vessels');
          const current = dataRef.current;
          const hitVesselId = pointHit?.index === undefined ? undefined : (pointHit.object.userData.vesselIds as string[] | undefined)?.[pointHit.index];
          if (hitVesselId) current.onSelectVessel(hitVesselId);
        };
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
        renderer.domElement.addEventListener('click', onClick);

        const render = (time: number) => {
          if (disposed) return;
          if (!dragging && time - lastInteraction > 1800) globeGroup.rotation.y += 0.00022;
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);

        return () => {
          cancelAnimationFrame(animationFrame);
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          renderer.domElement.removeEventListener('pointermove', onPointerMove);
          renderer.domElement.removeEventListener('pointerup', onPointerUp);
          renderer.domElement.removeEventListener('pointercancel', onPointerUp);
          renderer.domElement.removeEventListener('wheel', onWheel);
          renderer.domElement.removeEventListener('click', onClick);
          scene.traverse(object => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
              object.geometry.dispose();
              const material = object.material;
              if (Array.isArray(material)) material.forEach(item => item.dispose());
              else material.dispose();
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
          dynamicGroupRef.current = null;
          globeGroupRef.current = null;
          nodesRef.current = [];
        };
      } catch (loadError) {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : 'Unable to render globe.');
      }
    };

    let cleanup: (() => void) | undefined;
    void load().then(result => { cleanup = result; });
    return () => {
      disposed = true;
      cleanup?.();
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    const previous = dynamicGroupRef.current;
    if (!globeGroup || !previous) return;
    globeGroup.remove(previous);
    disposeGroup(previous);
    const next = new THREE.Group();
    setRouteCount(addRouteLines(next, routes, 0xffad72, 0.018, 0.58) + addActiveRoutes(next, vessels, nodesRef.current));
    addVessels(next, vessels, nodesRef.current, selectedVesselId);
    globeGroup.add(next);
    dynamicGroupRef.current = next;
  }, [routes, vessels, selectedVesselId]);

  return <section className="globe-stage" aria-label="Three-dimensional globe">
    <div className="globe-canvas" ref={hostRef} />
    <div className="globe-heading"><span className="globe-live-dot" /><div><strong>Global maritime view</strong><small>Drag to rotate · scroll to zoom</small></div></div>
    <div className="globe-counts"><span>{portCount.toLocaleString()} PORTS</span><span>{routeCount} ROUTE LEGS</span><span>{vessels.length} VESSELS</span></div>
    <div className="globe-legend" aria-label="Globe legend"><span><i className="legend-ship" /> Ships</span><span><i className="legend-active-route" /> Active vessel routes</span><span><i className="legend-planned-route" /> Planned routes</span></div>
    <div className="globe-caption">Scenario and lane visualization only · not navigational guidance</div>
    {error && <div className="globe-error">{error}</div>}
  </section>;
}
