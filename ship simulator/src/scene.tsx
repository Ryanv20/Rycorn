import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ISO_40_FT_CONTAINER, scaleDimensions } from '../../packages/scale-engine/src/index'

export type SceneVessel = { vesselId: string; vesselType: string; status: string; latitude: number; longitude: number; bearing: number; routeCoordinates?: Array<{ latitude: number; longitude: number }>; destinationName?: string; expectedArrivalAt?: number | null }
export type ViewMode = 'bridge' | 'fleet' | 'chase' | 'bow' | 'high' | 'port' | 'starboard'
export type WeatherMode = 'clear' | 'rain' | 'storm'
type SceneShip = { x: number; z: number; heading: number; speed: number; paused: boolean; walkX: number; walkZ: number }
type Telemetry = { id: string; status: string; heading: number; speed: number; throttle: number; destination: string; eta: string; latitude: number | null; longitude: number | null; routeCoordinates: Array<{ latitude: number; longitude: number }>; simulationTime: number }

function InstrumentDisplay({ kind, telemetry }: { kind: number; telemetry: Telemetry }) {
  const canvas = useMemo(() => document.createElement('canvas'), [])
  const lastDraw = useRef(0)
  const texture = useMemo(() => {
    canvas.width = 512; canvas.height = 256
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [canvas])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastDraw.current < 0.2) return
    lastDraw.current = clock.elapsedTime
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = kind === 0 ? '#0b2830' : kind === 1 ? '#101c30' : kind === 2 ? '#11251f' : '#17202a'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = '#8db7bd'; ctx.font = 'bold 20px monospace'
    ctx.fillText(['ECDIS · ROUTE', 'X-BAND RADAR', 'ENGINE & TELEGRAPH', 'VOYAGE STATUS'][kind], 18, 30)
    ctx.strokeStyle = '#53b7af'; ctx.fillStyle = '#72d3bc'; ctx.lineWidth = 2
    if (kind === 0) {
      const chart = { left: 22, top: 48, right: 490, bottom: 226 }
      ctx.save(); ctx.beginPath(); ctx.rect(chart.left, chart.top, chart.right - chart.left, chart.bottom - chart.top); ctx.clip()
      ctx.strokeStyle = '#244652'; ctx.lineWidth = 1
      for (let x = chart.left; x <= chart.right; x += 39) { ctx.beginPath(); ctx.moveTo(x, chart.top); ctx.lineTo(x, chart.bottom); ctx.stroke() }
      for (let y = chart.top; y <= chart.bottom; y += 30) { ctx.beginPath(); ctx.moveTo(chart.left, y); ctx.lineTo(chart.right, y); ctx.stroke() }
      const hasFix = telemetry.latitude !== null && telemetry.longitude !== null && Number.isFinite(telemetry.latitude) && Number.isFinite(telemetry.longitude)
      if (hasFix) {
        const origin = { latitude: telemetry.latitude as number, longitude: telemetry.longitude as number }
        const cosLat = Math.cos(origin.latitude * Math.PI / 180)
        const project = (point: { latitude: number; longitude: number }) => ({ x: (point.longitude - origin.longitude) * 111.32 * cosLat, y: (point.latitude - origin.latitude) * 111.32 })
        const route = telemetry.routeCoordinates.map(project)
        const nearestOnRoute = (a: { x: number; y: number }, b: { x: number; y: number }) => {
          const dx = b.x - a.x; const dy = b.y - a.y
          const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)))
          return { x: a.x + dx * t, y: a.y + dy * t, t }
        }
        let start = { x: 0, y: 0 }; let segment = -1; let best = Infinity
        for (let i = 0; i < route.length - 1; i++) {
          const point = nearestOnRoute(route[i], route[i + 1]); const distance = point.x * point.x + point.y * point.y
          if (distance < best) { best = distance; start = point; segment = i }
        }
        const future = segment >= 0 ? [start, ...route.slice(segment + 1)] : []
        const remainingKm = future.reduce((sum, point, i) => i ? sum + Math.hypot(point.x - future[i - 1].x, point.y - future[i - 1].y) : sum, 0)
        const rangeKm = Math.max(35, Math.min(800, remainingKm * 0.16 || 120))
        const scale = 176 / rangeKm
        const pointOnScreen = (point: { x: number; y: number }) => ({ x: 256 + point.x * scale, y: 158 - point.y * scale })
        if (future.length > 1) {
          ctx.beginPath(); future.forEach((point, i) => { const p = pointOnScreen(point); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y) })
          ctx.strokeStyle = '#5ce0b4'; ctx.lineWidth = 3; ctx.shadowColor = '#37f5bd'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0
          const dest = pointOnScreen(future[future.length - 1]); ctx.beginPath(); ctx.arc(dest.x, dest.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffcf72'; ctx.fill()
        }
        for (let r = 1; r <= 2; r++) { ctx.beginPath(); ctx.arc(256, 158, r * 39, 0, Math.PI * 2); ctx.strokeStyle = '#426773'; ctx.lineWidth = 1; ctx.stroke() }
        ctx.save(); ctx.translate(256, 158); ctx.rotate((telemetry.heading * Math.PI) / 180); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 5); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fillStyle = '#f4fbff'; ctx.shadowColor = '#56dcbc'; ctx.shadowBlur = 9; ctx.fill(); ctx.restore()
        ctx.fillStyle = '#a9c7c7'; ctx.font = '12px monospace'; ctx.fillText(`${origin.latitude.toFixed(3)}  ${origin.longitude.toFixed(3)}   HDG ${String(Math.round(telemetry.heading)).padStart(3, '0')}°`, 29, 219)
      } else {
        ctx.fillStyle = '#ffcb74'; ctx.font = 'bold 16px monospace'; ctx.fillText('NO GPS FIX', 202, 143)
      }
      ctx.restore()
      ctx.fillStyle = '#ffffff'; ctx.font = '15px monospace'; ctx.fillText(telemetry.routeCoordinates.length > 1 ? telemetry.destination.slice(0, 25) : 'NO ACTIVE ROUTE', 20, 247)
    } else if (kind === 1) {
      ctx.strokeStyle = '#438579'; ctx.lineWidth = 2
      for (let r = 35; r < 120; r += 28) { ctx.beginPath(); ctx.arc(256, 157, r, 0, Math.PI * 2); ctx.stroke() }
      ctx.beginPath(); ctx.moveTo(256, 45); ctx.lineTo(256 + Math.cos(clock.elapsedTime * 0.8) * 100, 157 + Math.sin(clock.elapsedTime * 0.8) * 100); ctx.strokeStyle = '#69ddb0'; ctx.stroke()
      ;[[190, 110], [314, 169], [278, 87]].forEach(([x, y]) => { ctx.fillStyle = '#ffca70'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill() })
    } else if (kind === 2) {
      ctx.fillStyle = '#d7efe2'; ctx.font = '48px monospace'; ctx.fillText(`${Math.round(telemetry.speed)} kn`, 20, 110)
      ctx.font = '24px monospace'; ctx.fillStyle = '#81c9b1'; ctx.fillText(`${telemetry.throttle}%  ${telemetry.throttle < 0 ? 'ASTERN' : telemetry.throttle > 0 ? 'AHEAD' : 'STOP'}`, 20, 157)
      ctx.fillStyle = '#344a46'; ctx.fillRect(20, 184, 470, 18); ctx.fillStyle = '#67d2a5'; ctx.fillRect(20, 184, Math.max(0, Math.min(470, Math.abs(telemetry.throttle) * 4.7)), 18)
    } else {
      ctx.fillStyle = '#e2f1e8'; ctx.font = '28px monospace'; ctx.fillText(telemetry.id, 20, 89)
      ctx.font = '18px monospace'; ctx.fillStyle = '#8fc9bf'; ctx.fillText(telemetry.status, 20, 126)
      ctx.fillStyle = '#dce8de'; ctx.fillText(`HDG ${String(Math.round(telemetry.heading)).padStart(3, '0')}°`, 20, 172)
      ctx.fillText(`ETA ${telemetry.eta}`, 20, 210)
    }
    texture.needsUpdate = true
  })
  return <mesh position={[0, 0, 0.08]}><planeGeometry args={[2.65, 1.3]} /><meshBasicMaterial map={texture} /></mesh>
}

function Ocean({ simulationTime, weather }: { simulationTime: number; weather: WeatherMode }) {
  const water = useRef<THREE.Mesh>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const lightning = useRef<THREE.PointLight>(null)
  const nextFlash = useRef(5)
  const flashEnd = useRef(0)
  const stars = useRef<THREE.Group>(null)
  const { scene } = useThree()
  const phase = ((simulationTime + 6) % 24) / 24 * Math.PI * 2
  const sunPosition: [number, number, number] = [Math.cos(phase), Math.sin(phase), 0.15]
  useFrame(({ clock }) => {
    const elevation = Math.sin(phase)
    const daylight = THREE.MathUtils.smoothstep(elevation, -0.12, 0.22)
    const dawn = THREE.MathUtils.smoothstep(elevation, -0.14, 0.12) * (1 - THREE.MathUtils.smoothstep(elevation, 0.12, 0.38))
    const dayColor = new THREE.Color('#72b5d1')
    const nightColor = new THREE.Color('#071522')
    const dawnColor = new THREE.Color('#b97968')
    const skyColor = nightColor.clone().lerp(dayColor, daylight).lerp(dawnColor, dawn * 0.5)
    if (weather === 'storm') skyColor.lerp(new THREE.Color('#283544'), 0.72)
    else if (weather === 'rain') skyColor.lerp(new THREE.Color('#445461'), 0.38)
    if (scene.background instanceof THREE.Color) scene.background.copy(skyColor)
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(skyColor)
    if (water.current) {
      const material = water.current.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = (1 - daylight) * (0.12 + Math.sin(clock.elapsedTime * 0.7) * 0.02)
      material.color.set(weather === 'storm' ? '#14232f' : weather === 'rain' ? '#174052' : daylight ? '#17435a' : '#071b29')
      const positions = water.current.geometry.attributes.position as THREE.BufferAttribute
      const waveAmplitude = weather === 'storm' ? 0.42 : weather === 'rain' ? 0.18 : 0.045
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i); const z = positions.getY(i)
        const wave = Math.sin(x * 0.0015 + clock.elapsedTime * (weather === 'storm' ? 2.4 : 1.15))
          * Math.cos(z * 0.0011 - clock.elapsedTime * 0.85) * waveAmplitude
        positions.setZ(i, wave)
      }
      positions.needsUpdate = true
      water.current.geometry.computeVertexNormals()
    }
    if (sun.current) { sun.current.position.set(Math.cos(phase) * 500, Math.max(20, elevation * 500), -160); sun.current.intensity = 0.12 + daylight * 1.6; sun.current.color.set(dawn > 0.2 ? '#f0a06c' : '#d7e9ff') }
    if (stars.current) stars.current.visible = daylight < 0.18 && weather !== 'storm'
    if (lightning.current) {
      if (weather === 'storm' && clock.elapsedTime > nextFlash.current) {
        flashEnd.current = clock.elapsedTime + 0.13
        nextFlash.current = clock.elapsedTime + 4 + Math.random() * 7
      }
      lightning.current.intensity = weather === 'storm' && clock.elapsedTime < flashEnd.current ? 360 : 0
    }
  })
  return <>
    <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[12000, 12000, 64, 64]} />
      <meshStandardMaterial color="#071b29" roughness={0.28} metalness={0.42} emissive="#06313c" emissiveIntensity={0.12} />
    </mesh>
    <fog attach="fog" args={['#071522', 1200, 9000]} />
    <hemisphereLight args={['#9bbbd1', '#081522', 0.82]} />
    <directionalLight ref={sun} position={[0, 300, -160]} color="#d7e9ff" intensity={1.2} />
    <pointLight ref={lightning} position={[0, 55, -45]} color="#c5ddff" intensity={0} distance={500} />
    <Sky distance={9000} sunPosition={sunPosition} rayleigh={weather === 'clear' ? 2.5 : 5} turbidity={weather === 'clear' ? 6 : 14} mieCoefficient={0.004} mieDirectionalG={0.82} />
    <group ref={stars}><Stars radius={2400} depth={1800} count={900} factor={4} saturation={0.1} fade speed={0.05} /></group>
    {Array.from({ length: 150 }, (_, i) => <mesh key={i} position={[-1800 + (i * 271 % 3600), -1.72, -350 - (i * 197 % 5200)]} rotation={[0, (i % 9) * 0.15, 0]}>
      <boxGeometry args={[0.3 + (i % 4) * 0.2, 0.02, 2 + (i % 5)]} /><meshBasicMaterial color={i % 4 === 0 ? '#e1b37b' : '#4c9ca6'} transparent opacity={0.22} />
    </mesh>)}
  </>
}

function Rain({ camera, weather }: { camera: THREE.Camera; weather: WeatherMode }) {
  const group = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(440 * 2 * 3)
    for (let i = 0; i < 440; i++) {
      const x = ((i * 173) % 38) - 19
      const z = ((i * 317) % 56) - 28
      const y = ((i * 97) % 16) + 3
      const p = i * 6
      positions[p] = x; positions[p + 1] = y; positions[p + 2] = z
      positions[p + 3] = x - 0.08; positions[p + 4] = y - 0.42; positions[p + 5] = z - 0.06
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((_, delta) => {
    if (group.current) group.current.position.copy(camera.position)
    const positions = geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < positions.count; i += 2) {
      const y = positions.getY(i) - delta * 1.15
      if (y < -4) {
        const reset = y + 20
        positions.setY(i, reset); positions.setY(i + 1, reset - 0.42)
      } else {
        positions.setY(i, y); positions.setY(i + 1, y - 0.42)
      }
    }
    positions.needsUpdate = true
  })
  return <lineSegments ref={group} geometry={geometry}>
    <lineBasicMaterial color={weather === 'storm' ? '#a9c2d0' : '#c4dce7'} transparent opacity={weather === 'storm' ? 0.55 : 0.3} />
  </lineSegments>
}

function ContainerStack() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const doorBars = useRef<THREE.InstancedMesh>(null)
  const doorHandles = useRef<THREE.InstancedMesh>(null)
  const containerSize = useMemo(() => scaleDimensions(ISO_40_FT_CONTAINER, 0.1), [])
  const corrugation = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let x = 0; x < canvas.width; x += 9) {
      ctx.fillStyle = x % 18 === 0 ? '#bdc5c4' : '#e7eae8'
      ctx.fillRect(x, 0, 3, canvas.height)
      ctx.fillStyle = '#7f898a'; ctx.fillRect(x + 3, 0, 1, canvas.height)
    }
    ctx.fillStyle = '#647074'; ctx.fillRect(0, 5, canvas.width, 2); ctx.fillRect(0, canvas.height - 7, canvas.width, 2)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  const layout = useMemo(() => {
    const entries: Array<{ x: number; y: number; z: number; color: string }> = []
    const colors = ['#b6503f', '#345d83', '#c09743', '#477a68', '#875368', '#b8b7aa']
    // Standard 40 ft ISO proportions at 1:10 scale (12.19 × 2.44 × 2.59 m).
    // The small clearances leave room for corner castings and make the stow read
    // as separate, secured units instead of one solid block.
    for (let tier = 0; tier < 5; tier++) for (let row = 0; row < 12; row++) for (let bay = 0; bay < 11; bay++) {
      entries.push({ x: (row - 5.5) * 0.266, y: 0.55 + tier * 0.271, z: -6.32 + bay * 1.235, color: colors[(tier + bay + row * 2) % colors.length] })
    }
    return entries
  }, [])
  useEffect(() => {
    if (!mesh.current) return
    const matrix = new THREE.Object3D()
    layout.forEach((entry, index) => {
      matrix.position.set(entry.x, entry.y, entry.z)
      matrix.scale.set(containerSize.beam, containerSize.height, containerSize.length)
      matrix.updateMatrix()
      mesh.current!.setMatrixAt(index, matrix.matrix)
      mesh.current!.setColorAt(index, new THREE.Color(entry.color))

      // Four locking rods on the aft door face, with each pair on a door leaf.
      // A single instanced mesh keeps the detailed stow lightweight.
      for (const xOffset of [-0.078, -0.039, 0.039, 0.078]) {
        matrix.position.set(entry.x + xOffset, entry.y, entry.z + 0.612)
        matrix.scale.set(0.0035, 0.225, 0.0035)
        matrix.updateMatrix()
        doorBars.current!.setMatrixAt(index * 4 + (xOffset < 0 ? (xOffset === -0.078 ? 0 : 1) : (xOffset === 0.039 ? 2 : 3)), matrix.matrix)
      }
      for (const yOffset of [-0.055, 0.055]) {
        matrix.position.set(entry.x, entry.y + yOffset, entry.z + 0.614)
        matrix.scale.set(0.205, 0.003, 0.003)
        matrix.updateMatrix()
        doorHandles.current!.setMatrixAt(index * 2 + (yOffset < 0 ? 0 : 1), matrix.matrix)
      }
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    doorBars.current!.instanceMatrix.needsUpdate = true
    doorHandles.current!.instanceMatrix.needsUpdate = true
  }, [layout])
  useEffect(() => () => corrugation.dispose(), [corrugation])
  return <group>
    <instancedMesh ref={mesh} args={[undefined, undefined, layout.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={corrugation} roughness={0.82} metalness={0.16} />
    </instancedMesh>
    <instancedMesh ref={doorBars} args={[undefined, undefined, layout.length * 4]} castShadow>
      <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#27343a" roughness={0.68} metalness={0.62} />
    </instancedMesh>
    <instancedMesh ref={doorHandles} args={[undefined, undefined, layout.length * 2]} castShadow>
      <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#9ba19a" roughness={0.62} metalness={0.7} />
    </instancedMesh>
  </group>
}

function ShipModel({ vessel, position, selected = false, ship, weather }: { vessel: SceneVessel; position: [number, number, number]; selected?: boolean; ship: MutableRefObject<SceneShip>; weather: WeatherMode }) {
  const color = vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING' ? '#48c982'
    : vessel.status === 'LOADING' || vessel.status === 'UNLOADING' || vessel.status === 'ARRIVED' ? '#e9b64f'
      : vessel.status === 'IDLE' ? '#e35e5e' : '#91a8b4'
  const isContainer = vessel.vesselType.toUpperCase().includes('CONTAINER')
  const hull = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-1.72, 7.2); shape.lineTo(-1.72, -11.5); shape.lineTo(-1.15, -12.8); shape.lineTo(0, -13.5); shape.lineTo(1.15, -12.8); shape.lineTo(1.72, -11.5); shape.lineTo(1.72, 7.2); shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.14, bevelThickness: 0.12 })
  }, [])
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    if (selected) group.current.position.set(ship.current.x, 0, ship.current.z - 7.6)
    const sea = weather === 'storm' ? 1 : weather === 'rain' ? 0.45 : 0.1
    group.current.rotation.set(Math.sin(clock.elapsedTime * 0.8 + position[0]) * sea * 0.035, -vessel.bearing * Math.PI / 180, Math.cos(clock.elapsedTime * 0.65 + position[2]) * sea * 0.06, 'YXZ')
  })
  return <group ref={group} position={position} rotation={[0, -vessel.bearing * Math.PI / 180, 0]}>
    <mesh geometry={hull} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.7, 0]} castShadow receiveShadow><meshStandardMaterial color="#293b48" metalness={0.55} roughness={0.4} /></mesh>
    <mesh position={[0, 0.3, -2.7]}><boxGeometry args={[3.25, 0.24, 16]} /><meshStandardMaterial color="#53626a" /></mesh>
    <mesh position={[0, 1.1, 7.6]}><boxGeometry args={[2.2, 1.4, 2.5]} /><meshStandardMaterial color="#d8e1df" /></mesh>
    <mesh position={[0, 1.9, 8]}><boxGeometry args={[2.5, 0.35, 3]} /><meshStandardMaterial color="#edf2e9" /></mesh>
    {isContainer && <ContainerStack />}
    <mesh position={[0, 3.75, 7.8]}><sphereGeometry args={[selected ? 0.68 : 0.5, 12, 8]} /><meshBasicMaterial color={color} /></mesh>
    {selected && <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[15.2, 15.6, 48]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>}
  </group>
}

function BridgeInterior({ telemetry }: { telemetry: Telemetry }) {
  const trim = '#45515a'
  return <group>
    <mesh position={[0, 3.9, -0.25]}><boxGeometry args={[16.2, 0.34, 12.8]} /><meshStandardMaterial color="#141d25" /></mesh>
    <mesh position={[-7.85, 2, -0.25]}><boxGeometry args={[0.32, 4, 12.8]} /><meshStandardMaterial color="#17222b" /></mesh>
    <mesh position={[7.85, 2, -0.25]}><boxGeometry args={[0.32, 4, 12.8]} /><meshStandardMaterial color="#17222b" /></mesh>
    <mesh position={[0, 0.12, 1.1]}><boxGeometry args={[15.7, 0.24, 11.2]} /><meshStandardMaterial color="#111a22" /></mesh>
    {/* Wide, lightly tinted forward and side glazing keeps a standing eye point clear around the horizon. */}
    <mesh position={[0, 2.55, -4.9]}><boxGeometry args={[15.2, 2.65, 0.06]} /><meshPhysicalMaterial color="#9fd8e4" transparent opacity={0.09} roughness={0.12} metalness={0.05} side={THREE.DoubleSide} /></mesh>
    {[-5.05, -1.7, 1.7, 5.05].map(x => <mesh key={x} position={[x, 2.55, -4.9]}><boxGeometry args={[0.14, 2.8, 0.18]} /><meshStandardMaterial color={trim} /></mesh>)}
    <mesh position={[0, 3.9, -4.9]}><boxGeometry args={[15.7, 0.18, 0.2]} /><meshStandardMaterial color={trim} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 7.8, 2.55, 0]} rotation={[0, side * Math.PI / 2, 0]}><boxGeometry args={[9, 2.65, 0.06]} /><meshPhysicalMaterial color="#9fd8e4" transparent opacity={0.09} roughness={0.12} side={THREE.DoubleSide} /></mesh>
      <mesh position={[side * 7.8, 2, 0]}><boxGeometry args={[0.2, 4, 12.8]} /><meshStandardMaterial color={trim} /></mesh>
      <mesh position={[side * 7.2, 0.8, 0]}><boxGeometry args={[1.1, 1.2, 2.2]} /><meshStandardMaterial color="#26333a" metalness={0.42} /></mesh>
    </group>)}
    <mesh position={[0, 1.05, -3.8]}><boxGeometry args={[14.2, 0.24, 1.6]} /><meshStandardMaterial color="#28323a" metalness={0.5} /></mesh>
    {[-5.7, -1.9, 1.9, 5.7].map((x, i) => <group key={x} position={[x, 1.35, -4.35]} rotation={[-0.33, 0, 0]}>
      <mesh><boxGeometry args={[2.9, 1.5, 0.12]} /><meshStandardMaterial color="#10171e" /></mesh>
      <InstrumentDisplay kind={i} telemetry={telemetry} />
    </group>)}
    <mesh position={[0, 0.76, -2.25]}><cylinderGeometry args={[0.56, 0.72, 0.34, 16]} /><meshStandardMaterial color="#36434b" metalness={0.65} /></mesh>
    <mesh position={[0, 1, -2.25]}><cylinderGeometry args={[0.29, 0.29, 0.14, 24]} /><meshStandardMaterial color="#9d794e" metalness={0.68} /></mesh>
    <mesh position={[0, 0.18, 4.6]}><boxGeometry args={[5.2, 0.34, 0.26]} /><meshStandardMaterial color="#101920" /></mesh>
  </group>
}

export function BridgeScene({ ship, fleet, selectedVesselId, viewMode, telemetry, weather }: { ship: MutableRefObject<SceneShip>; fleet: SceneVessel[]; selectedVesselId: string | null; viewMode: ViewMode; telemetry: Telemetry; weather: WeatherMode }) {
  const cabin = useRef<THREE.Group>(null)
  const { camera, gl } = useThree()
  const controls = useRef<any>(null)
  const target = useRef(new THREE.Vector3())
  const lastFollow = useRef(new THREE.Vector3())
  const look = useRef({ dragging: false, x: 0, y: 0, yaw: 0, pitch: 0 })
  useEffect(() => {
    const canvas = gl.domElement
    const down = (event: PointerEvent) => { if (viewMode !== 'bridge') return; event.preventDefault(); look.current.dragging = true; look.current.x = event.clientX; look.current.y = event.clientY; canvas.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => {
      const state = look.current
      if (!state.dragging || viewMode !== 'bridge') return
      state.yaw -= (event.clientX - state.x) * 0.004
      state.pitch = THREE.MathUtils.clamp(state.pitch - (event.clientY - state.y) * 0.004, -0.7, 0.7)
      state.x = event.clientX; state.y = event.clientY
    }
    const up = () => { look.current.dragging = false }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up) }
  }, [gl, viewMode])
  useEffect(() => {
    if (viewMode === 'bridge') return
    const s = ship.current
    const cx = s.x; const cz = s.z - 7.6
    const presets: Record<Exclude<ViewMode, 'bridge'>, { offset: [number, number, number]; target: [number, number, number] }> = {
      fleet: { offset: [0, 32, 44], target: [0, 0, 0] },
      chase: { offset: [0, 5, 27], target: [0, 1.2, -1] },
      bow: { offset: [0, 7, -34], target: [0, 1.2, 2] },
      high: { offset: [0, 72, 28], target: [0, 0, 0] },
      port: { offset: [-36, 10, 2], target: [0, 1.8, 0] },
      starboard: { offset: [36, 10, 2], target: [0, 1.8, 0] },
    }
    const preset = presets[viewMode]
    const vesselRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -s.heading * Math.PI / 180)
    const viewOffset = new THREE.Vector3(...preset.offset).applyQuaternion(vesselRotation)
    const targetOffset = new THREE.Vector3(...preset.target).applyQuaternion(vesselRotation)
    const lookAt = new THREE.Vector3(cx + targetOffset.x, preset.target[1], cz + targetOffset.z)
    camera.position.set(cx + viewOffset.x, preset.offset[1], cz + viewOffset.z)
    camera.lookAt(lookAt)
    if (controls.current) { controls.current.target.copy(lookAt); controls.current.update() }
    lastFollow.current.set(cx, 0, cz)
  }, [camera, ship, viewMode])
  useFrame(({ clock }, delta) => {
    const s = ship.current
    if (viewMode === 'bridge') {
      const yaw = -s.heading * Math.PI / 180
      if (cabin.current) {
      target.current.set(s.x, 2.3 + Math.sin(clock.elapsedTime * (weather === 'storm' ? 2.1 : 1.1)) * (weather === 'storm' ? 0.055 : weather === 'rain' ? 0.025 : 0.008), s.z)
      cabin.current.position.lerp(target.current, 1 - Math.exp(-delta * 9))
      const angleDelta = ((yaw - cabin.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      const smoothYaw = cabin.current.rotation.y + angleDelta * (1 - Math.exp(-delta * 8))
      const roll = Math.sin(clock.elapsedTime * (weather === 'storm' ? 1.8 : 0.75)) * (weather === 'storm' ? 0.065 : weather === 'rain' ? 0.022 : 0.006)
      const pitch = Math.sin(clock.elapsedTime * (weather === 'storm' ? 1.35 : 0.6) + 1.2) * (weather === 'storm' ? 0.035 : 0.01)
      cabin.current.rotation.set(pitch, smoothYaw, roll, 'YXZ')
      const walkOffset = new THREE.Vector3(s.walkX * 0.1, 0, s.walkZ * 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cabin.current.rotation.y)
      camera.position.set(cabin.current.position.x + walkOffset.x, cabin.current.position.y + 0.2, cabin.current.position.z + walkOffset.z)
      const headYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), look.current.yaw)
      const pitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), look.current.pitch)
      camera.quaternion.copy(cabin.current.quaternion).multiply(headYaw).multiply(pitchRotation)
      }
    } else if (controls.current) {
      const dx = s.x - lastFollow.current.x
      const dz = s.z - 7.6 - lastFollow.current.z
      if (dx || dz) {
        camera.position.x += dx; camera.position.z += dz
        controls.current.target.x += dx; controls.current.target.z += dz
        lastFollow.current.set(s.x, 0, s.z - 7.6)
        controls.current.update()
      }
    }
  })
  const active = fleet.find(vessel => vessel.vesselId === selectedVesselId)
  const localPosition = (vessel: SceneVessel, index: number): [number, number, number] => {
    if (!active) return [index * 4, 0, -9]
    const lat = (vessel.latitude - active.latitude) * 111.2
    const lon = (vessel.longitude - active.longitude) * 111.2 * Math.cos(active.latitude * Math.PI / 180)
    const samePortOffset = vessel.latitude === active.latitude && vessel.longitude === active.longitude ? ((index % 5) - 2) * 3.8 : 0
    return [lon * 0.12 + samePortOffset, 0, -7.6 - lat * 0.12]
  }
  return <>
    <color attach="background" args={['#071522']} />
    <Ocean simulationTime={telemetry.simulationTime} weather={weather} />
    {viewMode === 'bridge' && <group ref={cabin} scale={0.1}><BridgeInterior telemetry={telemetry} /></group>}
    {fleet.map((vessel, index) => <ShipModel key={vessel.vesselId} vessel={vessel} position={localPosition(vessel, index)} selected={vessel.vesselId === selectedVesselId} ship={ship} weather={weather} />)}
    {weather !== 'clear' && <Rain camera={camera} weather={weather} />}
    {viewMode !== 'bridge' && <OrbitControls key={viewMode} ref={controls} makeDefault minDistance={8} maxDistance={900} maxPolarAngle={Math.PI / 2.02} enableDamping dampingFactor={0.08} />}
  </>
}
