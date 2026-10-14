'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, CameraControls, Line, Text } from '@react-three/drei'
import * as THREE from 'three'

export interface YardVessel {
  id: string
  type?: string
  capability: string
  deadweightTonnes?: number
  status: string
  currentNodeId: string
  startsAtPort: boolean
  routeTouchesPort: boolean
  currentRoutePath: string[]
  currentVoyageStartedAt?: number
  expectedArrivalAt?: number
  assignedCargoIds: string[]
}

export interface YardNode {
  id: string
  latitude: number
  longitude: number
  name?: string
}

export interface YardDemand {
  id: string
  cargoType: string
  quantity: number
  status: string
}

type Selection = { id: string; title: string; status: string; detail: string } | null
type Point = [number, number]
type WorldPoint = [number, number, number]
const WORLD_SCALE = 6.32 // 10x the previous ground footprint while preserving 3D proportions.
const isTanker = (vessel: YardVessel) => /tanker|oil|liquid|chemical/i.test(`${vessel.type ?? ''} ${vessel.capability}`)

const palette = ['#3e7582', '#c17857', '#71917c', '#d0a16b', '#62799a', '#a7a178']
const VEHICLE_STATIC_OBSTACLES = [
  ...[-130, -95, -60, -25, 10, 45].map(x => ({ x, z: 148, hx: 17, hz: 13 })),
  ...Array.from({ length: 14 }, (_, index) => ({ x: 92 + (index % 7) * 26, z: 82 + Math.floor(index / 7) * 28, hx: 10, hz: 10 })),
    { x: 169, z: 142, hx: 17, hz: 8 },
  { x: 218, z: 142, hx: 20, hz: 13 },
  { x: 260, z: 142, hx: 17, hz: 13 },
]
const clockRates: Record<string, number> = {
  REAL_TIME: 1 / 3600,
  HOUR_PER_SECOND: 1,
  DAY_PER_MINUTE: 0.4,
  FAST_REVIEW: 24,
  MINUTE_PER_SECOND: 1 / 60,
  SIX_HOURS_PER_SECOND: 6,
  WEEK_PER_SECOND: 168,
}

function pointAlongRoute(points: Point[], progress: number): Point {
  if (points.length === 1 || progress >= 1) return points[points.length - 1]
  if (progress <= 0) return points[0]
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = total * progress
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]
    if (remaining <= length || index === lengths.length - 1) {
      const fraction = length === 0 ? 1 : Math.min(1, remaining / length)
      return [
        points[index][0] + (points[index + 1][0] - points[index][0]) * fraction,
        points[index][1] + (points[index + 1][1] - points[index][1]) * fraction,
      ]
    }
    remaining -= length
  }
  return points[points.length - 1]
}

function Block({ position, size, color, rotation, onClick, emissive }: {
  position: WorldPoint
  size: WorldPoint
  color: string
  rotation?: WorldPoint
  onClick?: () => void
  emissive?: string
}) {
  return <mesh position={position} scale={size} rotation={rotation ?? [0, 0, 0]} castShadow receiveShadow onClick={onClick}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color={color} roughness={0.78} emissive={emissive ?? '#000000'} />
  </mesh>
}

function Container({ position, color, size = [4.7, 2.25, 2.35] }: { position: WorldPoint; color: string; size?: WorldPoint }) {
  return <group position={position}>
    <Block position={[0, 0, 0]} size={size} color={color} />
    {[-0.38, -0.19, 0, 0.19, 0.38].map((offset, index) => <Block key={index} position={[size[0] * offset, 0, size[2] / 2 + 0.035]} size={[0.055, size[1] * 0.87, 0.055]} color="#304d50" />)}
    <Block position={[-size[0] / 2 - 0.04, 0, 0]} size={[0.07, size[1] * 0.92, size[2] * 1.03]} color="#33484a" />
    <Block position={[size[0] / 2 + 0.04, 0, 0]} size={[0.07, size[1] * 0.92, size[2] * 1.03]} color="#33484a" />
  </group>
}

function WorldLabel({ children, position, size = 1.4, color = '#314842' }: { children: string; position: WorldPoint; size?: number; color?: string }) {
  return <group position={position}>
    <Suspense fallback={null}>
      <Billboard follow>
        <Text fontSize={size} color={color} anchorX="center" anchorY="middle" outlineWidth={0.09} outlineColor="#f8f7ed" renderOrder={21}>
          {children}
        </Text>
      </Billboard>
    </Suspense>
  </group>
}

function AnimatedWater() {
  const mesh = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const columns = 80
    const rows = 52
    const width = 1000
    const depth = 800
    const positions = new Float32Array((columns + 1) * (rows + 1) * 3)
    const indices: number[] = []
    let cursor = 0
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        positions[cursor++] = -width / 2 + (column / columns) * width
        positions[cursor++] = 0
        positions[cursor++] = -depth / 2 + (row / rows) * depth
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setIndex(indices)
    result.computeVertexNormals()
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }) => {
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const values = positions.array as Float32Array
    const time = clock.elapsedTime
    for (let index = 0; index < values.length; index += 3) {
      const x = values[index]
      const z = values[index + 2]
      values[index + 1] = Math.sin(x * 0.105 + time * 0.7) * 0.12 + Math.cos(z * 0.14 - time * 0.54) * 0.1 + Math.sin((x + z) * 0.045 + time * 0.35) * 0.08
    }
    positions.needsUpdate = true
    if (mesh.current) mesh.current.position.y = -0.6
  })
  return <mesh ref={mesh} geometry={geometry} position={[0, -0.6, -60]} receiveShadow>
    <meshStandardMaterial color="#4b858d" roughness={0.28} metalness={0.16} />
  </mesh>
}

function LightingCycle({ simulationTimeHours, simulationRunning, clockProfileId, previewHour }: {
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  previewHour: number | null
}) {
  const sky = useRef<THREE.Color>(null)
  const fog = useRef<THREE.Fog>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const timeline = useRef({ server: simulationTimeHours, visual: simulationTimeHours + 12 })
  const day = useMemo(() => new THREE.Color('#b7d2ce'), [])
  const dusk = useMemo(() => new THREE.Color('#dfa17a'), [])
  const night = useMemo(() => new THREE.Color('#182d47'), [])
  const moonlight = useMemo(() => new THREE.Color('#a9bac6'), [])
  const current = useMemo(() => new THREE.Color(), [])
  const warm = useMemo(() => new THREE.Color('#ffbd83'), [])
  const sunlight = useMemo(() => new THREE.Color('#fff2d8'), [])
  const hemisphereDay = useMemo(() => new THREE.Color('#f3fbf5'), [])

  useEffect(() => {
    if (simulationTimeHours >= timeline.current.server) timeline.current.visual = Math.max(timeline.current.visual, simulationTimeHours + 12)
    else timeline.current.visual = simulationTimeHours + 12
    timeline.current.server = simulationTimeHours
  }, [simulationTimeHours])

  useFrame(({ clock }, delta) => {
    const rate = clockRates[clockProfileId] ?? 1
    const activeHours = simulationRunning
      ? (timeline.current.visual += Math.min(delta, 0.08) * Math.min(rate, 0.3))
      : simulationTimeHours + 12 + clock.elapsedTime * 0.22
    const hour = ((previewHour ?? activeHours) % 24 + 24) % 24
    const angle = ((hour - 6) / 24) * Math.PI * 2
    const elevation = Math.sin(angle)
    const daylight = THREE.MathUtils.smoothstep(elevation, -0.08, 0.42)
    const twilight = THREE.MathUtils.smoothstep(elevation, -0.34, 0.05) * (1 - THREE.MathUtils.smoothstep(elevation, 0.05, 0.38))
    current.copy(night).lerp(day, daylight).lerp(dusk, twilight * 0.78)
    sky.current?.copy(current)
    if (fog.current) fog.current.color.copy(current)
    if (sun.current) {
      sun.current.position.set(Math.cos(angle) * 95, Math.max(-18, elevation * 115), Math.sin(angle) * 64)
      sun.current.intensity = 0.12 + daylight * 2.35 + twilight * 0.28
      sun.current.color.copy(sunlight).lerp(warm, twilight)
    }
    if (hemi.current) {
      hemi.current.intensity = 0.9 + daylight * 0.95
      hemi.current.color.copy(moonlight).lerp(hemisphereDay, daylight)
      hemi.current.groundColor.set(daylight > 0.25 ? '#667b70' : '#40525a')
    }
  })

  return <>
    <color ref={sky} attach="background" args={['#b7d2ce']} />
    <fog ref={fog} attach="fog" args={['#b7d2ce', 6500, 22000]} />
    <ambientLight intensity={0.4} />
    <hemisphereLight ref={hemi} args={['#f3fbf5', '#667b70', 1.3]} />
    <directionalLight ref={sun} position={[35, 65, 35]} intensity={2.2} color="#fff2d8" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={10} shadow-camera-far={8000} shadow-camera-left={-1900} shadow-camera-right={1900} shadow-camera-top={1550} shadow-camera-bottom={-1550} shadow-bias={-0.00015} shadow-normalBias={0.035} />
  </>
}

function Breakwater({ side }: { side: -1 | 1 }) {
  const rocks = useRef<THREE.InstancedMesh>(null)
  const count = 460
  const rockGeometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const rockMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b7772', roughness: 1 }), [])
  useEffect(() => {
    const instanced = rocks.current
    if (!instanced) return
    const object = new THREE.Object3D()
    const startX = side < 0 ? -150 : 28
    const length = side < 0 ? 150 : 112
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      object.position.set(startX + t * length, 0.8 + (i % 4) * 0.18, -156 + Math.sin(t * Math.PI) * 7 + Math.sin(i * 6.7) * 1.4)
      object.rotation.set(i * 1.7, i * 2.1, i * 0.9)
      const size = 2.4 + (i % 5) * 0.6
      object.scale.set(size, size * 0.7, size * 0.8)
      object.updateMatrix()
      instanced.setMatrixAt(i, object.matrix)
    }
    instanced.instanceMatrix.needsUpdate = true
  }, [side])
  return <>
    <Block position={[side < 0 ? -75 : 84, 0.7, -156]} size={[side < 0 ? 152 : 114, 3.2, 12]} color="#75807a" />
    <Block position={[side < 0 ? -75 : 84, 2.15, -156]} size={[side < 0 ? 148 : 110, 0.38, 9]} color="#c6c5b8" />
    <instancedMesh ref={rocks} args={[rockGeometry, rockMaterial, count]} castShadow receiveShadow />
    <Block position={[side < 0 ? -150 : 140, 7.2, -156]} size={[1.6, 11, 1.6]} color="#a95e49" emissive="#a64d32" />
  </>
}

function InstancedField({ instances, color = '#ffffff', onClick }: {
  instances: Array<{ position: WorldPoint; scale: WorldPoint; color?: string; rotationY?: number }>
  color?: string
  onClick?: () => void
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.78 }), [color])
  useEffect(() => {
    const instanced = mesh.current
    if (!instanced) return
    const object = new THREE.Object3D()
    instances.forEach((instance, index) => {
      object.position.set(...instance.position)
      object.scale.set(...instance.scale)
      object.rotation.set(0, instance.rotationY ?? 0, 0)
      object.updateMatrix()
      instanced.setMatrixAt(index, object.matrix)
      if (instance.color) instanced.setColorAt(index, new THREE.Color(instance.color))
    })
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [instances])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  if (instances.length === 0) return null
  return <instancedMesh ref={mesh} args={[geometry, material, instances.length]} castShadow receiveShadow onClick={onClick} />
}

function ContainerYard({ select }: { select: (selection: Selection) => void }) {
  const instances = useMemo(() => {
    const result: Array<{ position: WorldPoint; scale: WorldPoint; color?: string; rotationY?: number }> = []
    for (let row = 0; row < 14; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        if ((row === 2 || row === 6) && column % 3 === 1) continue
        const stack = 2 + ((row * 3 + column * 7) % 3)
        const x = -146 + column * 10.8
        const z = 45 + row * 5.1
        for (let level = 0; level < stack; level += 1) {
          result.push({
            position: [x, 1.25 + level * 2.55, z],
            scale: [10.8, 2.35, 4.6],
            color: palette[(row * 5 + column * 3 + level) % palette.length],
          })
        }
      }
    }
    return result
  }, [])
  const ribs = useMemo(() => instances.flatMap(({ position, scale }) => [-0.4, -0.2, 0, 0.2, 0.4].map(offset => ({
    position: [position[0] + scale[0] * offset, position[1], position[2] + scale[2] / 2 + 0.06] as WorldPoint,
    scale: [0.07, scale[1] * 0.84, 0.065] as WorldPoint,
  }))), [instances])
  const handleClick = useCallback(() => select({ id: 'LOS-ANGELES-CONTAINER-YARD', title: 'Container yard', status: `${instances.length} visual container units`, detail: 'Large, illustrative terminal storage field. Cargo demand panels above continue to show Rycon DS values.' }), [instances.length, select])
  return <>
    <InstancedField instances={instances} onClick={handleClick} />
    <InstancedField instances={ribs} color="#30494b" onClick={handleClick} />
  </>
}

function Warehouse({ x, z, name, width = 38 }: { x: number; z: number; name: string; width?: number }) {
  return <group>
    <Block position={[x, 0.8, z]} size={[width + 4, 1.6, 25]} color="#adb2a8" />
    <Block position={[x, 7.6, z]} size={[width, 13.6, 23]} color="#d5d4c9" />
    <Block position={[x, 14.6, z]} size={[width + 2, 0.8, 24]} color="#597b7e" />
    <Block position={[x, 15.3, z - 5.9]} size={[width + 4, 0.45, 12]} color="#55767a" rotation={[0.13, 0, 0]} />
    <Block position={[x, 15.3, z + 5.9]} size={[width + 4, 0.45, 12]} color="#64878a" rotation={[-0.13, 0, 0]} />
    {[-0.36, -0.12, 0.12, 0.36].map((fraction, index) => <group key={index}>
      <Block position={[x + width * fraction, 5.8, z - 11.65]} size={[5.8, 8.4, 0.35]} color="#6b918f" />
      <Block position={[x + width * fraction, 4.2, z - 11.42]} size={[4.1, 0.5, 0.18]} color="#d6b875" />
      <Block position={[x + width * fraction, 10.2, z - 11.42]} size={[5.1, 0.35, 0.18]} color="#b6c7bf" />
    </group>)}
    {[-0.36, -0.12, 0.12, 0.36].map((fraction, index) => <group key={`rear-bay-${index}`}>
      <Block position={[x + width * fraction, 5.3, z + 11.65]} size={[5.6, 7.2, 0.4]} color="#71857e" />
      <Block position={[x + width * fraction, 5.2, z + 11.9]} size={[4.4, 5.9, 0.12]} color="#405651" />
      <Block position={[x + width * fraction, 1.55, z + 12.2]} size={[5.8, 0.48, 1.3]} color="#d1a66e" />
      <Block position={[x + width * fraction, 9.3, z + 12.05]} size={[5.8, 0.45, 1]} color="#667f78" />
    </group>)}
    {Array.from({ length: 7 }, (_, index) => <Block key={`window-${index}`} position={[x - width / 2 + 3 + index * (width - 6) / 6, 11.4, z - 11.7]} size={[1.4, 1.1, 0.22]} color="#9fc4c2" emissive="#536e6b" />)}
    <Block position={[x, 1.15, z - 12.05]} size={[width - 5, 0.45, 0.28]} color="#c07957" />
    <WorldLabel position={[x, 11.7, z - 12.25]} size={1.25} color="#36594f">{name}</WorldLabel>
    <Block position={[x - width / 2 + 3.2, 0.55, z + 13.2]} size={[4.5, 1, 0.4]} color="#e5e0ce" />
  </group>
}

function TreeLine({ select }: { select: (selection: Selection) => void }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const trees = useMemo(() => {
    const result: WorldPoint[] = []
    for (let i = 0; i < 50; i += 1) {
      const z = 13 + i * 2.25
      result.push([-146 + Math.sin(i * 2.4) * 3, 0, z], [76 + Math.cos(i * 1.9) * 3, 0, z])
    }
    for (let i = 0; i < 32; i += 1) result.push([-146 + i * 6.7, 0, 196 + Math.sin(i * 2) * 2])
    return result
  }, [])
  const trunkGeometry = useMemo(() => new THREE.CylinderGeometry(0.48, 0.72, 5, 6), [])
  const crownGeometry = useMemo(() => new THREE.ConeGeometry(3.2, 9, 7), [])
  const trunkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#785e45', roughness: 1 }), [])
  const crownMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#658765', roughness: 0.96 }), [])
  useEffect(() => {
    const object = new THREE.Object3D()
    trees.forEach((position, index) => {
      object.position.set(position[0], 2.5, position[2])
      object.scale.setScalar(0.8 + (index % 5) * 0.12)
      object.rotation.set(0, index * 0.4, 0)
      object.updateMatrix()
      trunks.current?.setMatrixAt(index, object.matrix)
      object.position.y = 8.1
      object.scale.multiplyScalar(1 + (index % 3) * 0.14)
      object.updateMatrix()
      crowns.current?.setMatrixAt(index, object.matrix)
    })
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true
  }, [trees])
  const handleClick = useCallback(() => select({ id: 'HARBOR-GREENBELT', title: 'Harbor tree line', status: `${trees.length} visual trees`, detail: 'Illustrative landscaping around roads, terminal buildings, and the port perimeter.' }), [select, trees.length])
  useEffect(() => () => { trunkGeometry.dispose(); crownGeometry.dispose(); trunkMaterial.dispose(); crownMaterial.dispose() }, [trunkGeometry, crownGeometry, trunkMaterial, crownMaterial])
  return <>
    <instancedMesh ref={trunks} args={[trunkGeometry, trunkMaterial, trees.length]} castShadow receiveShadow onClick={handleClick} />
    <instancedMesh ref={crowns} args={[crownGeometry, crownMaterial, trees.length]} castShadow receiveShadow onClick={handleClick} />
  </>
}

function QuayLighting({ count = 72 }: { count?: number }) {
  const poles = useMemo(() => Array.from({ length: count }, (_, index) => index), [count])
  return <>{poles.map(index => {
    const along = index / (count - 1)
    const x = -146 + along * 212
    const z = index < count / 2 ? 28 : 184
    return <group key={index} position={[x, 0, z]}>
      <Block position={[0, 10, 0]} size={[0.42, 20, 0.42]} color="#62736d" />
      <Block position={[0, 20, -1.4]} size={[3.6, 0.32, 0.32]} color="#62736d" />
      <mesh position={[0, 19.5, -2.9]}>
        <boxGeometry args={[1.5, 0.45, 1]} />
        <meshStandardMaterial color="#ffe6aa" emissive="#ffd485" emissiveIntensity={0.12} />
      </mesh>
    </group>
  })}</>
}

function Crane({ x, z = 1, index, select }: { x: number; z?: number; index: number; select: (selection: Selection) => void }) {
  const trolley = useRef<THREE.Group>(null)
  const cable = useRef<THREE.Mesh>(null)
  const spreader = useRef<THREE.Mesh>(null)
  const handleClick = useCallback(() => select({ id: `STS-CRANE-${String(index + 1).padStart(2, '0')}`, title: 'Ship-to-shore crane', status: 'ACTIVE VISUAL MODEL', detail: 'Animated crane asset. Rycon supplies vessel and cargo state; terminal machinery remains a local scene asset for now.' }), [index, select])
  useFrame(({ clock }) => {
    if (!trolley.current || !cable.current || !spreader.current) return
    const phase = clock.elapsedTime * 0.3 + index * 0.8
    trolley.current.position.x = Math.sin(phase) * 5.2
    const lift = 2.6 + (Math.sin(phase * 0.64 + 1) + 1) * 1.8
    cable.current.scale.y = lift
    cable.current.position.y = 22 - lift / 2
    spreader.current.position.y = 22 - lift
  })
  return <group position={[x, 0, z]} onClick={handleClick}>
    <Block position={[-6.3, 11.2, 0]} size={[0.8, 22, 1.1]} color="#eee8d4" />
    <Block position={[6.3, 11.2, 0]} size={[0.8, 22, 1.1]} color="#eee8d4" />
    <Block position={[0, 22.2, 0]} size={[14.1, 0.85, 1.2]} color="#dfd8c4" />
    <Block position={[0, 13.2, -0.6]} size={[12.4, 0.38, 0.65]} color="#708883" />
    <Block position={[-6.3, 0.85, 0.4]} size={[2.8, 1.2, 4.3]} color="#bbb49f" />
    <Block position={[6.3, 0.85, 0.4]} size={[2.8, 1.2, 4.3]} color="#bbb49f" />
    <group ref={trolley}>
      <Block position={[0, 21.4, 0]} size={[3.4, 1.45, 2.7]} color="#c77c57" />
      <mesh ref={cable} position={[0, 18.8, -0.7]}>
        <boxGeometry args={[0.16, 5, 0.16]} /><meshStandardMaterial color="#354e4b" />
      </mesh>
      <mesh ref={spreader} position={[0, 16.2, -0.7]} castShadow>
        <boxGeometry args={[8, 0.5, 4.2]} /><meshStandardMaterial color="#344e4c" />
      </mesh>
    </group>
    <mesh position={[0, 11.5, 0]} onClick={handleClick}>
      <boxGeometry args={[15, 23, 5]} /><meshBasicMaterial transparent opacity={0} />
    </mesh>
  </group>
}

function WarehouseRow({ showDistrictLabel }: { showDistrictLabel: boolean }) {
  return <>
    <Warehouse x={-130} z={148} name="WAREHOUSE 01 · COLD CHAIN" width={30} />
    <Warehouse x={-95} z={148} name="WAREHOUSE 02 · GENERAL CARGO" width={30} />
    <Warehouse x={-60} z={148} name="WAREHOUSE 03 · FREIGHT" width={30} />
    <Warehouse x={-25} z={148} name="WAREHOUSE 04 · COLD CHAIN" width={30} />
    <Warehouse x={10} z={148} name="WAREHOUSE 05 · GENERAL CARGO" width={30} />
    <Warehouse x={45} z={148} name="WAREHOUSE 06 · FREIGHT" width={30} />
    <Warehouse x={218} z={142} name="HARBOR FLEET · MAINTENANCE" width={36} />
    <Warehouse x={260} z={142} name="BREAKBULK · BONDED STORAGE" width={30} />
    <mesh position={[20, -0.08, 164]} receiveShadow>
      <boxGeometry args={[330, 0.14, 8]} />
      <meshStandardMaterial color="#505b58" roughness={0.96} />
    </mesh>
    <mesh position={[20, -0.08, 178]} receiveShadow>
      <boxGeometry args={[330, 0.14, 8]} />
      <meshStandardMaterial color="#505b58" roughness={0.96} />
    </mesh>
    {Array.from({ length: 42 }, (_, index) => <Block key={`warehouse-road-dash-${index}`} position={[-137 + index * 7.8, 0, 164]} size={[3.5, 0.04, 0.24]} color="#eadcae" />)}
    <Block position={[20, 0.5, 171]} size={[330, 1, 2]} color="#7b8279" />
    {showDistrictLabel && <WorldLabel position={[0, 5.2, 153]} size={1.8} color="#e3e5d7">LOS ANGELES PORT LOGISTICS DISTRICT</WorldLabel>}
  </>
}

function RoadsAndApron() {
  return <>
    <mesh position={[-35, -0.48, 120]} receiveShadow>
      <boxGeometry args={[230, 0.75, 160]} />
      <meshStandardMaterial color="#c4c9bd" roughness={0.94} />
    </mesh>
    <mesh position={[20, -0.06, 128]} receiveShadow>
      <boxGeometry args={[330, 0.18, 12]} />
      <meshStandardMaterial color="#505b58" roughness={0.96} />
    </mesh>
    <mesh position={[0, 0.05, 17]} receiveShadow>
      <boxGeometry args={[205, 0.14, 29]} />
      <meshStandardMaterial color="#d2d0c1" roughness={0.95} />
    </mesh>
    {Array.from({ length: 42 }, (_, index) => <Block key={`road-dash-${index}`} position={[-137 + index * 7.8, 0.1, 128]} size={[3.4, 0.05, 0.25]} color="#eadcae" />)}
    <Block position={[-35, 0.15, 40]} size={[230, 0.3, 3]} color="#b99f78" />
    <Block position={[-35, 0.37, 37]} size={[230, 0.25, 0.6]} color="#d08b68" />
    {Array.from({ length: 70 }, (_, index) => <Block key={`quay-pavers-${index}`} position={[-149 + index * 3.3, 1.46, 37]} size={[1.55, 0.06, 0.7]} color={index % 2 === 0 ? '#e6d7b7' : '#bd7758'} />)}
    {Array.from({ length: 24 }, (_, index) => <Block key={`lane-${index}`} position={[-90 + index * 7.8, 0.08, 64]} size={[0.22, 0.02, 25]} color="#e3e0d4" />)}
    <Block position={[-35, 0.25, 37]} size={[230, 1.9, 9.2]} color="#8d958e" />
    <Block position={[-35, 1.28, 37]} size={[230, 0.28, 8.8]} color="#bec0b2" />
    {Array.from({ length: 52 }, (_, index) => <Block key={`bollard-${index}`} position={[-148 + index * 4.4, 2.1, 32]} size={[0.72, 1.6, 0.72]} color="#293e3f" />)}
    {Array.from({ length: 48 }, (_, index) => <Block key={`fender-${index}`} position={[-143 + index * 4.5, 0.8, 31]} size={[1.7, 1.2, 0.5]} color="#384c4b" />)}
  </>
}

function HarborCarPark() {
  return <group>
    <Block position={[180, -0.02, 57]} size={[190, 0.18, 28]} color="#747d77" />
    {Array.from({ length: 16 }, (_, index) => <Block key={`parking-west-${index}`} position={[99 + index * 10.5, 0.09, 50]} size={[0.18, 0.035, 8]} color="#e8e2ce" />)}
    {Array.from({ length: 16 }, (_, index) => <Block key={`parking-east-${index}`} position={[99 + index * 10.5, 0.09, 64]} size={[0.18, 0.035, 8]} color="#e8e2ce" />)}
    <Block position={[180, 0.09, 57]} size={[188, 0.035, 0.2]} color="#e8e2ce" />
    {[-1, 1].map(side => <group key={side} position={[side < 0 ? 115 : 205, 0, 57]}>
      <Block position={[0, 4.2, 0]} size={[5.5, 0.4, 18]} color="#a8b1a6" />
      <Block position={[-2.3, 2.1, -7.8]} size={[0.45, 4.2, 0.45]} color="#566c64" />
      <Block position={[2.3, 2.1, -7.8]} size={[0.45, 4.2, 0.45]} color="#566c64" />
      <Block position={[-2.3, 2.1, 7.8]} size={[0.45, 4.2, 0.45]} color="#566c64" />
      <Block position={[2.3, 2.1, 7.8]} size={[0.45, 4.2, 0.45]} color="#566c64" />
    </group>)}
    <Block position={[251, 3.8, 58]} size={[13, 7.6, 12]} color="#d5d4c9" />
    <Block position={[251, 7.8, 58]} size={[14, 0.45, 13]} color="#587b7b" />
    <Block position={[257, 1.6, 58]} size={[0.16, 2.7, 5]} color="#8fb5b4" />
    <WorldLabel position={[180, 13, 58]} size={1.6}>PORT EMPLOYEE · VISITOR PARKING</WorldLabel>
  </group>
}

function LiquidBulkDistrict() {
  const tanks = useMemo(() => Array.from({ length: 14 }, (_, index) => ({
    x: 92 + (index % 7) * 26,
    z: 82 + Math.floor(index / 7) * 28,
    radius: 7.2 + (index % 3) * 1.4,
    height: 12 + (index % 3) * 3,
  })), [])
  return <>
    {/* Joined Wilmington backland connects to the main apron, avoiding the detached slab in the earlier layout. */}
    <mesh position={[180, -0.465, 119]} receiveShadow>
      <boxGeometry args={[200, 0.72, 154]} />
      <meshStandardMaterial color="#c4c9bd" roughness={0.94} />
    </mesh>
    <Block position={[160, 0.65, 39]} size={[140, 1.4, 8]} color="#848f86" />
    {Array.from({ length: 5 }, (_, index) => <group key={`liquid-berth-${index}`} position={[96 + index * 32, 0, 42]}>
      <Block position={[0, 2.3, 0]} size={[1.4, 3.4, 1.4]} color="#5c6c66" />
      <Block position={[0, 4.15, 0]} size={[2, 0.3, 2]} color="#cfaa6d" />
    </group>)}
    {tanks.map(({ x, z, radius, height }, index) => <group key={`tank-${index}`} position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 20]} />
        <meshStandardMaterial color={index % 3 === 0 ? '#b8b8a9' : '#a4b0a6'} roughness={0.82} />
      </mesh>
      <mesh position={[0, height + 0.12, 0]}>
        <cylinderGeometry args={[radius * 0.99, radius * 0.99, 0.24, 20]} />
        <meshStandardMaterial color="#747f77" roughness={0.8} />
      </mesh>
      <mesh position={[0, height * 0.58, 0]}>
        <cylinderGeometry args={[radius + 0.12, radius + 0.12, 0.35, 20]} />
        <meshStandardMaterial color="#5e706b" roughness={0.88} />
      </mesh>
    </group>)}
    {[2.8, 5.2, 7.6].map((height, index) => <mesh key={`tank-pipe-${index}`} position={[176, height, 73]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[0.55, 0.55, 166, 10]} />
      <meshStandardMaterial color={index === 1 ? '#b79360' : '#657a74'} metalness={0.42} roughness={0.55} />
    </mesh>)}
    {Array.from({ length: 9 }, (_, index) => <Block key={`pipe-support-${index}`} position={[98 + index * 19.5, 4.9, 73]} size={[0.8, 10, 1]} color="#566c65" />)}
    {[0, 1, 2, 3].map(index => <group key={`loading-arm-${index}`} position={[100 + index * 42, 0, 44]}>
      <Block position={[0, 5, 0]} size={[1.1, 10, 1.1]} color="#6f7f76" />
      <Block position={[0, 10, 2.8]} size={[0.65, 0.65, 5.6]} color="#c0985e" />
      <mesh position={[0, 8.4, 5.4]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.2, 0.26, 8, 12, Math.PI]} /><meshStandardMaterial color="#b28b59" metalness={0.35} /></mesh>
    </group>)}
    <Block position={[169, 5.5, 142]} size={[31, 11, 16]} color="#b7b8aa" />
    <Block position={[169, 11.4, 142]} size={[33, 1, 18]} color="#627c78" />
    <Block position={[155, 4.6, 133.6]} size={[6, 9.2, 0.25]} color="#819c98" />
    <Block position={[169, 4.6, 133.6]} size={[6, 9.2, 0.25]} color="#819c98" />
    <Block position={[183, 4.6, 133.6]} size={[6, 9.2, 0.25]} color="#819c98" />
    <WorldLabel position={[145, 21, 118]} size={2.2}>WILMINGTON · LIQUID BULK</WorldLabel>
    {['KINDER MORGAN', 'PHILLIPS 66', 'NUSTAR', 'VALERO', 'SHELL', 'VOPAK', 'PBF ENERGY'].map((operator, index) => <WorldLabel key={operator} position={[92 + index * 26, 15, 65]} size={1.35}>{operator}</WorldLabel>)}
    <WorldLabel position={[170, 17, 142]} size={1.8}>HARBOR PROCESSING</WorldLabel>
  </>
}

function PortGeography() {
  const islandCargo = useMemo(() => {
    const result: Array<{ position: WorldPoint; scale: WorldPoint; color?: string }> = []
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const stack = 2 + ((row + column) % 2)
        for (let level = 0; level < stack; level += 1) result.push({
          position: [-37 + column * 12, 1.97 + level * 2.5, -85 + row * 13],
          scale: [11.5, 2.25, 5.1],
          color: palette[(row * 3 + column + level) % palette.length],
        })
      }
    }
    return result
  }, [])
  const pierCargo = useMemo(() => Array.from({ length: 48 }, (_, index) => ({
    position: [82 + (index % 8) * 10, 1.95 + (Math.floor(index / 8) % 3) * 2.4, -145 + Math.floor(index / 8) * 6] as WorldPoint,
    scale: [9.2, 2.2, 5.3] as WorldPoint,
    color: palette[index % palette.length],
  })), [])
  return <>
    <mesh position={[30, -0.06, -54]} receiveShadow>
      <boxGeometry args={[148, 1.8, 92]} />
      <meshStandardMaterial color="#8c9990" roughness={0.92} />
    </mesh>
    <Block position={[30, 0.9, -101]} size={[146, 0.5, 3.6]} color="#c8b991" />
    <Block position={[30, 0.85, -8]} size={[143, 0.4, 2.8]} color="#b1b5a5" />
    <Block position={[35, 0.76, -53]} size={[126, 0.16, 9]} color="#505b58" />
    <InstancedField instances={islandCargo} />
    <WorldLabel position={[30, 24, -52]} size={3.1} color="#e5e5d8">TERMINAL ISLAND</WorldLabel>
    <WorldLabel position={[-103, 2.5, -35]} size={2.5} color="#cfe0d7">WEST BASIN</WorldLabel>
    <WorldLabel position={[148, 2.5, -38]} size={2.5} color="#cfe0d7">EAST BASIN</WorldLabel>
    <WorldLabel position={[-110, 18, 25]} size={2}>WBCT · BERTHS 100–127</WorldLabel>
    <WorldLabel position={[-35, 18, 22]} size={2}>TRAPAC · BERTHS 136–147</WorldLabel>
    <WorldLabel position={[58, 18, -30]} size={2}>YUSEN · BERTHS 212–225</WorldLabel>
    <WorldLabel position={[55, 18, -73]} size={2}>EVERPORT · BERTHS 226–236</WorldLabel>
    <WorldLabel position={[112, 3, 28]} size={2.2} color="#cfe0d7">CERRITOS CHANNEL</WorldLabel>
    <WorldLabel position={[18, 3, -161]} size={2.2} color="#cfe0d7">MAIN CHANNEL</WorldLabel>
    <mesh position={[127, -0.04, -124]} receiveShadow>
      <boxGeometry args={[104, 1.76, 56]} />
      <meshStandardMaterial color="#8b968e" roughness={0.92} />
    </mesh>
    <Block position={[80, 0.72, -87]} size={[44, 0.32, 48]} color="#777f77" />
    <WorldLabel position={[86, 18, -57]} size={2}>FENIX · BERTHS 302–305</WorldLabel>
    <InstancedField instances={pierCargo} />
    <WorldLabel position={[128, 20, -124]} size={2.7} color="#e5e5d8">PIER 400 · APM TERMINALS</WorldLabel>
    <LiquidBulkDistrict />
  </>
}

function BerthPositions(): Point[] {
  const berths: Point[] = [
    [-144, 27], [-114, 27], [-84, 27], [-54, 27], [-24, 27], [6, 27], [36, 27], [66, 27],
    [-132, -80], [-132, -50], [-132, -20], [-132, 10],
    [190, -80], [190, -50], [190, -20], [190, 10],
    [-65, -115], [-25, -115], [15, -115], [55, -115],
  ]
  // Extra live arrivals wait in separated outer-roadstead positions instead of stacking on one berth.
  for (let index = 0; index < 32; index += 1) berths.push([-330 + (index % 16) * 44, -230 - Math.floor(index / 16) * 32])
  return berths
}

function routeForBerth(x: number, z: number, side: number): Point[] {
  if (x >= 100) return [[x, z], [x + 22, z - 16], [190, -126], [190, -164], [120, -184], [20 + side * 3, -194]]
  if (z <= -100) return [[x, z], [x - 22, -136], [-118, -162], [20 + side * 3, -194]]
  return [[x, z], [x - 18, z - 24], [-132, -88], [-132, -142], [-92, -174], [20 + side * 3, -194]]
}

function ShipCargoLoad({ berth, cargoIds }: { berth: number; cargoIds: string[] }) {
  const containers = useMemo(() => {
    const result: Array<{ position: WorldPoint; scale: WorldPoint; color?: string }> = []
    const cargoCount = Math.min(24, cargoIds.length)
    for (let index = 0; index < cargoCount; index += 1) {
      const row = Math.floor(index / 6)
      const column = index % 6
        result.push({
          position: [-7.2 + column * 2.45, 3.85 + row * 2.05, ((row + column) % 2) * 2.45 - 1.2],
          scale: [2.3, 1.8, 2.2],
          color: palette[(column + row + berth) % palette.length],
        })
    }
    return result
  }, [berth, cargoIds])
  const ribs = useMemo(() => containers.flatMap(({ position, scale }) => [-0.38, 0, 0.38].map(offset => ({
    position: [position[0] + scale[0] * offset, position[1], position[2] + scale[2] / 2 + 0.04] as WorldPoint,
    scale: [0.05, scale[1] * 0.83, 0.04] as WorldPoint,
  }))), [containers])
  if (containers.length === 0) return null
  return <>
    <InstancedField instances={containers} />
    <InstancedField instances={ribs} color="#30494b" />
  </>
}

function Ship({ vessel, berth, nodes, portNodeId, portLatitude, simulationTimeHours, simulationRunning, clockProfileId, select }: {
  vessel: YardVessel
  berth: number
  nodes: YardNode[]
  portNodeId: string
  portLatitude: number
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  select: (selection: Selection) => void
}) {
  const group = useRef<THREE.Group>(null)
  const cursor = useRef({ server: simulationTimeHours, visual: simulationTimeHours, running: simulationRunning, rate: clockRates[clockProfileId] ?? 1 })
  const slots = useMemo(BerthPositions, [])
  const tanker = isTanker(vessel)
  const tankerPosition = (berth < 5
    ? [[96, 28], [128, 28], [160, 28], [192, 28], [224, 28]][berth]
    : [-330 + ((berth - 5) % 16) * 44, -230 - Math.floor((berth - 5) / 16) * 32]) as Point
  const berthPosition = tanker ? tankerPosition : slots[berth] ?? [-410 + ((berth - slots.length) % 20) * 44, -310 - Math.floor((berth - slots.length) / 20) * 36] as Point
  const side = useMemo(() => {
    const nodeById = new Map(nodes.map(node => [node.id, node]))
    const pathNodes = vessel.currentRoutePath.map(id => nodeById.get(id)).filter((node): node is YardNode => Boolean(node))
    const portIndex = pathNodes.findIndex(node => node.id === portNodeId)
    if (portIndex < 0 || pathNodes.length < 2) return berth % 2 === 0 ? -1 : 1
    const remote = portIndex === 0 ? pathNodes[pathNodes.length - 1] : pathNodes[0]
    return Math.sign((remote.longitude - pathNodes[portIndex].longitude) * Math.cos(portLatitude * Math.PI / 180)) || 1
  }, [nodes, portLatitude, portNodeId, vessel.currentRoutePath, berth])
  const localRoute = useMemo<Point[]>(() => tanker && berth < 5
    ? [[berthPosition[0], berthPosition[1]], [224, 8], [232, -70], [225, -150], [120, -184], [20 + side * 3, -194]]
    : routeForBerth(berthPosition[0], berthPosition[1], side), [berthPosition, side, tanker, berth])
  const sailing = ['SAILING', 'REPOSITIONING'].includes(vessel.status) && vessel.currentRoutePath.length > 1
  const startAtPort = vessel.currentRoutePath[0] === portNodeId
  const motionRoute = useMemo(() => sailing && !startAtPort ? [...localRoute].reverse() : localRoute, [sailing, startAtPort, localRoute])
  const hull = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-11, -3.2)
    shape.lineTo(8.7, -3.2)
    shape.lineTo(12.2, -1.4)
    shape.lineTo(10.1, 3.1)
    shape.lineTo(-8.8, 3.1)
    shape.lineTo(-11, -3.2)
    return shape
  }, [])
  useEffect(() => {
    const time = cursor.current
    if (simulationTimeHours < time.server) time.visual = simulationTimeHours
    else time.visual = Math.max(time.visual, simulationTimeHours)
    time.server = simulationTimeHours
    time.running = simulationRunning
    time.rate = clockRates[clockProfileId] ?? 1
  }, [simulationTimeHours, simulationRunning, clockProfileId])
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    let position = berthPosition
    let heading = 0
    if (sailing) {
      const time = cursor.current
      if (time.running) time.visual += Math.min(delta, 0.1) * Math.min(time.rate, 48)
      const start = vessel.currentVoyageStartedAt ?? time.server
      const end = vessel.expectedArrivalAt ?? start + 72
      const progress = end <= start ? 1 : Math.max(0, Math.min(1, (time.visual - start) / (end - start)))
      position = pointAlongRoute(motionRoute, progress)
      const ahead = pointAlongRoute(motionRoute, Math.min(1, progress + 0.003))
      heading = Math.atan2(-(ahead[1] - position[1]), ahead[0] - position[0])
    }
    group.current.position.set(position[0], 0.5 + Math.sin(clock.elapsedTime * 1.1 + berth) * 0.12, position[1])
    group.current.rotation.y = heading
  })
  const handleClick = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    select({
      id: vessel.id,
      title: vessel.type ?? (tanker ? 'Liquid bulk tanker' : 'Vessel'),
      status: vessel.status,
      detail: `${vessel.capability} capability · ${vessel.deadweightTonnes ? `${vessel.deadweightTonnes.toLocaleString()} t DWT` : 'capacity not supplied'} · ${vessel.assignedCargoIds.length} assigned cargo${sailing ? ' · following the live local sea lane' : ' · moored with wave motion'}`,
    })
  }, [select, sailing, vessel, tanker])
  return <>
    {sailing && <Line points={motionRoute.map(([x, z]) => [x, 0.24, z] as WorldPoint)} color="#f27d57" lineWidth={3.2} transparent opacity={0.9} />}
    <group ref={group} position={[berthPosition[0], 0.5, berthPosition[1]]} onClick={handleClick}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.35, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[hull, { depth: 2.3, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.3, bevelThickness: 0.3 }]} />
        <meshStandardMaterial color={tanker ? '#6c7972' : vessel.type === 'BULK_CARRIER' ? '#627d83' : '#456b79'} roughness={0.43} metalness={0.1} />
      </mesh>
      <Block position={[0, 1.38, -3.48]} size={[20.5, 0.46, 0.24]} color={tanker ? '#d5ad68' : '#df8f65'} />
      <Block position={[0, 1.38, 3.48]} size={[20.5, 0.46, 0.24]} color={tanker ? '#d5ad68' : '#df8f65'} />
      {!tanker && vessel.assignedCargoIds.length === 0 && [-5.3, 0, 5.3].map((x, index) => <Block key={`empty-hold-${index}`} position={[x, 3.03, 0]} size={[4.4, 0.16, 4.65]} color="#697a76" />)}
      {tanker ? <TankerDeck /> : <ShipCargoLoad berth={berth} cargoIds={vessel.assignedCargoIds} />}
      <Block position={[8.2, 5.95, 1.5]} size={[3.8, 6, 4.3]} color="#eee9d9" />
      <Block position={[8.2, 7.4, 3.7]} size={[1.5, 1, 0.14]} color="#85aeb0" />
      <WorldLabel position={[0, 13.6, 0]} size={1.15}>{`${vessel.id} · ${vessel.status}`}</WorldLabel>
      <mesh position={[0, 5.2, 0]}>
        <boxGeometry args={[25, 12.5, 8.5]} /><meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  </>
}

function TankerDeck() {
  return <>
    {[-6, 0, 6].map((x, index) => <group key={x} position={[x, 4.55, 0]}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[2.05, 2.05, 3.2, 16]} /><meshStandardMaterial color={index === 1 ? '#b7b5a5' : '#c2c0b0'} roughness={0.7} /></mesh>
      <mesh position={[0, 1.65, 0]}><cylinderGeometry args={[1.95, 1.95, 0.18, 16]} /><meshStandardMaterial color="#566b67" /></mesh>
    </group>)}
    <Block position={[0, 5.2, 0]} size={[18, 0.32, 0.48]} color="#bd9a68" />
  </>
}

function Tugboat({ index, select }: { index: number; select: (selection: Selection) => void }) {
  const group = useRef<THREE.Group>(null)
  const hull = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-4.5, -1.25); shape.lineTo(3.1, -1.25); shape.lineTo(4.6, 0); shape.lineTo(3.1, 1.25); shape.lineTo(-3.7, 1.25); shape.closePath()
    return shape
  }, [])
  const route: Point[] = useMemo(() => index === 0
    ? [[-140, 8], [-143, -35], [-144, -90], [-130, -145], [-82, -174], [-16, -188], [10, -194]]
    : [[190, 12], [196, -32], [198, -88], [194, -145], [164, -174], [88, -188], [24, -194]], [index])
  const selectTug = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    select({ id: `PORT-TUG-${String(index + 1).padStart(2, '0')}`, title: 'Harbor tugboat', status: 'ACTIVE HARBOR CRAFT', detail: 'One of two harbor tugs patrolling the west or east approach channel.' })
  }, [index, select])
  useFrame(({ clock }) => {
    if (!group.current) return
    const progress = (clock.elapsedTime * (0.014 + index * 0.001) + index * 0.23) % 1
    const position = pointAlongRoute(route, progress)
    const next = pointAlongRoute(route, (progress + 0.002) % 1)
    group.current.position.set(position[0], 0.34 + Math.sin(clock.elapsedTime * 2 + index) * 0.06, position[1])
    group.current.rotation.y = Math.atan2(-(next[1] - position[1]), next[0] - position[0])
  })
  return <group ref={group} onClick={selectTug}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]} castShadow>
      <extrudeGeometry args={[hull, { depth: 0.8, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.18, bevelThickness: 0.12 }]} />
      <meshStandardMaterial color={index % 2 ? '#cf7f50' : '#d6b25e'} roughness={0.5} />
    </mesh>
    <Block position={[0.6, 2.75, 0]} size={[3.2, 2.5, 2.7]} color="#ece7d8" />
    <Block position={[0.8, 3.15, 1.4]} size={[1.3, 0.8, 0.08]} color="#91b5b4" />
    {[-3.4, 2.8].map(x => <mesh key={x} position={[x, 0.72, 0]}>
      <sphereGeometry args={[0.62, 9, 7]} /><meshStandardMaterial color="#202d32" roughness={0.8} />
    </mesh>)}
    <Line points={[[-4.5, 0.08, -1], [-6.8, 0.08, -2], [-8, 0.08, -2.7]]} color="#cbe6e3" lineWidth={1.4} transparent opacity={0.68} />
    <mesh position={[0, 1, 0]}><boxGeometry args={[9.5, 4.5, 3.8]} /><meshBasicMaterial transparent opacity={0} /></mesh>
  </group>
}

function YardCargo({ demand, index, select }: { demand: YardDemand; index: number; select: (selection: Selection) => void }) {
  const x = -78 + (index % 8) * 22
  const z = 59 + Math.floor(index / 8) * 9
  const stackCount = Math.max(1, Math.min(3, Math.ceil(demand.quantity / 700)))
  const handleClick = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    select({ id: demand.id, title: demand.cargoType || 'Cargo demand', status: demand.status, detail: `${demand.quantity.toLocaleString()} model units · Rycon DS request` })
  }, [demand, select])
  return <group position={[x, 0.3, z]} onClick={handleClick}>
    {Array.from({ length: stackCount }, (_, level) => <Container key={level} position={[0, level * 2.35 + 1.15, 0]} color={palette[(index + level) % palette.length]} />)}
    <WorldLabel position={[0, stackCount * 2.35 + 2, 0]} size={1}>{`${demand.id.slice(0, 22)} · ${demand.status}`}</WorldLabel>
  </group>
}

const vehicleBodies = new Map<string, { x: number; z: number; radius: number }>()

function vehiclePositionBlocked(id: string, x: number, z: number, radius: number) {
  if (VEHICLE_STATIC_OBSTACLES.some(box => Math.abs(x - box.x) < box.hx + radius * 0.18 && Math.abs(z - box.z) < box.hz + radius * 0.18)) return true
  for (const [otherId, body] of vehicleBodies) {
    if (otherId !== id && Math.hypot(x - body.x, z - body.z) < radius + body.radius) return true
  }
  return false
}

function Vehicle({ id, index, kind, selected, driving, cargoType, cameraControls, onSelect, onExit }: {
  id: string
  index: number
  kind: 'YARD TRUCK' | 'YARD CAR' | 'PICKUP'
  cargoType?: string
  selected: boolean
  driving: boolean
  cameraControls: { current: CameraControls | null }
  onSelect: (id: string, position: Point, cargoType?: string) => void
  onExit: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef({ x: -138 + index * 21, z: index % 2 ? 179 : 163, heading: 0, speed: 0 })
  const keys = useRef(new Set<string>())
  const route = useMemo<Point[]>(() => index % 2
    ? [[-143, 179], [183, 179], [183, 163], [-143, 163], [-143, 179]]
    : [[183, 163], [-143, 163], [-143, 179], [183, 179], [183, 163]], [index])
  const dimensions = kind === 'YARD TRUCK' ? [8, 3, 3.6] : kind === 'PICKUP' ? [7.2, 2.8, 3.4] : [6.8, 2.1, 3.2]
  useEffect(() => () => { vehicleBodies.delete(id) }, [id])
  useEffect(() => {
    if (!selected) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()
      if (key === 'escape') onExit()
      else keys.current.add(key)
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    const onBlur = () => keys.current.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      keys.current.clear()
    }
  }, [selected, onExit])
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const state = drive.current
    const previousX = state.x
    const previousZ = state.z
    if (selected) {
      const throttle = Number(keys.current.has('w') || keys.current.has('arrowup')) - Number(keys.current.has('s') || keys.current.has('arrowdown'))
      const steering = Number(keys.current.has('a') || keys.current.has('arrowleft')) - Number(keys.current.has('d') || keys.current.has('arrowright'))
      state.speed = THREE.MathUtils.damp(state.speed, throttle * 22, throttle ? 1.3 : 2.5, Math.min(delta, 0.08))
      if (keys.current.has(' ')) state.speed = THREE.MathUtils.damp(state.speed, 0, 6, delta)
      state.heading += steering * Math.sign(state.speed || 1) * Math.min(Math.abs(state.speed) * 0.018, 0.38) * Math.min(delta, 0.08)
      state.x += Math.cos(state.heading) * state.speed * delta
      state.z -= Math.sin(state.heading) * state.speed * delta
      state.x = THREE.MathUtils.clamp(state.x, -143, 183)
      state.z = THREE.MathUtils.clamp(state.z, 12, 184)
    } else {
      const progress = (clock.elapsedTime * 0.008 + index * 0.065) % 1
      const position = pointAlongRoute(route, progress)
      const next = pointAlongRoute(route, (progress + 0.002) % 1)
      state.x = position[0]
      state.z = position[1]
      state.heading = Math.atan2(-(next[1] - position[1]), next[0] - position[0])
    }
    const candidateX = THREE.MathUtils.clamp(state.x, -143, 183)
    const candidateZ = THREE.MathUtils.clamp(state.z, 159, 183)
    const radius = kind === 'YARD TRUCK' ? 10 : 8
    if (vehiclePositionBlocked(id, candidateX, candidateZ, radius)) {
      state.speed = 0
      state.x = previousX
      state.z = previousZ
    } else {
      state.x = candidateX
      state.z = candidateZ
    }
    vehicleBodies.set(id, { x: state.x, z: state.z, radius })
    group.current.position.set(state.x, dimensions[1] * 0.24 + 0.15, state.z)
    group.current.rotation.y = state.heading
    if (selected) {
      const forwardX = Math.cos(state.heading)
      const forwardZ = -Math.sin(state.heading)
      const sideX = -forwardZ
      const sideZ = forwardX
      cameraControls.current?.setLookAt(
        (state.x - forwardX * 38 + sideX * 14) * WORLD_SCALE,
        20 * WORLD_SCALE,
        (state.z - forwardZ * 38 + sideZ * 14) * WORLD_SCALE,
        (state.x + forwardX * 9) * WORLD_SCALE,
        1.8 * WORLD_SCALE,
        (state.z + forwardZ * 9) * WORLD_SCALE,
        false,
      )
    }
  })
  const click = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    onSelect(id, [drive.current.x, drive.current.z], cargoType)
  }, [id, onSelect, cargoType])
  const bodyColor = kind === 'YARD TRUCK' ? '#c47855' : kind === 'PICKUP' ? '#587d83' : '#d6c99e'
  return <group ref={group} onClick={click}>
    <Block position={[-0.3, dimensions[1] * 0.3, 0]} size={[dimensions[0] * 0.68, dimensions[1] * 0.48, dimensions[2]]} color={bodyColor} />
    <Block position={[dimensions[0] * 0.22, dimensions[1] * 0.48, 0]} size={[dimensions[0] * 0.3, dimensions[1] * 0.58, dimensions[2] * 0.92]} color={kind === 'YARD TRUCK' ? '#eee8d7' : bodyColor} />
    <Block position={[dimensions[0] * 0.23, dimensions[1] * 0.58, dimensions[2] * 0.47]} size={[dimensions[0] * 0.19, dimensions[1] * 0.2, 0.06]} color="#8fb5b4" />
    {[-1, 1].flatMap(side => [-0.32, 0.34].map(offset => <mesh key={`${side}:${offset}`} position={[dimensions[0] * offset, 0.45, side * (dimensions[2] / 2 + 0.03)]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.75, 0.75, 0.38, 12]} /><meshStandardMaterial color="#263634" />
    </mesh>))}
    {kind === 'YARD TRUCK' && <Block position={[-dimensions[0] * 0.52, 0.85, 0]} size={[1.6, 0.55, 0.3]} color="#d0a16b" />}
    {kind === 'YARD TRUCK' && <>
      <Block position={[-6.7, 1.08, 0]} size={[5.2, 0.42, 3.35]} color="#586b68" />
      <Container position={[-6.7, 2.55, 0]} color={palette[index % palette.length]} size={[4.8, 2.4, 3]} />
      <mesh position={[-6.7, 0.62, -1.82]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.68, 0.68, 0.38, 12]} /><meshStandardMaterial color="#263634" /></mesh>
      <mesh position={[-6.7, 0.62, 1.82]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.68, 0.68, 0.38, 12]} /><meshStandardMaterial color="#263634" /></mesh>
    </>}
    {!driving && <WorldLabel position={[0, dimensions[1] + 3.2, 0]} size={0.95}>{`${id}${cargoType ? ` · ${cargoType.toUpperCase()}` : ''} · CLICK TO DRIVE`}</WorldLabel>}
    <mesh position={[0, dimensions[1] * 0.45, 0]} onClick={click}>
      <boxGeometry args={[dimensions[0] * 1.35, dimensions[1] * 1.5, dimensions[2] * 1.3]} /><meshBasicMaterial transparent opacity={0} />
    </mesh>
  </group>
}

function BreakwaterMarkers() {
  return <>
    {[-1, 1].map((side, sideIndex) => Array.from({ length: 8 }, (_, index) => <group key={`${sideIndex}:${index}`} position={[side < 0 ? -145 + index * 20 : 34 + index * 14.5, 0, -156 + Math.sin(index * 0.42) * 6]}>
      <Block position={[0, 5, 0]} size={[1.4, 10, 1.4]} color="#e7e2cc" />
      <Block position={[0, 10.4, 0]} size={[3.3, 1.2, 3.3]} color={index % 2 ? '#d27a58' : '#70958c'} emissive={index % 2 ? '#ac4930' : '#486e66'} />
    </group>))}
  </>
}

function DroneController({ active, cameraControls, onExit }: {
  active: boolean
  cameraControls: { current: CameraControls | null }
  onExit: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef(new Set<string>())
  const flight = useRef({ position: new THREE.Vector3(), yaw: 0, pitch: -0.35, initialized: false })
  const look = useRef({ pointerId: -1, x: 0, y: 0 })
  useEffect(() => {
    if (!active) {
      flight.current.initialized = false
      keys.current.clear()
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault()
        keys.current.add(key)
      }
      if (key === 'escape') { keys.current.clear(); onExit() }
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    const onBlur = () => keys.current.clear()
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return
      look.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (look.current.pointerId !== event.pointerId || !(event.buttons & 1)) return
      const dx = event.clientX - look.current.x
      const dy = event.clientY - look.current.y
      flight.current.yaw -= dx * 0.004
      flight.current.pitch = THREE.MathUtils.clamp(flight.current.pitch - dy * 0.004, -1.28, 1.28)
      look.current.x = event.clientX
      look.current.y = event.clientY
    }
    const onPointerUp = (event: PointerEvent) => {
      if (look.current.pointerId === event.pointerId) look.current.pointerId = -1
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      keys.current.clear()
      look.current.pointerId = -1
    }
  }, [active, onExit])
  useFrame((_, delta) => {
    const controls = cameraControls.current
    if (!controls || !group.current) return
    controls.maxPolarAngle = active ? Math.PI * 0.96 : Math.PI * 0.38
    const state = flight.current
    if (!active) return
    if (!state.initialized) {
      const cameraPosition = new THREE.Vector3()
      const target = new THREE.Vector3()
      controls.getPosition(cameraPosition)
      controls.getTarget(target)
      const direction = target.sub(cameraPosition).normalize()
      state.position.copy(cameraPosition).multiplyScalar(1 / WORLD_SCALE).addScaledVector(direction, 28)
      state.yaw = Math.atan2(direction.x, -direction.z)
      state.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))
      state.initialized = true
    }
    const direction = new THREE.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), -Math.cos(state.yaw) * Math.cos(state.pitch)).normalize()
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize()
    if (active && keys.current.size) {
      const movement = new THREE.Vector3()
      if (keys.current.has('w') || keys.current.has('arrowup')) movement.add(direction)
      if (keys.current.has('s') || keys.current.has('arrowdown')) movement.sub(direction)
      if (keys.current.has('d')) movement.add(right)
      if (keys.current.has('a')) movement.sub(right)
      if (keys.current.has('e')) movement.y += 1
      if (keys.current.has('q')) movement.y -= 1
      if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(44 * Math.min(delta, 0.08))
        state.position.add(movement)
        state.position.x = THREE.MathUtils.clamp(state.position.x, -420, 420)
        state.position.y = THREE.MathUtils.clamp(state.position.y, 8, 480)
        state.position.z = THREE.MathUtils.clamp(state.position.z, -360, 360)
      }
    }
    const cameraPosition = state.position.clone().addScaledVector(direction, -28).multiplyScalar(WORLD_SCALE)
    const target = state.position.clone().addScaledVector(direction, 80).multiplyScalar(WORLD_SCALE)
    controls.setLookAt(cameraPosition.x, cameraPosition.y, cameraPosition.z, target.x, target.y, target.z, false)
    group.current.position.copy(state.position)
    group.current.rotation.set(-state.pitch, state.yaw, 0)
  })
  return <group ref={group} visible={active}>
    <Block position={[0, 0, 0]} size={[2.8, 0.72, 1.9]} color="#e8e3d2" />
    <Block position={[0, -0.45, 0]} size={[1.5, 0.32, 1.1]} color="#526b68" />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}:${z}`} position={[x * 2.2, 0, z * 1.65]}>
      <Block position={[0, 0, 0]} size={[2, 0.18, 0.18]} color="#647b75" />
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.72, 0.72, 0.08, 12]} /><meshStandardMaterial color="#394d4a" /></mesh>
      <mesh position={[0, 0.34, 0]}><sphereGeometry args={[0.12, 8, 6]} /><meshBasicMaterial color="#f6bd72" /></mesh>
    </group>))}
  </group>
}

function Scene({ vessels, demands, nodes, portNodeId, portLatitude, simulationTimeHours, simulationRunning, clockProfileId, previewHour, select, drivingVehicleId, droneMode, cameraControls, onDrive, onExitDrive, onExitDrone }: {
  vessels: YardVessel[]
  demands: YardDemand[]
  nodes: YardNode[]
  portNodeId: string
  portLatitude: number
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  previewHour: number | null
  select: (selection: Selection) => void
  drivingVehicleId: string | null
  droneMode: boolean
  onExitDrone: () => void
  cameraControls: { current: CameraControls | null }
  onDrive: (id: string, position: Point) => void
  onExitDrive: () => void
}) {
  const berths = useMemo(BerthPositions, [])
  const renderedVessels = useMemo(() => vessels.filter(vessel =>
    vessel.routeTouchesPort || vessel.startsAtPort || vessel.currentNodeId === portNodeId,
  ), [vessels, portNodeId])
  return <>
    <LightingCycle simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} previewHour={previewHour} />
    <group scale={[WORLD_SCALE, WORLD_SCALE, WORLD_SCALE]}>
    <AnimatedWater />
    <Breakwater side={-1} /><Breakwater side={1}/><BreakwaterMarkers />
    <RoadsAndApron />
    <PortGeography />
    <WarehouseRow showDistrictLabel={!drivingVehicleId} />
    <HarborCarPark />
    <ContainerYard select={select} />
    <TreeLine select={select} />
    <QuayLighting />
    {berths.slice(0, 8).map(([x], index) => <Crane key={index} x={x} z={48} index={index} select={select} />)}
    {[-35, -15, 5, 25, 45, 65, 85, 105].map((x, index) => <Crane key={`inner-${index}`} x={x} z={-4} index={index + 8} select={select} />)}
    {renderedVessels.map((vessel, index) => {
      const tanker = isTanker(vessel)
      const berth = renderedVessels.slice(0, index).filter(previous => isTanker(previous) === tanker).length
      return <Ship key={vessel.id} vessel={vessel} berth={berth} nodes={nodes} portNodeId={portNodeId} portLatitude={portLatitude} simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} select={select} />
    })}
    {Array.from({ length: 2 }, (_, index) => <Tugboat key={index} index={index} select={select} />)}
    {demands.slice(0, 16).map((demand, index) => <YardCargo key={demand.id} demand={demand} index={index} select={select} />)}
    {[
      ['PORT-CAR-01', 0, 'YARD CAR'], ['TRACTOR-04', 1, 'YARD TRUCK'], ['PORT-PICKUP-02', 2, 'PICKUP'],
      ['TRACTOR-07', 3, 'YARD TRUCK'], ['PORT-CAR-03', 4, 'YARD CAR'], ['TRACTOR-09', 5, 'YARD TRUCK'],
      ['PORT-CAR-05', 6, 'YARD CAR'], ['TRACTOR-11', 7, 'YARD TRUCK'], ['PORT-PICKUP-08', 8, 'PICKUP'],
      ['TRACTOR-12', 9, 'YARD TRUCK'], ['PORT-CAR-07', 10, 'YARD CAR'], ['TRACTOR-15', 11, 'YARD TRUCK'],
    ].map(([id, index, kind]) => <Vehicle key={id} id={String(id)} index={Number(index)} kind={kind as 'YARD TRUCK' | 'YARD CAR' | 'PICKUP'} cargoType={kind === 'YARD TRUCK' && demands.length ? demands[Number(index) % demands.length].cargoType : undefined} selected={drivingVehicleId === id} driving={Boolean(drivingVehicleId)} cameraControls={cameraControls} onSelect={onDrive} onExit={onExitDrive} />)}
    <DroneController active={droneMode} cameraControls={cameraControls} onExit={onExitDrone} />
    </group>
  </>
}

function formatHour(hour: number) {
  const rounded = Math.floor(((hour % 24) + 24) % 24)
  return `${String(rounded).padStart(2, '0')}:00`
}

export default function PortYard({ vessels, demands, nodes, port, simulationTimeHours, simulationRunning, clockProfileId }: {
  vessels: YardVessel[]
  demands: YardDemand[]
  nodes: YardNode[]
  port: { portId: string; latitude: number; longitude: number } | null
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
}) {
  const [selected, setSelected] = useState<Selection>(null)
  const [drivingVehicleId, setDrivingVehicleId] = useState<string | null>(null)
  const [droneMode, setDroneMode] = useState(false)
  const [worldClockVisible, setWorldClockVisible] = useState(true)
  const [previewHour, setPreviewHour] = useState<number | null>(null)
  const cameraControls = useRef<CameraControls | null>(null)
  const portId = port?.portId ?? '19WPI-16080'
  const portNodeId = `node-${portId}`
  const portLatitude = port?.latitude ?? 33.75
  const angleViews: Array<{ label: string; x: number; z: number }> = [
    { label: 'NW', x: -2300, z: 2500 },
    { label: 'NE', x: 2300, z: 2500 },
    { label: 'SW', x: -2300, z: -2500 },
    { label: 'SE', x: 2300, z: -2500 },
  ]
  const handleDrive = useCallback((id: string, position: Point, cargoType?: string) => {
    setDroneMode(false)
    setDrivingVehicleId(id)
    setSelected({ id, title: 'Driveable harbor vehicle', status: 'PLAYER CONTROL', detail: `Use W/A/S/D to drive, Space to brake, and Esc to stop driving.${cargoType ? ` Cargo on board: ${cargoType}.` : ''}` })
    cameraControls.current?.setLookAt((position[0] + 34) * WORLD_SCALE, 26 * WORLD_SCALE, (position[1] + 37) * WORLD_SCALE, position[0] * WORLD_SCALE, 0, position[1] * WORLD_SCALE, true)
  }, [])
  const exitDrive = useCallback(() => {
    if (drivingVehicleId) cameraControls.current?.setLookAt(2150, 1450, 2400, 0, 0, 0, true)
    setDrivingVehicleId(null)
  }, [drivingVehicleId])
  useEffect(() => {
    let frame = 0
    let attempts = 0
    let cancelled = false
    const aimAtHarbor = () => {
      if (cancelled) return
      if (cameraControls.current) {
        cameraControls.current.setLookAt(2150, 1450, 2400, 0, 0, 0, false)
        return
      }
      if (attempts++ < 120) frame = window.requestAnimationFrame(aimAtHarbor)
    }
    frame = window.requestAnimationFrame(aimAtHarbor)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [])
  return <div className="port-canvas-shell">
    <Canvas shadows dpr={[0.65, 1]} camera={{ position: [2150, 1450, 2400], fov: 38, near: 12, far: 12000 }} gl={{ powerPreference: 'high-performance', antialias: false }} onPointerMissed={() => setSelected(null)}>
      <Scene vessels={vessels} demands={demands} nodes={nodes} portNodeId={portNodeId} portLatitude={portLatitude} simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} previewHour={previewHour} select={setSelected} drivingVehicleId={drivingVehicleId} droneMode={droneMode} cameraControls={cameraControls} onDrive={handleDrive} onExitDrive={exitDrive} onExitDrone={() => setDroneMode(false)} />
      <CameraControls ref={cameraControls} makeDefault minDistance={100} maxDistance={7000} minPolarAngle={0.04} maxPolarAngle={Math.PI * 0.38} dollyToCursor smoothTime={0.45} draggingSmoothTime={0.18} />
    </Canvas>
    <nav className="angle-view-controls" aria-label="Four harbor viewing angles">
      <small>HARBOR ANGLES</small>
      <div>{angleViews.map(({ label, x, z }) => <button key={label} aria-label={`View harbor from ${label}`} onClick={() => { setDroneMode(false); cameraControls.current?.setLookAt(x, 1900, z, 0, 0, 0, true) }}>{label}</button>)}</div>
      <button className={droneMode ? 'drone-toggle is-active' : 'drone-toggle'} onClick={() => { setDrivingVehicleId(null); setDroneMode(value => !value) }}>{droneMode ? 'EXIT DRONE' : 'FLY DRONE'}</button>
      <small className="camera-hint">DRAG ROTATE · RIGHT-DRAG PAN · WHEEL ZOOM</small>
    </nav>
    {selected && <aside className="object-inspector"><button onClick={() => { setSelected(null); exitDrive() }} aria-label="Close selection">×</button><small>SELECTED 3D ASSET</small><b>{selected.id}</b><span>{selected.title} · {selected.status}</span><p>{selected.detail}</p></aside>}
    {worldClockVisible ? <aside className="world-clock-panel">
      <button className="world-clock-close" aria-label="Close day and night controls" onClick={() => setWorldClockVisible(false)}>×</button>
      <small>HARBOR LIGHT · SIMULATION KEEPS RUNNING</small><b>{previewHour === null ? 'LIVE DAY / NIGHT' : `FROZEN · ${formatHour(previewHour)}`}</b>
      <input aria-label="Preview harbor time of day" type="range" min="0" max="23.75" step="0.25" value={previewHour ?? Math.min(23.75, ((simulationTimeHours + 12) % 24))} onChange={event => setPreviewHour(Number(event.target.value))} />
      <div className="world-clock-actions"><button onClick={() => setPreviewHour(previewHour === null ? ((simulationTimeHours % 24) + 24) % 24 : null)}>{previewHour === null ? 'Freeze lighting' : 'Resume live cycle'}</button></div>
    </aside> : <button className="world-clock-restore" onClick={() => setWorldClockVisible(true)}>☼ <span>Time</span></button>}
    {drivingVehicleId && <aside className="drive-hud"><button aria-label="Stop driving" onClick={exitDrive}>×</button><small>DRIVING</small><b>{drivingVehicleId}</b><span>W A S D · SPACE BRAKE · ESC EXIT</span></aside>}
    {droneMode && <aside className="drone-hud"><button aria-label="Stop drone flight" onClick={() => setDroneMode(false)}>×</button><small>DRONE FLIGHT</small><span>W A S D FLY · Q / E HEIGHT · CLICK-DRAG STEER · ESC EXIT</span></aside>}
  </div>
}
