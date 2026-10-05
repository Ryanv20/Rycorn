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

function addRoutes(group: THREE.Group, routes: RouteRecord[]): number {
  let count = 0;
  const material = new THREE.LineBasicMaterial({ color: 0xf1a36d, transparent: true, opacity: 0.64 });
  for (const route of routes) {
    for (let pointIndex = 0; pointIndex < route.coordinates.length - 1; pointIndex += 1) {
      const [longitudeA, latitudeA] = route.coordinates[pointIndex];
      const [longitudeB, latitudeB] = route.coordinates[pointIndex + 1];
      const start = vectorFor(latitudeA, longitudeA, RADIUS + 0.014);
      const end = vectorFor(latitudeB, longitudeB, RADIUS + 0.014);
      const middle = start.clone().add(end).normalize().multiplyScalar(RADIUS + 0.09);
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(14));
      group.add(new THREE.Line(geometry, material));
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

function addVessels(group: THREE.Group, vessels: VesselRecord[], nodes: NodeRecord[]): void {
  const positions: number[] = [];
  const activePositions: number[] = [];
  for (const vessel of vessels) {
    const node = nodes.find(item => item.id === vessel.currentNodeId);
    if (!node) continue;
    const target = vessel.status === 'SAILING' ? activePositions : positions;
    target.push(...vectorFor(node.latitude, node.longitude, RADIUS + 0.045).toArray());
  }

  for (const [values, color, size] of [[positions, 0xf2d181, 0.035], [activePositions, 0xff916d, 0.052]] as const) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.98 })));
  }
}

export default function GlobeView({ routes, vessels, selectedVesselId, onSelectVessel }: GlobeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [portCount, setPortCount] = useState(0);
  const [routeCount, setRouteCount] = useState(0);
  const [error, setError] = useState('');

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
        setRouteCount(addRoutes(globeGroup, routes));
        addVessels(globeGroup, vessels, nodes);

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
          const pointHit = intersections.find(hit => hit.object instanceof THREE.Points);
          if (pointHit && vessels.length) onSelectVessel(selectedVesselId ?? vessels[0].vesselId);
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
  }, [routes, vessels, selectedVesselId, onSelectVessel]);

  return <section className="globe-stage" aria-label="Three-dimensional globe">
    <div className="globe-canvas" ref={hostRef} />
    <div className="globe-heading"><span className="globe-live-dot" /><div><strong>Global maritime view</strong><small>Drag to rotate · scroll to zoom</small></div></div>
    <div className="globe-counts"><span>{portCount.toLocaleString()} WPI PORTS</span><span>{routeCount} ROUTE SEGMENTS</span><span>{vessels.length} VESSELS</span></div>
    <div className="globe-caption">Scenario and lane visualization only · not navigational guidance</div>
    {error && <div className="globe-error">{error}</div>}
  </section>;
}
