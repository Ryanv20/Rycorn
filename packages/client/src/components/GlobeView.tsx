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
  currentVoyageStartedAt?: number;
  expectedArrivalAt?: number;
}

interface GlobeViewProps {
  routes: RouteRecord[];
  vessels: VesselRecord[];
  showPorts: boolean;
  showRoutes: boolean;
  showShips: boolean;
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  simulationTimeHours: number;
  simulationRunning: boolean;
  clockProfileId?: string;
}

const clockRates: Record<string, number> = {
  REAL_TIME: 1 / 3600,
  HOUR_PER_SECOND: 1,
  DAY_PER_MINUTE: 0.4,
  FAST_REVIEW: 24,
  MINUTE_PER_SECOND: 1 / 60,
  SIX_HOURS_PER_SECOND: 6,
  WEEK_PER_SECOND: 168,
};

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
  const material = new THREE.LineBasicMaterial({ color: 0x9cbec2, transparent: true, opacity: 0.11, depthWrite: false });
  const addCurve = (coordinates: THREE.Vector3[]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(coordinates);
    group.add(new THREE.Line(geometry, material));
  };

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 3) points.push(vectorFor(latitude, longitude, RADIUS + 0.006));
    addCurve(points);
  }
  for (let longitude = -135; longitude <= 180; longitude += 45) {
    const points: THREE.Vector3[] = [];
    for (let latitude = -87; latitude <= 87; latitude += 3) points.push(vectorFor(latitude, longitude, RADIUS + 0.006));
    addCurve(points);
  }
}

function addStarfield(scene: THREE.Scene): void {
  let seed = 43;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const positions: number[] = [];
  const shades: THREE.Color[] = [];
  for (let index = 0; index < 520; index += 1) {
    const direction = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    direction.multiplyScalar(12 + random() * 12);
    positions.push(direction.x, direction.y, direction.z);
    shades.push(new THREE.Color().setHSL(0.49 + random() * 0.08, 0.16, 0.55 + random() * 0.35));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades.flatMap(color => [color.r, color.g, color.b]), 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.024, sizeAttenuation: true, transparent: true, opacity: 0.64, vertexColors: true, depthWrite: false }));
  stars.renderOrder = -1;
  scene.add(stars);
}

function addRouteLines(group: THREE.Group, routes: RouteRecord[], color: number, radiusOffset: number, opacity: number): number {
  let count = 0;
  const activeRoute = radiusOffset > 0.02;
  const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.12, depthWrite: false });
  const lineMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  for (const route of routes) {
    for (let pointIndex = 0; pointIndex < route.coordinates.length - 1; pointIndex += 1) {
      const [longitudeA, latitudeA] = route.coordinates[pointIndex];
      const [longitudeB, latitudeB] = route.coordinates[pointIndex + 1];
      const start = vectorFor(latitudeA, longitudeA, RADIUS + radiusOffset);
      const end = vectorFor(latitudeB, longitudeB, RADIUS + radiusOffset);
      const middle = start.clone().add(end).normalize().multiplyScalar(RADIUS + radiusOffset + 0.075);
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const segment = curve.getPoints(24);
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(segment), 32, activeRoute ? 0.0038 : 0.0028, 6, false);
      group.add(new THREE.Mesh(tube, lineMaterial));
      const glow = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(segment), 32, activeRoute ? 0.010 : 0.0075, 6, false);
      group.add(new THREE.Mesh(glow, glowMaterial));
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
  const material = new THREE.PointsMaterial({ color: 0xc7e0bd, size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0.72, depthWrite: false });
  group.add(new THREE.Points(geometry, material));
}

function addVessels(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[], selectedVesselId: string | null): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const vesselIds: string[] = [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  for (const vessel of vessels) {
    const node = nodeById.get(vessel.currentNodeId);
    if (!node) continue;
    positions.push(...vectorFor(node.latitude, node.longitude, RADIUS + 0.055).toArray());
    const color = vessel.vesselId === selectedVesselId
      ? new THREE.Color(0xffffff)
      : vessel.status === 'REPOSITIONING' ? new THREE.Color(0x66b8cc)
        : vessel.status === 'SAILING' ? new THREE.Color(0xff916d) : new THREE.Color(0xf2d181);
    colors.push(color.r, color.g, color.b);
    vesselIds.push(vessel.vesselId);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ships = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.075, sizeAttenuation: true, transparent: true, opacity: 1, vertexColors: true, depthWrite: false }));
  ships.userData.vesselIds = vesselIds;
  ships.userData.kind = 'vessels';
  group.add(ships);
}

function pointOnRoute(route: NodeRecord[], progress: number): [number, number] | null {
  if (route.length === 0) return null;
  if (route.length === 1 || progress >= 1) return [route[route.length - 1].latitude, route[route.length - 1].longitude];
  if (progress <= 0) return [route[0].latitude, route[0].longitude];
  const radians = Math.PI / 180;
  const lengths = route.slice(1).map((node, index) => {
    const from = route[index];
    const latitudeDelta = (node.latitude - from.latitude) * radians;
    const longitudeDelta = (node.longitude - from.longitude) * radians;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(from.latitude * radians) * Math.cos(node.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  });
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = totalLength * progress;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      const fraction = length === 0 ? 1 : Math.min(1, remaining / length);
      const from = route[index];
      const to = route[index + 1];
      const longitudeDelta = ((to.longitude - from.longitude + 540) % 360) - 180;
      let longitude = from.longitude + longitudeDelta * fraction;
      if (longitude > 180) longitude -= 360;
      if (longitude < -180) longitude += 360;
      return [from.latitude + (to.latitude - from.latitude) * fraction, longitude];
    }
    remaining -= length;
  }
  return [route[route.length - 1].latitude, route[route.length - 1].longitude];
}

function addActiveRoutes(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[]): number {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const routes = vessels.filter(vessel => vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING').map(vessel => ({
    requestId: vessel.vesselId,
    coordinates: (vessel.currentRoute?.path ?? []).map(id => nodeById.get(id)).filter((node): node is NodeRecord => !!node).map(node => [node.longitude, node.latitude] as [number, number]),
  })).filter(route => route.coordinates.length > 1);
  return addRouteLines(group, routes, 0x56e0ce, 0.034, 0.98);
}

function updateVesselPositions(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[], simulationTimeHours: number): void {
  const points = group.children.find(child => child instanceof THREE.Points && child.userData.kind === 'vessels') as THREE.Points | undefined;
  if (!points) return;
  const attribute = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const vesselIds = points.userData.vesselIds as string[];
  const vesselById = new Map(vessels.map(vessel => [vessel.vesselId, vessel]));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  vesselIds.forEach((vesselId, index) => {
    const vessel = vesselById.get(vesselId);
    if (!vessel) return;
    let coordinate: [number, number] | null = null;
    if (vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING') {
      const path = (vessel.currentRoute?.path ?? []).map(id => nodeById.get(id)).filter((node): node is NodeRecord => !!node);
      const startsAt = vessel.currentVoyageStartedAt ?? simulationTimeHours;
      const arrivesAt = vessel.expectedArrivalAt ?? startsAt + 1;
      const progress = arrivesAt <= startsAt ? 1 : Math.max(0, Math.min(1, (simulationTimeHours - startsAt) / (arrivesAt - startsAt)));
      coordinate = pointOnRoute(path, progress);
    }
    if (!coordinate) {
      const node = nodeById.get(vessel.currentNodeId);
      if (!node) return;
      coordinate = [node.latitude, node.longitude];
    }
    const position = vectorFor(coordinate[0], coordinate[1], RADIUS + 0.055);
    attribute.setXYZ(index, position.x, position.y, position.z);
  });
  attribute.needsUpdate = true;
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

export default function GlobeView({ routes, vessels, showPorts, showRoutes, showShips, selectedVesselId, onSelectVessel, simulationTimeHours, simulationRunning, clockProfileId }: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ routes, vessels, showPorts, showRoutes, showShips, selectedVesselId, onSelectVessel, simulationTimeHours, simulationRunning });
  const simulationCursor = useRef({
    serverHours: simulationTimeHours,
    visualHours: simulationTimeHours,
    lastFrameAt: performance.now(),
    running: simulationRunning,
    rate: clockRates[clockProfileId ?? 'HOUR_PER_SECOND'] ?? 1,
  });
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const portsGroupRef = useRef<THREE.Group | null>(null);
  const portsRef = useRef<PortRecord[]>([]);
  const nodesRef = useRef<NodeRecord[]>([]);
  const [portCount, setPortCount] = useState(0);
  const [routeCount, setRouteCount] = useState(0);
  const [error, setError] = useState('');

  dataRef.current = { routes, vessels, showPorts, showRoutes, showShips, selectedVesselId, onSelectVessel, simulationTimeHours, simulationRunning };

  useEffect(() => {
    const cursor = simulationCursor.current;
    if (cursor.serverHours !== simulationTimeHours) cursor.visualHours = simulationTimeHours;
    cursor.serverHours = simulationTimeHours;
    cursor.running = simulationRunning;
    cursor.rate = clockRates[clockProfileId ?? 'HOUR_PER_SECOND'] ?? 1;
    cursor.lastFrameAt = performance.now();
  }, [simulationTimeHours, simulationRunning, clockProfileId]);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    const host = hostRef.current;
    if (!host) return;

    const load = async () => {
      try {
        const [portsResponse, nodesResponse] = await Promise.all([
          fetch(`${API}/network/ports`).catch(() => null),
          fetch(`${API}/network/nodes`).catch(() => null),
        ]);
        const ports = portsResponse?.ok ? await portsResponse.json() as PortRecord[] : [];
        const nodes = nodesResponse?.ok ? await nodesResponse.json() as NodeRecord[] : [];
        if (!portsResponse?.ok || !nodesResponse?.ok) setError('Live port or route data is unavailable. Showing the global view without that layer.');
        if (disposed) return;
        setPortCount(ports.length);

        const scene = new THREE.Scene();
        scene.background = null;
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0.12, 6.9);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        host.replaceChildren(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional globe with WPI ports, planned route arcs, and simulated vessels');

        const globeGroup = new THREE.Group();
        scene.add(globeGroup);
        addStarfield(scene);
        const portGroup = new THREE.Group();
        portsRef.current = ports;
        if (dataRef.current.showPorts) addPorts(portGroup, ports);
        globeGroup.add(portGroup);
        portsGroupRef.current = portGroup;
        const landTexture = new THREE.TextureLoader().load('/visual_component/world-land.svg');
        // Natural Earth's equirectangular image starts at 180°W, while the
        // sphere's default UV seam starts at 0°. Shift the texture half a turn
        // so coastlines line up with vessel and port longitude coordinates.
        landTexture.wrapS = THREE.RepeatWrapping;
        landTexture.offset.x = 0.5;
        landTexture.colorSpace = THREE.SRGBColorSpace;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS, 128, 96),
          new THREE.MeshStandardMaterial({ color: 0xffffff, map: landTexture, roughness: 0.98, metalness: 0 }),
        );
        globeGroup.add(sphere);
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS * 1.035, 96, 64),
          new THREE.MeshBasicMaterial({ color: 0x64bfce, transparent: true, opacity: 0.09, side: THREE.BackSide, depthWrite: false }),
        );
        globeGroup.add(atmosphere);
        addGraticule(globeGroup);
        globeGroupRef.current = globeGroup;
        nodesRef.current = nodes;
        const dynamicGroup = new THREE.Group();
        dynamicGroupRef.current = dynamicGroup;
        const visibleRoutes = dataRef.current.showRoutes
          ? addRouteLines(dynamicGroup, dataRef.current.routes, 0xffad72, 0.018, 0.58) + addActiveRoutes(dynamicGroup, dataRef.current.vessels, nodes)
          : 0;
        setRouteCount(visibleRoutes);
        if (dataRef.current.showShips) addVessels(dynamicGroup, dataRef.current.vessels, nodes, dataRef.current.selectedVesselId);
        globeGroup.add(dynamicGroup);

        scene.add(new THREE.HemisphereLight(0xb4d8db, 0x101b27, 1.3));
        const keyLight = new THREE.DirectionalLight(0xffdfc0, 2.1);
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
          const cursor = simulationCursor.current;
          if (cursor.running) cursor.visualHours += Math.max(0, time - cursor.lastFrameAt) / 1000 * cursor.rate;
          cursor.lastFrameAt = time;
          const liveGroup = dynamicGroupRef.current;
          if (liveGroup) updateVesselPositions(liveGroup, dataRef.current.vessels, nodesRef.current, cursor.visualHours);
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
          landTexture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          dynamicGroupRef.current = null;
          globeGroupRef.current = null;
          portsGroupRef.current = null;
          portsRef.current = [];
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
    const portGroup = portsGroupRef.current;
    if (!globeGroup || !portGroup) return;
    if (showPorts && portGroup.children.length === 0) addPorts(portGroup, portsRef.current);
    if (!showPorts && portGroup.children.length > 0) {
      for (const child of [...portGroup.children]) {
        portGroup.remove(child);
        if (child instanceof THREE.Points) {
          child.geometry.dispose();
          const material = child.material;
          if (Array.isArray(material)) material.forEach(item => item.dispose());
          else material.dispose();
        }
      }
    }
  }, [showPorts]);

  useEffect(() => {
    const globeGroup = globeGroupRef.current;
    const previous = dynamicGroupRef.current;
    if (!globeGroup || !previous) return;
    globeGroup.remove(previous);
    disposeGroup(previous);
    const next = new THREE.Group();
    const visibleRoutes = showRoutes
      ? addRouteLines(next, routes, 0xffad72, 0.018, 0.78) + addActiveRoutes(next, vessels, nodesRef.current)
      : 0;
    setRouteCount(visibleRoutes);
    if (showShips) addVessels(next, vessels, nodesRef.current, selectedVesselId);
    globeGroup.add(next);
    dynamicGroupRef.current = next;
  }, [routes, vessels, selectedVesselId, showRoutes, showShips]);

  return <section className="globe-stage" aria-label="Three-dimensional globe">
    <div className="globe-canvas" ref={hostRef} />
    <div className="globe-heading"><span className="globe-live-dot" /><div><strong>Ocean network</strong><small>Drag to rotate · scroll to zoom</small></div></div>
    <div className="globe-counts"><span><strong>{portCount.toLocaleString()}</strong><small>PORTS</small></span><span><strong>{routeCount}</strong><small>ROUTE LEGS</small></span><span><strong>{vessels.length}</strong><small>VESSELS</small></span></div>
    <div className="globe-legend" aria-label="Globe legend"><span><i className="legend-ship" /> In port</span><span><i className="legend-underway" /> Underway</span><span><i className="legend-active-route" /> Vessel routes</span><span><i className="legend-planned-route" /> Planned routes</span></div>
    <div className="globe-caption">Natural Earth coastline · scenario visualization only · not navigational guidance</div>
    {error && <div className="globe-error">{error}</div>}
  </section>;
}
