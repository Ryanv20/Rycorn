import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { sim, stepSim, initSim, truckById, forkliftById, slotById, whById } from '../sim/sim'
import { FRONT_Z } from '../sim/world'
import { useUI } from '../store'
import type { Selection } from '../store'
import { TruckModel, ForkliftModel } from './Vehicles'
import { WarehouseModel } from './Warehouse'
import { World } from './Environment'
import { advanceDayNight, daylightAmount, sunElevation } from './dayNight'

initSim()

const VIEW_OFFSET = new THREE.Vector3(66, 74, 80)
const NETWORK_OVERVIEW = { x: 400, y: 2300, z: 180, targetX: 400, targetZ: -290 }
const NIGHT_SKY = new THREE.Color('#17233b')
const DAY_SKY = new THREE.Color('#eceffa')
const TWILIGHT_SKY = new THREE.Color('#c78375')
const NIGHT_LIGHT = new THREE.Color('#94a9dc')
const DAY_LIGHT = new THREE.Color('#fffaf0')
const TWILIGHT_LIGHT = new THREE.Color('#ffb16e')
const NIGHT_GROUND = new THREE.Color('#33384c')
const DAY_GROUND = new THREE.Color('#d9def0')
const whFocus = (id: string) => {
  const w = whById(id)
  return new THREE.Vector3(w.cx, 0, FRONT_Z + 10 + w.zOffset)
}

function SimDriver() {
  const bump = useUI((s) => s.bump)
  const paused = useUI((s) => s.paused)
  const acc = useRef(0)
  useFrame((_, dt) => {
    if (paused) return
    stepSim(dt)
    acc.current += dt
    if (acc.current > 0.2) {
      acc.current = 0
      bump()
    }
  })
  return null
}

function ConstructViewerOverlay() {
  return <>
    <gridHelper args={[1300, 130, 0x59c7b4, 0x526e78]} position={[285, 0.08, -360]} />
    <group position={[370, 0.12, -430]}>
      <mesh name="Construct Viewer reference cube" position={[0.5, 0.5, 0.5]} userData={{ constructReference: true }}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#59c7b4" wireframe transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Line points={[[0, -0.08, 0], [1, -0.08, 0]]} color="#e88363" lineWidth={1.5} />
      <Line points={[[1.08, 0, 0], [1.08, 1, 0]]} color="#82c58b" lineWidth={1.5} />
      <Line points={[[0, 1.08, 0], [0, 1.08, 1]]} color="#80aee0" lineWidth={1.5} />
      <Html position={[0.5, -0.2, 0]} center><span style={{ color: '#a44e3d', font: '10px monospace', whiteSpace: 'nowrap' }}>X · 1 M</span></Html>
      <Html position={[1.28, 0.5, 0]} center><span style={{ color: '#397847', font: '10px monospace', whiteSpace: 'nowrap' }}>Y · 1 M</span></Html>
      <Html position={[0, 1.18, 0.5]} center><span style={{ color: '#426b9c', font: '10px monospace', whiteSpace: 'nowrap' }}>Z · 1 M</span></Html>
      <Html position={[0.5, 1.5, 0.5]} center><span style={{ padding: '2px 5px', borderRadius: 3, background: '#f4f7f0', color: '#315e4c', font: '10px monospace', whiteSpace: 'nowrap' }}>1 M REFERENCE CUBE</span></Html>
    </group>
  </>
}

function ConstructGridPicker({ active }: { active: boolean }) {
  const { camera, gl } = useThree()
  const setConstructSelection = useUI((s) => s.setConstructSelection)
  const setConstructMarquee = useUI((s) => s.setConstructMarquee)
  useEffect(() => {
    if (!active) return
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08)
    const toCell = (clientX: number, clientY: number, clamp = false) => {
      const bounds = gl.domElement.getBoundingClientRect()
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      if (!hit) return null
      const column = Math.floor((hit.x + 365) / 10)
      const row = Math.floor((hit.z + 1010) / 10)
      if (!clamp && (column < 0 || column >= 130 || row < 0 || row >= 130)) return null
      return { column: THREE.MathUtils.clamp(column, 0, 129), row: THREE.MathUtils.clamp(row, 0, 129) }
    }
    let drag: { pointerId: number; x: number; y: number; cell: { column: number; row: number }; shift: boolean } | null = null
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      const cell = toCell(event.clientX, event.clientY)
      if (!cell) return
      event.preventDefault(); event.stopImmediatePropagation()
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cell, shift: event.shiftKey }
      gl.domElement.setPointerCapture(event.pointerId)
      setConstructMarquee(null)
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault(); event.stopImmediatePropagation()
      const bounds = gl.domElement.getBoundingClientRect()
      const left = Math.max(0, Math.min(drag.x, event.clientX) - bounds.left)
      const top = Math.max(0, Math.min(drag.y, event.clientY) - bounds.top)
      const right = Math.min(bounds.width, Math.max(drag.x, event.clientX) - bounds.left)
      const bottom = Math.min(bounds.height, Math.max(drag.y, event.clientY) - bounds.top)
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) setConstructMarquee({ left, top, width: right - left, height: bottom - top })
    }
    const up = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault(); event.stopImmediatePropagation()
      const start = drag
      const end = toCell(event.clientX, event.clientY, true) ?? start.cell
      const columnMin = Math.min(start.cell.column, end.column), columnMax = Math.max(start.cell.column, end.column)
      const rowMin = Math.min(start.cell.row, end.row), rowMax = Math.max(start.cell.row, end.row)
      const width = columnMax - columnMin + 1, depth = rowMax - rowMin + 1
      const x = -360 + (columnMin + columnMax) * 5
      const z = -1005 + (rowMin + rowMax) * 5
      const region = { key: `${columnMin}:${columnMax}:${rowMin}:${rowMax}`, columnMin, columnMax, rowMin, rowMax, x, z, width, depth, label: `C${columnMin + 1}–C${columnMax + 1} · R${rowMin + 1}–R${rowMax + 1} · ${width * 10} × ${depth * 10} M` }
      setConstructSelection(current => !start.shift ? [region] : current.some(item => item.key === region.key) ? current.filter(item => item.key !== region.key) : [...current, region])
      drag = null
      setConstructMarquee(null)
    }
    gl.domElement.addEventListener('pointerdown', down, true)
    gl.domElement.addEventListener('pointermove', move, true)
    gl.domElement.addEventListener('pointerup', up, true)
    gl.domElement.addEventListener('pointercancel', up, true)
    return () => {
      gl.domElement.removeEventListener('pointerdown', down, true)
      gl.domElement.removeEventListener('pointermove', move, true)
      gl.domElement.removeEventListener('pointerup', up, true)
      gl.domElement.removeEventListener('pointercancel', up, true)
      setConstructMarquee(null)
    }
  }, [active, camera, gl, setConstructSelection, setConstructMarquee])
  return null
}

function selectionPos(sel: Selection): THREE.Vector3 | null {
  if (!sel) return null
  if (sel.type === 'ship') {
    if (sel.id === 'POLA-CARGO-01') return new THREE.Vector3(590, 0, -510)
    const bargeOffset = Number(sel.id.replace('POLA-BARGE-', ''))
    return new THREE.Vector3(556, 0, bargeOffset - 66)
  }
  if (sel.type === 'truck') {
    const t = truckById(sel.id)
    return t ? new THREE.Vector3(t.pos.x, 0, t.pos.z) : null
  }
  if (sel.type === 'forklift') {
    const f = forkliftById(sel.id)
    return f ? new THREE.Vector3(f.pos.x, 0, f.pos.z) : null
  }
  const s = slotById(sel.id)
  return s ? new THREE.Vector3(s.x, 0, s.z) : null
}

function CameraRig({
  light,
  hemisphere,
  ambient,
}: {
  light: React.RefObject<THREE.DirectionalLight | null>
  hemisphere: React.RefObject<THREE.HemisphereLight | null>
  ambient: React.RefObject<THREE.AmbientLight | null>
}) {
  const ref = useRef<CameraControls>(null)
  const camCmd = useUI((s) => s.camCmd)
  const activeWh = useUI((s) => s.activeWh)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const skyColor = useMemo(() => new THREE.Color(), [])
  const sunColor = useMemo(() => new THREE.Color(), [])
  const groundColor = useMemo(() => new THREE.Color(), [])
  const { scene } = useThree()

  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.setLookAt(NETWORK_OVERVIEW.x, NETWORK_OVERVIEW.y, NETWORK_OVERVIEW.z, NETWORK_OVERVIEW.targetX, 0, NETWORK_OVERVIEW.targetZ, false)
    const stop = () => useUI.getState().setFollow(false)
    c.addEventListener('controlstart', stop)
    return () => c.removeEventListener('controlstart', stop)
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!c || !camCmd) return
    const { cmd } = camCmd
    if (cmd.kind === 'warehouse' || cmd.kind === 'home') {
      const id = cmd.kind === 'warehouse' ? cmd.id : activeWh
      if (id === 'all') {
        c.setLookAt(NETWORK_OVERVIEW.x, NETWORK_OVERVIEW.y, NETWORK_OVERVIEW.z, NETWORK_OVERVIEW.targetX, 0, NETWORK_OVERVIEW.targetZ, true)
      } else {
        const t = whFocus(id)
        const p = t.clone().add(VIEW_OFFSET)
        c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true)
      }
    } else if (cmd.kind === 'overview') {
      c.setLookAt(NETWORK_OVERVIEW.x, NETWORK_OVERVIEW.y, NETWORK_OVERVIEW.z, NETWORK_OVERVIEW.targetX, 0, NETWORK_OVERVIEW.targetZ, true)
    } else if (cmd.kind === 'zoom') {
      c.dolly(cmd.dir * c.distance * 0.25, true)
    } else if (cmd.kind === 'rotate') {
      c.rotate((cmd.dir * Math.PI) / 6, 0, true)
    } else if (cmd.kind === 'focus') {
      c.moveTo(cmd.x, 0, cmd.z, true)
    }
    // activeWh intentionally read at command time only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camCmd])

  useFrame((_, dt) => {
    const cycleSeconds = advanceDayNight(dt, useUI.getState().dayNightEnabled)
    const c = ref.current
    if (!c) return
    const { follow, selected } = useUI.getState()
    if (follow) {
      const p = selectionPos(selected)
      if (p) c.moveTo(p.x, 0, p.z, true)
    }
    const l = light.current
    if (l) {
      c.getTarget(tmp)
      const phase = (cycleSeconds / 180) * Math.PI * 2 + Math.PI / 2
      const elevation = sunElevation(cycleSeconds)
      const daylight = daylightAmount(cycleSeconds)
      const twilight = (1 - Math.min(1, Math.abs(elevation) / 0.3)) * 0.55
      l.position.set(
        tmp.x + Math.cos(phase) * 160,
        Math.max(14, 24 + elevation * 120),
        tmp.z + Math.sin(phase) * 160,
      )
      l.intensity = 0.12 + daylight * 2.68
      sunColor.lerpColors(NIGHT_LIGHT, DAY_LIGHT, daylight).lerp(TWILIGHT_LIGHT, twilight)
      l.color.copy(sunColor)
      l.target.position.copy(tmp)
      l.target.updateMatrixWorld()
      const d = Math.min(160, Math.max(50, c.distance * 0.75))
      const cam = l.shadow.camera
      if (cam.right !== d) {
        cam.left = -d
        cam.right = d
        cam.top = d
        cam.bottom = -d
        cam.updateProjectionMatrix()
      }
    }
    const elevation = sunElevation(cycleSeconds)
    const daylight = daylightAmount(cycleSeconds)
    const twilight = (1 - Math.min(1, Math.abs(elevation) / 0.3)) * 0.45
    skyColor.lerpColors(NIGHT_SKY, DAY_SKY, daylight).lerp(TWILIGHT_SKY, twilight)
    if (scene.background instanceof THREE.Color) scene.background.copy(skyColor)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(skyColor)
      scene.fog.near = 700 + daylight * 1100
      scene.fog.far = 3500 + daylight * 3000
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = 0.3 + daylight * 0.75
      hemisphere.current.color.copy(skyColor)
      groundColor.lerpColors(NIGHT_GROUND, DAY_GROUND, daylight)
      hemisphere.current.groundColor.copy(groundColor)
    }
    if (ambient.current) ambient.current.intensity = 0.1 + daylight * 0.2
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={18}
      maxDistance={4300}
      minPolarAngle={0.25}
      maxPolarAngle={1.15}
      dollyToCursor
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      mouseButtons={{ left: 4, middle: 16, right: 1, wheel: 16 }}
      touches={{ one: 256, two: 4096, three: 64 }}
    />
  )
}

const BOX = {
  truck: { size: [3.2, 4.6, 12], y: 2.3, z: 0 },
  forklift: { size: [2.0, 3.0, 4.0], y: 1.5, z: 0.3 },
  ship: { size: [24, 17, 148], y: 8.5, z: 0 },
  barge: { size: [12, 14, 66], y: 7, z: 0 },
  slot: { size: [1.8, 2.0, 1.8], y: 1.0, z: 0 },
} as const

function Brackets({ size }: { size: readonly number[] }) {
  const pts = useMemo(() => {
    const [w, h, d] = size.map((v) => v / 2)
    const k = Math.min(w, h, d) * 0.55
    const out: [number, number, number][] = []
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const c: [number, number, number] = [sx * w, sy * h, sz * d]
          out.push(c, [c[0] - sx * k, c[1], c[2]])
          out.push(c, [c[0], c[1] - sy * k, c[2]])
          out.push(c, [c[0], c[1], c[2] - sz * k])
        }
    return out
  }, [size])
  return <Line points={pts} segments color="#2f6bed" lineWidth={2.2} />
}

function SelectionMarker() {
  const sel = useUI((s) => s.selected)
  useUI((s) => s.tick)
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !sel) return
    if (sel.type === 'truck') {
      const t = truckById(sel.id)
      if (t) g.position.set(t.pos.x, 0, t.pos.z), (g.rotation.y = t.heading)
    } else if (sel.type === 'forklift') {
      const f = forkliftById(sel.id)
      if (f) g.position.set(f.pos.x, 0, f.pos.z), (g.rotation.y = f.heading)
    } else if (sel.type === 'slot') {
      const s = slotById(sel.id)
      if (s) g.position.set(s.x, 0, s.z), (g.rotation.y = 0)
    } else if (sel.id === 'POLA-CARGO-01') {
      g.position.set(590, 0, -510)
      g.rotation.y = 0
    } else {
      const bargeOffset = Number(sel.id.replace('POLA-BARGE-', ''))
      g.position.set(556, 0, bargeOffset - 66)
      g.rotation.y = 0
    }
    if (ring.current) {
      const k = 1 + ((clock.elapsedTime * 0.8) % 1) * 0.35
      ring.current.scale.set(k, k, k)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - ((clock.elapsedTime * 0.8) % 1))
    }
  })
  if (!sel) return null
  const exists = sel.type === 'ship' ? true : sel.type === 'truck' ? truckById(sel.id) : sel.type === 'forklift' ? forkliftById(sel.id) : slotById(sel.id)
  if (!exists) return null
  const b = sel.type === 'ship' ? (sel.id === 'POLA-CARGO-01' ? BOX.ship : BOX.barge) : BOX[sel.type]
  const r = Math.max(b.size[0], b.size[2]) * 0.62
  return (
    <group ref={group}>
      <group position={[0, b.y, b.z]}>
        <Brackets size={b.size} />
        <mesh>
          <boxGeometry args={b.size as unknown as [number, number, number]} />
          <meshBasicMaterial color="#2f6bed" transparent opacity={0.07} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, b.z]}>
        <ringGeometry args={[r * 0.92, r, 48]} />
        <meshBasicMaterial color="#2f6bed" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <Html position={[0, b.size[1] + 0.9, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag tag-selected">{sel.type === 'slot' ? 'Pallet' : sel.id}</div>
      </Html>
    </group>
  )
}

function ForkliftTags() {
  const active = useUI((s) => s.activeWh)
  const sel = useUI((s) => s.selected)
  useUI((s) => s.tick)
  const list = sim.forklifts.filter((f) => f.whId === active && !(sel?.type === 'forklift' && sel.id === f.id))
  return (
    <>
      {list.map((f) => (
        <ForkTag key={f.id} id={f.id} />
      ))}
    </>
  )
}

function ForkTag({ id }: { id: string }) {
  const g = useRef<THREE.Group>(null)
  const f = forkliftById(id)!
  useFrame(() => g.current?.position.set(f.pos.x, 3.3, f.pos.z))
  const short = f.status.replace(/ at Bay \d/, '')
  return (
    <group ref={g}>
      <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag">
          <b>{f.id}</b>
          <span>{short}</span>
        </div>
      </Html>
    </group>
  )
}

function Trucks() {
  useUI((s) => s.tick)
  return (
    <>
      {sim.trucks.map((t) => (
        <TruckModel key={t.id} truck={t} />
      ))}
    </>
  )
}

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const hemisphere = useRef<THREE.HemisphereLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  return (
    <>
      <hemisphereLight ref={hemisphere} args={['#ffffff', '#d9def0', 1.05]} />
      <ambientLight ref={ambient} intensity={0.25} />
      <directionalLight
        ref={light}
        intensity={2.8}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-camera-near={1}
        shadow-camera-far={300}
      />
      <CameraRig light={light} hemisphere={hemisphere} ambient={ambient} />
    </>
  )
}

function Background() {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color('#eceffa')
    scene.fog = new THREE.Fog('#eceffa', 1800, 6500)
  }, [scene])
  return null
}

export default function Scene() {
  const select = useUI((s) => s.select)
  const layers = useUI((s) => s.layers)
  const constructViewer = useUI((s) => s.constructViewer)
  const constructSelection = useUI((s) => s.constructSelection)
  const selected = useUI((s) => s.selected)
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 1, far: 8000, position: [100, 100, 100] }}
      onPointerMissed={() => select(null)}
      gl={{ antialias: true }}
    >
      <Background />
      <SimDriver />
      <Lights />
      <group>
      <World />
      {constructViewer && <>
        <ConstructViewerOverlay />
        {constructSelection.map(cell => <group key={cell.key}>
          <mesh position={[cell.x, 0.1, cell.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cell.width * 10, cell.depth * 10]} /><meshBasicMaterial color="#ffd276" transparent opacity={0.24} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          <Line points={[[cell.x - cell.width * 5, 0.11, cell.z - cell.depth * 5], [cell.x + cell.width * 5, 0.11, cell.z - cell.depth * 5], [cell.x + cell.width * 5, 0.11, cell.z + cell.depth * 5], [cell.x - cell.width * 5, 0.11, cell.z + cell.depth * 5], [cell.x - cell.width * 5, 0.11, cell.z - cell.depth * 5]]} color="#b17b22" lineWidth={2} />
        </group>)}
      </>}
      {layers.warehouses && sim.warehouses.map((w) => (
        <WarehouseModel key={w.id} w={w} />
      ))}
      {layers.vehicles && <Trucks />}
      {layers.vehicles && sim.forklifts.map((f) => (
        <ForkliftModel key={f.id} fl={f} />
      ))}
      {((layers.vehicles && selected?.type !== 'ship') || (layers.port && selected?.type === 'ship')) && <SelectionMarker />}
      {layers.vehicles && <ForkliftTags />}
      </group>
      <ConstructGridPicker active={constructViewer} />
    </Canvas>
  )
}
