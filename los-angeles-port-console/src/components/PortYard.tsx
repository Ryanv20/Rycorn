'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, CameraControls, Line, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { MODEL_REFERENCE, PORT_LAYOUT, PORT_RENDER_SCALE, VESSEL_PROFILES, boundsOverlap, findClearFootprint, footprintBounds, footprintsOverlap, insidePortSea, scaleModelToTarget, vesselClassFor, type Footprint2 } from '../../../packages/scale-engine/src/index'
import { World as LekkiPortWorld } from '../../../lekki-port-console/src/three/Environment'

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
  currentRouteDistanceKm?: number
  assignedCargoIds: string[]
  oceanDisplay?: boolean
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

type Selection = { id: string; title: string; status: string; detail: string; shipPose?: { x: number; z: number; yaw: number; scaleX: number; scaleY: number; scaleZ: number } } | null
type Point = [number, number]
type WorldPoint = [number, number, number]
type VesselPose = { x: number; z: number; yaw: number; length: number; width: number; status: string }
export type PortIncident = { id: string; title: string; detail: string; vesselId?: string }
const WORLD_SCALE = PORT_RENDER_SCALE
const SCENE_MOTION_ENABLED = true
const PORT_ANIMATION_ENTER_DISTANCE_KM = 35
const PORT_ANIMATION_EXIT_DISTANCE_KM = 45
const PORT_WORLD_OFFSET: WorldPoint = [-690, 0, 327]
const PORT_AERIAL_TARGET: WorldPoint = [-884, 0, 234]
const PORT_AERIAL_POSITION: WorldPoint = [-10, 5600, 1100]
const palette = ['#c83f32', '#d79b35', '#315d9b', '#e2e3df', '#268477']
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

function distanceAlongRouteToNodeKm(routePath: string[], nodes: YardNode[], targetNodeId: string): number | null {
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const pathNodes = routePath.map(nodeId => nodeById.get(nodeId)).filter((node): node is YardNode => Boolean(node))
  const targetIndex = pathNodes.findIndex(node => node.id === targetNodeId)
  if (targetIndex < 0) return null
  const radians = Math.PI / 180
  let distance = 0
  for (let index = 1; index <= targetIndex; index += 1) {
    const from = pathNodes[index - 1]
    const to = pathNodes[index]
    const dLat = (to.latitude - from.latitude) * radians
    const dLon = (to.longitude - from.longitude) * radians
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(dLon / 2) ** 2
    distance += 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return distance
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
    const columns = 160
    const rows = 160
    const width = PORT_LAYOUT.seaMaxX - PORT_LAYOUT.seaMinX
    const depth = PORT_LAYOUT.seaEdgeZ - PORT_LAYOUT.seaMinZ
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
    if (!SCENE_MOTION_ENABLED) return
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const values = positions.array as Float32Array
    const time = clock.elapsedTime
    for (let index = 0; index < values.length; index += 3) {
      const x = values[index]
      const z = values[index + 2]
      values[index + 1] = Math.sin(x * 0.025 + z * 0.009 + time * 0.75) * 0.48
        + Math.cos(z * 0.032 - x * 0.007 - time * 0.55) * 0.34
        + Math.sin((x + z) * 0.011 + time * 0.32) * 0.2
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    if (mesh.current) mesh.current.position.y = -0.6
  })
  return <mesh ref={mesh} geometry={geometry} position={[0, -0.6, (PORT_LAYOUT.seaMinZ + PORT_LAYOUT.seaEdgeZ) / 2]} receiveShadow>
    <meshStandardMaterial color="#17617e" roughness={0.24} metalness={0.22} />
  </mesh>
}

function LightingCycle({ simulationTimeHours, simulationRunning, clockProfileId, previewHour, dayNightFrozen }: {
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  previewHour: number | null
  dayNightFrozen: boolean
}) {
  const sky = useRef<THREE.Color>(null)
  const fog = useRef<THREE.Fog>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const timeline = useRef({ server: simulationTimeHours, visual: simulationTimeHours })
  const frozenHour = useRef<number | null>(null)
  const day = useMemo(() => new THREE.Color('#b7d2ce'), [])
  const dusk = useMemo(() => new THREE.Color('#dfa17a'), [])
  const night = useMemo(() => new THREE.Color('#182d47'), [])
  const moonlight = useMemo(() => new THREE.Color('#a9bac6'), [])
  const current = useMemo(() => new THREE.Color(), [])
  const warm = useMemo(() => new THREE.Color('#ffbd83'), [])
  const sunlight = useMemo(() => new THREE.Color('#fff2d8'), [])
  const hemisphereDay = useMemo(() => new THREE.Color('#f3fbf5'), [])
  const skyDome = useRef<THREE.ShaderMaterial>(null)
  const skyTop = useMemo(() => new THREE.Color('#3b92c5'), [])
  const skyHorizon = useMemo(() => new THREE.Color('#c6e5ec'), [])
  const duskTop = useMemo(() => new THREE.Color('#8f625e'), [])
  const duskHorizon = useMemo(() => new THREE.Color('#e5a17b'), [])

  useEffect(() => {
    if (!simulationRunning || simulationTimeHours < timeline.current.server) timeline.current.visual = simulationTimeHours
    else timeline.current.visual = Math.max(timeline.current.visual, simulationTimeHours)
    timeline.current.server = simulationTimeHours
  }, [simulationTimeHours, simulationRunning])

  useEffect(() => {
    frozenHour.current = dayNightFrozen ? ((timeline.current.visual % 24) + 24) % 24 : null
  }, [dayNightFrozen])

  useFrame((_, delta) => {
    if (!SCENE_MOTION_ENABLED) return
    const rate = clockRates[clockProfileId] ?? 1
    const activeHours = simulationRunning
      ? (timeline.current.visual += delta * rate)
      : simulationTimeHours
    const hour = ((previewHour ?? (dayNightFrozen ? frozenHour.current ?? simulationTimeHours : activeHours)) % 24 + 24) % 24
    const angle = ((hour - 6) / 24) * Math.PI * 2
    const elevation = Math.sin(angle)
    const daylight = THREE.MathUtils.smoothstep(elevation, -0.08, 0.42)
    const twilight = THREE.MathUtils.smoothstep(elevation, -0.34, 0.05) * (1 - THREE.MathUtils.smoothstep(elevation, 0.05, 0.38))
    current.copy(night).lerp(day, daylight).lerp(dusk, twilight * 0.78)
    sky.current?.copy(current)
    if (fog.current) fog.current.color.copy(current)
    if (skyDome.current) {
      skyTop.set(daylight > 0.3 ? '#3c8fc4' : '#101e32').lerp(duskTop, twilight * 0.72)
      skyHorizon.set(daylight > 0.3 ? '#c4e6ed' : '#344458').lerp(duskHorizon, twilight * 0.82)
      skyDome.current.uniforms.topColor.value.copy(skyTop)
      skyDome.current.uniforms.horizonColor.value.copy(skyHorizon)
      skyDome.current.uniforms.lowerColor.value.copy(current)
    }
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
    <mesh renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[12000, 48, 32]} />
      <shaderMaterial ref={skyDome} side={THREE.BackSide} depthWrite={false} uniforms={{
        topColor: { value: new THREE.Color('#3c8fc4') },
        horizonColor: { value: new THREE.Color('#c4e6ed') },
        lowerColor: { value: new THREE.Color('#b7d2ce') },
      }} vertexShader={`varying float vSkyHeight; void main(){ vSkyHeight = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 lowerColor; varying float vSkyHeight; void main(){ float horizon = smoothstep(-0.14, 0.1, vSkyHeight); float zenith = smoothstep(0.08, 0.9, vSkyHeight); vec3 color = mix(lowerColor, horizonColor, horizon); color = mix(color, topColor, zenith); gl_FragColor = vec4(color, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`} />
    </mesh>
    <ambientLight intensity={0.4} />
    <hemisphereLight ref={hemi} args={['#f3fbf5', '#667b70', 1.3]} />
    <directionalLight ref={sun} position={[35, 65, 35]} intensity={2.2} color="#fff2d8" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={10} shadow-camera-far={8000} shadow-camera-left={-1900} shadow-camera-right={1900} shadow-camera-top={1550} shadow-camera-bottom={-1550} shadow-bias={-0.00015} shadow-normalBias={0.035} />
  </>
}

function Breakwater({ side }: { side: -1 | 1 }) {
  const rocks = useRef<THREE.InstancedMesh>(null)
  const count = 190
  const rockGeometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const rockMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b7772', roughness: 1 }), [])
  useEffect(() => {
    const instanced = rocks.current
    if (!instanced) return
    const object = new THREE.Object3D()
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      const innerX = side < 0 ? -150 : 150
      const outerX = side * 220
      const armLength = 0.62
      const x = t < armLength
        ? outerX + (innerX - outerX) * (t / armLength)
        : innerX + (side < 0 ? 110 : -110) * ((t - armLength) / (1 - armLength))
      const z = t < armLength
        ? -240 + 84 * (t / armLength)
        : -156
      object.position.set(x, 0.8 + (i % 4) * 0.18, z + Math.sin(i * 6.7) * 1.2)
      object.rotation.set(i * 1.7, i * 2.1, i * 0.9)
      const size = 1.35 + (i % 5) * 0.34
      object.scale.set(size, size * 0.7, size * 0.8)
      object.updateMatrix()
      instanced.setMatrixAt(i, object.matrix)
    }
    instanced.instanceMatrix.needsUpdate = true
  }, [side])
  const angle = side < 0 ? -50 * Math.PI / 180 : 50 * Math.PI / 180
  return <>
    <Block position={[side * 185, 0.55, -198]} size={[109, 1.5, 7]} color="#75807a" rotation={[0, angle, 0]} />
    <Block position={[side < 0 ? -95 : 95, 0.55, -156]} size={[110, 1.5, 7]} color="#75807a" />
    <Block position={[side * 185, 1.35, -198]} size={[106, 0.22, 5]} color="#c6c5b8" rotation={[0, angle, 0]} />
    <Block position={[side < 0 ? -95 : 95, 1.35, -156]} size={[106, 0.22, 5]} color="#c6c5b8" />
    <instancedMesh ref={rocks} args={[rockGeometry, rockMaterial, count]} castShadow receiveShadow />
    <Block position={[side < 0 ? -150 : 140, 5.2, -156]} size={[1.2, 7, 1.2]} color="#a95e49" emissive="#a64d32" />
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
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 26; column += 1) {
        // Keep long aisles and a lighter stack density so the harbor reads at port scale.
        if (row === 2 || row === 5 || (row + column) % 5 === 0) continue
        const stack = 1 + ((row * 3 + column * 7) % 3)
        const x = -325 + column * 12.4
        const z = 45 + row * 6.3
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

function QuayLighting() {
  const rows = [
    { z: 34, minX: -350, maxX: 70, count: 24 },
    { z: 46, minX: 106, maxX: 221, count: 6 },
    { z: 184, minX: -350, maxX: 270, count: 35 },
  ]
  return <>{rows.flatMap((row, rowIndex) => Array.from({ length: row.count }, (_, index) => {
    const x = row.minX + (index / (row.count - 1)) * (row.maxX - row.minX)
    return <group key={`${rowIndex}:${index}`} position={[x, 0, row.z]}>
      <Block position={[0, 10, 0]} size={[0.42, 20, 0.42]} color="#62736d" />
      <Block position={[0, 20, -1.4]} size={[3.6, 0.32, 0.32]} color="#62736d" />
      <mesh position={[0, 19.5, -2.9]}>
        <boxGeometry args={[1.5, 0.45, 1]} />
        <meshStandardMaterial color="#ffe6aa" emissive="#ffd485" emissiveIntensity={0.12} />
      </mesh>
    </group>
  }))}</>
}

function Crane({ x, z = 1, index, select }: { x: number; z?: number; index: number; select: (selection: Selection) => void }) {
  const trolley = useRef<THREE.Group>(null)
  const cable = useRef<THREE.Mesh>(null)
  const spreader = useRef<THREE.Mesh>(null)
  const handleClick = useCallback(() => select({ id: `STS-CRANE-${String(index + 1).padStart(2, '0')}`, title: 'Ship-to-shore crane', status: 'ACTIVE VISUAL MODEL', detail: 'Animated crane asset. Rycon supplies vessel and cargo state; terminal machinery remains a local scene asset for now.' }), [index, select])
  useFrame(({ clock }) => {
    if (!SCENE_MOTION_ENABLED) return
    if (!trolley.current || !cable.current || !spreader.current) return
    const phase = clock.elapsedTime * 0.3 + index * 0.8
    trolley.current.position.z = -12 + Math.sin(phase) * 6
    const lift = 16 + Math.sin(phase * 0.64 + 1) * 2
    cable.current.scale.y = lift
    cable.current.position.y = 22 - lift / 2
    spreader.current.position.y = 22 - lift
  })
  return <group position={[x, 1.44, z]} onClick={handleClick}>
    {/* Lekki-style quay gantry: portal legs on the dock, with the working boom reaching over the ship. */}
    <Block position={[-7.5, 11.2, 0]} size={[1.2, 22, 1.5]} color="#c64d3d" />
    <Block position={[7.5, 11.2, 0]} size={[1.2, 22, 1.5]} color="#c64d3d" />
    <Block position={[0, 22.2, 0]} size={[17, 0.9, 1.6]} color="#c64d3d" />
    <Block position={[0, 22, -10]} size={[1.5, 0.9, 28]} color="#c64d3d" />
    <Block position={[0, 22, 5]} size={[2, 0.9, 10]} color="#c64d3d" />
    <Block position={[0, 13.2, 0.4]} size={[15, 0.4, 1]} color="#708883" />
    <Block position={[-7.5, 0.6, 0]} size={[3, 1.2, 4.3]} color="#26384c" />
    <Block position={[7.5, 0.6, 0]} size={[3, 1.2, 4.3]} color="#26384c" />
    <group ref={trolley}>
      <Block position={[0, 21.4, 0]} size={[3.4, 1.45, 2.7]} color="#d79b35" />
      <mesh ref={cable} position={[0, 14, 0]}>
        <boxGeometry args={[0.16, 1, 0.16]} /><meshStandardMaterial color="#26384c" />
      </mesh>
      <mesh ref={spreader} position={[0, 6, 0]} castShadow>
        <boxGeometry args={[10, 0.5, 2.4]} /><meshStandardMaterial color="#26384c" />
      </mesh>
    </group>
    <mesh position={[0, 11.5, -8]} onClick={handleClick}>
      <boxGeometry args={[19, 23, 34]} /><meshBasicMaterial transparent opacity={0} />
    </mesh>
  </group>
}

function WarehouseRow({ showDistrictLabel }: { showDistrictLabel: boolean }) {
  return <>
    <Warehouse x={-325} z={148} name="WAREHOUSE W01 · COLD CHAIN" width={30} />
    <Warehouse x={-290} z={148} name="WAREHOUSE W02 · GENERAL CARGO" width={30} />
    <Warehouse x={-255} z={148} name="WAREHOUSE W03 · FREIGHT" width={30} />
    <Warehouse x={-220} z={148} name="WAREHOUSE W04 · COLD CHAIN" width={30} />
    <Warehouse x={-185} z={148} name="WAREHOUSE W05 · GENERAL CARGO" width={30} />
    <Warehouse x={-130} z={148} name="WAREHOUSE 01 · COLD CHAIN" width={30} />
    <Warehouse x={-95} z={148} name="WAREHOUSE 02 · GENERAL CARGO" width={30} />
    <Warehouse x={-60} z={148} name="WAREHOUSE 03 · FREIGHT" width={30} />
    <Warehouse x={-25} z={148} name="WAREHOUSE 04 · COLD CHAIN" width={30} />
    <Warehouse x={10} z={148} name="WAREHOUSE 05 · GENERAL CARGO" width={30} />
    <Warehouse x={45} z={148} name="WAREHOUSE 06 · FREIGHT" width={30} />
    <Warehouse x={218} z={142} name="HARBOR FLEET · MAINTENANCE" width={36} />
    <Warehouse x={260} z={142} name="BREAKBULK · BONDED STORAGE" width={30} />
    {showDistrictLabel && <WorldLabel position={[0, 5.2, 153]} size={1.8} color="#e3e5d7">LOS ANGELES PORT LOGISTICS DISTRICT</WorldLabel>}
  </>
}

function QuayStructures() {
  return <>
    <Block position={[-140, 0.72, 37]} size={[440, 1.44, 9.2]} color="#87959a" />
    {Array.from({ length: 100 }, (_, index) => <Block key={`bollard-${index}`} position={[-358 + index * (436 / 99), 2.1, 32]} size={[0.72, 1.6, 0.72]} color="#293e3f" />)}
    {Array.from({ length: 96 }, (_, index) => <Block key={`fender-${index}`} position={[-358 + index * (428 / 95), 0.8, 31]} size={[1.7, 1.2, 0.5]} color="#384c4b" />)}
  </>
}

function PortLand() {
  return <mesh position={[-140, -0.05, 120]} receiveShadow>
    <boxGeometry args={[440, 0.3, 160]} />
    <meshStandardMaterial color="#aeb8b3" roughness={0.96} />
  </mesh>
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
    <mesh position={[180, -0.05, 119]} receiveShadow>
      <boxGeometry args={[200, 0.3, 154]} />
      {/* Keep the bunkering / liquid-bulk ground on the same continuous apron finish as the container yard. */}
      <meshStandardMaterial color="#aeb8b3" roughness={0.96} />
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
  return <>
    <WorldLabel position={[-103, 2.5, -35]} size={2.5} color="#cfe0d7">WEST BASIN</WorldLabel>
    <WorldLabel position={[148, 2.5, -38]} size={2.5} color="#cfe0d7">EAST BASIN</WorldLabel>
    <WorldLabel position={[-110, 18, 25]} size={2}>WBCT · BERTHS 100–127</WorldLabel>
    <WorldLabel position={[112, 3, 28]} size={2.2} color="#cfe0d7">CERRITOS CHANNEL</WorldLabel>
    <WorldLabel position={[18, 3, -161]} size={2.2} color="#cfe0d7">MAIN CHANNEL</WorldLabel>
    <LiquidBulkDistrict />
  </>
}

function ConstructViewerOverlay() {
  return <>
    <gridHelper args={[800, 80, 0x54cfc3, 0x466365]} position={[0, 0.12, 0]} />
    <group position={[270, 0.12, 95]}>
      <mesh name="Construct Viewer reference cube" position={[0.5, 0.5, 0.5]} userData={{ constructReference: true }}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#54cfc3" wireframe transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Line points={[[0, -0.08, 0] as WorldPoint, [1, -0.08, 0] as WorldPoint]} color="#e88363" lineWidth={1.5} />
      <Line points={[[1.08, 0, 0] as WorldPoint, [1.08, 1, 0] as WorldPoint]} color="#82c58b" lineWidth={1.5} />
      <Line points={[[0, 1.08, 0] as WorldPoint, [0, 1.08, 1] as WorldPoint]} color="#80aee0" lineWidth={1.5} />
      <WorldLabel position={[0.5, -0.2, 0]} size={0.48} color="#a44e3d">X · 1 M</WorldLabel>
      <WorldLabel position={[1.28, 0.5, 0]} size={0.48} color="#397847">Y · 1 M</WorldLabel>
      <WorldLabel position={[0, 1.18, 0.5]} size={0.48} color="#426b9c">Z · 1 M</WorldLabel>
      <WorldLabel position={[0.5, 1.5, 0.5]} size={0.62} color="#27685e">1 M REFERENCE CUBE</WorldLabel>
    </group>
  </>
}

type ConstructPick = { key: string; label: string; columnMin: number; columnMax: number; rowMin: number; rowMax: number; x: number; z: number; width: number; depth: number }
type ConstructMarquee = { left: number; top: number; width: number; height: number }

function ConstructGridPicker({ active, onPick, onMarquee }: { active: boolean; onPick: (region: ConstructPick, shift: boolean) => void; onMarquee: (rect: ConstructMarquee | null) => void }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    if (!active) return
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12 * WORLD_SCALE)
    const toGridCell = (clientX: number, clientY: number) => {
      const bounds = gl.domElement.getBoundingClientRect()
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      if (!hit) return
      const x = hit.x / WORLD_SCALE
      const z = hit.z / WORLD_SCALE
      if (x < -400 || x >= 400 || z < -400 || z >= 400) return
      return { column: Math.floor((x + 400) / 10), row: Math.floor((z + 400) / 10) }
    }
    let drag: { pointerId: number; x: number; y: number; cell: { column: number; row: number }; shift: boolean } | null = null
    const handleDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const cell = toGridCell(event.clientX, event.clientY)
      if (!cell) return
      event.preventDefault()
      event.stopImmediatePropagation()
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cell, shift: event.shiftKey }
      gl.domElement.setPointerCapture(event.pointerId)
      onMarquee(null)
    }
    const handleMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const bounds = gl.domElement.getBoundingClientRect()
      const left = Math.max(0, Math.min(drag.x, event.clientX) - bounds.left)
      const top = Math.max(0, Math.min(drag.y, event.clientY) - bounds.top)
      const right = Math.min(bounds.width, Math.max(drag.x, event.clientX) - bounds.left)
      const bottom = Math.min(bounds.height, Math.max(drag.y, event.clientY) - bounds.top)
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) onMarquee({ left, top, width: right - left, height: bottom - top })
    }
    const handleUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.type === 'pointercancel') { drag = null; onMarquee(null); return }
      const start = drag
      const end = toGridCell(event.clientX, event.clientY) ?? start.cell
      const columnMin = Math.min(start.cell.column, end.column)
      const columnMax = Math.max(start.cell.column, end.column)
      const rowMin = Math.min(start.cell.row, end.row)
      const rowMax = Math.max(start.cell.row, end.row)
      const width = columnMax - columnMin + 1
      const depth = rowMax - rowMin + 1
      const x = -400 + (columnMin + columnMax + 1) * 5
      const z = -400 + (rowMin + rowMax + 1) * 5
      onPick({ key: `${columnMin}:${columnMax}:${rowMin}:${rowMax}`, columnMin, columnMax, rowMin, rowMax, x, z, width, depth, label: `C${columnMin + 1}–C${columnMax + 1} · R${rowMin + 1}–R${rowMax + 1} · ${width * 10} × ${depth * 10} M` }, start.shift)
      drag = null
      onMarquee(null)
    }
    gl.domElement.addEventListener('pointerdown', handleDown, true)
    gl.domElement.addEventListener('pointermove', handleMove, true)
    gl.domElement.addEventListener('pointerup', handleUp, true)
    gl.domElement.addEventListener('pointercancel', handleUp, true)
    return () => {
      gl.domElement.removeEventListener('pointerdown', handleDown, true)
      gl.domElement.removeEventListener('pointermove', handleMove, true)
      gl.domElement.removeEventListener('pointerup', handleUp, true)
      gl.domElement.removeEventListener('pointercancel', handleUp, true)
      onMarquee(null)
    }
  }, [active, camera, gl, onMarquee, onPick])
  return null
}

function ConstructCellHighlights({ selection }: { selection: ConstructPick[] }) {
  return <>{selection.map(cell => <group key={cell.key}>
    <mesh position={[cell.x, 0.15, cell.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={15}>
      <planeGeometry args={[cell.width * 10, cell.depth * 10]} />
      <meshBasicMaterial color="#ffd276" transparent opacity={0.24} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
    </mesh>
    <Line points={[[cell.x - cell.width * 5, 0.16, cell.z - cell.depth * 5], [cell.x + cell.width * 5, 0.16, cell.z - cell.depth * 5], [cell.x + cell.width * 5, 0.16, cell.z + cell.depth * 5], [cell.x - cell.width * 5, 0.16, cell.z + cell.depth * 5], [cell.x - cell.width * 5, 0.16, cell.z - cell.depth * 5]] as WorldPoint[]} color="#b17b22" lineWidth={2} />
  </group>)}</>
}

function BerthPositions(): Point[] {
  const berths: Point[] = [
    // Five larger hulls fit the long quay with clear separation and face along it.
    ...Array.from({ length: 5 }, (_, index) => [-320 + index * 88, 13] as Point),
    [-132, -80], [-132, -50], [-132, -20], [-132, 10],
    [190, -80], [190, -50], [190, -20], [190, 10],
    [-65, -115], [-25, -115], [15, -115], [55, -115],
  ]
  // Extra live arrivals wait in separated outer-roadstead positions instead of stacking on one berth.
  for (let index = 0; index < 32; index += 1) berths.push([-330 + (index % 16) * 44, -230 - Math.floor(index / 16) * 90])
  return berths
}

// Scene-space AABBs for fixed collision targets; ground slabs are deliberately excluded.
const collisionAreas = [
  { id: 'WEST-QUAY', label: 'West container quay', minX: -360, maxX: 80, minZ: 32.3, maxZ: 41.7 },
  { id: 'LIQUID-QUAY', label: 'Wilmington liquid quay', minX: 88, maxX: 252, minZ: 35, maxZ: 43 },
  { id: 'CONTAINER-YARD', label: 'Container yard stacks', minX: -331, maxX: -8, minZ: 42.5, maxZ: 91.5 },
  ...[-325, -290, -255, -220, -185, -130, -95, -60, -25, 10, 45, 218, 260].map((x, index) => ({
    id: `WAREHOUSE-${String(index + 1).padStart(2, '0')}`, label: `Warehouse ${String(index + 1).padStart(2, '0')}`,
    minX: x - (index === 11 ? 20 : 17), maxX: x + (index === 11 ? 20 : 17), minZ: 134, maxZ: 162,
  })),
  ...Array.from({ length: 14 }, (_, index) => {
    const x = 92 + (index % 7) * 26
    const z = 82 + Math.floor(index / 7) * 28
    return { id: `BULK-TANK-${String(index + 1).padStart(2, '0')}`, label: `Liquid bulk tank ${String(index + 1).padStart(2, '0')}`, minX: x - 11, maxX: x + 11, minZ: z - 11, maxZ: z + 11 }
  }),
  ...[-320, -250, -180, -110, -40, 30].flatMap((x, index) => [-8, 8].map((offset, leg) => ({
    id: `STS-CRANE-${index + 1}-LEG-${leg + 1}`, label: `Ship-to-shore crane ${index + 1} leg ${leg + 1}`,
    minX: x + offset - 1.5, maxX: x + offset + 1.5, minZ: 36.5, maxZ: 41.5,
  }))),
]

function OverlapMonitor({ poses, onIncidents, onIncidentDetected }: { poses: MutableRefObject<Map<string, VesselPose>>; onIncidents: (incidents: PortIncident[]) => void; onIncidentDetected: (incident: PortIncident) => void }) {
  const lastUpdate = useRef(0)
  const lastSignature = useRef('')
  const activeIncidentKeys = useRef(new Set<string>())
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.2) return
    lastUpdate.current = clock.elapsedTime
    const entries = [...poses.current.entries()]
    const incidents: PortIncident[] = []
    const bounds = (pose: VesselPose) => footprintBounds({ x: pose.x, z: pose.z, yaw: pose.yaw, length: pose.length, beam: pose.width, clearance: 0.8 })
    for (let index = 0; index < entries.length; index += 1) {
      const [id, pose] = entries[index]
      const box = bounds(pose)
      for (const area of collisionAreas) if (boundsOverlap(box, area)) incidents.push({ id: `${id}:${area.id}`, title: `${id} overlaps ${area.label}`, detail: `Physical overlap detected between vessel ${id} and ${area.label}.`, vesselId: ['SAILING', 'REPOSITIONING'].includes(pose.status) ? id : undefined })
      for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
        const [otherId, otherPose] = entries[otherIndex]
        if (boundsOverlap(box, bounds(otherPose))) {
          const pairId = `${id}:${otherId}`
          const underway = [id, otherId].filter(vesselId => ['SAILING', 'REPOSITIONING'].includes(poses.current.get(vesselId)?.status ?? ''))
          if (underway.length) underway.forEach(vesselId => incidents.push({ id: `${pairId}:${vesselId}`, title: `${id} overlaps ${otherId}`, detail: `Physical overlap detected between vessels ${id} and ${otherId}.`, vesselId }))
          else incidents.push({ id: pairId, title: `${id} overlaps ${otherId}`, detail: `Physical overlap detected between vessels ${id} and ${otherId}.` })
        }
      }
    }
    const keys = incidents.map(incident => `${incident.id}:${incident.vesselId ?? 'local'}`)
    const signature = keys.sort().join('|')
    if (signature !== lastSignature.current) {
      incidents.filter(incident => !activeIncidentKeys.current.has(`${incident.id}:${incident.vesselId ?? 'local'}`)).forEach(onIncidentDetected)
      lastSignature.current = signature
      activeIncidentKeys.current = new Set(keys)
      onIncidents(incidents)
    }
  })
  return null
}

function routeForBerth(x: number, z: number, side: number, laneOffset = 0): Point[] {
  const fan = (points: Point[]) => points.map(([px, pz], index) => [px + (index === 0 ? 0 : laneOffset), pz] as Point)
  if (x >= 100) return fan([[x, z], [x + 22, z - 16], [190, -126], [190, -164], [120, -184], [20 + side * 48, -194]])
  if (z <= -100) return fan([[x, z], [x - 22, -136], [-118, -162], [20 + side * 48, -194]])
  return fan([[x, z], [x - 18, z - 24], [-132, -88], [-132, -142], [-92, -174], [20 + side * 48, -194]])
}

function Ship({ vessel, berth, berthPosition, nodes, portNodeId, portLatitude, simulationTimeHours, simulationRunning, clockProfileId, poses, select, oceanDisplay, selected }: {
  vessel: YardVessel
  berth: number
  berthPosition: Point
  nodes: YardNode[]
  portNodeId: string
  portLatitude: number
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  poses: MutableRefObject<Map<string, VesselPose>>
  select: (selection: Selection) => void
  oceanDisplay: boolean
  selected: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const proximityWaves = useRef<THREE.Group>(null)
  const nearPort = useRef(false)
  const cursor = useRef({ server: simulationTimeHours, visual: simulationTimeHours, running: simulationRunning, rate: clockRates[clockProfileId] ?? 1 })
  const vesselClass = vesselClassFor(vessel.type ?? '', vessel.capability)
  const vesselProfile = VESSEL_PROFILES[vesselClass]
  const modelScale = scaleModelToTarget(MODEL_REFERENCE.vesselHull, vesselProfile)
  const tanker = vesselClass === 'tanker'
  const barge = vesselClass === 'barge'
  const containerShip = vesselClass === 'container' || vesselClass === 'general'
  const side = useMemo(() => {
    const nodeById = new Map(nodes.map(node => [node.id, node]))
    const pathNodes = vessel.currentRoutePath.map(id => nodeById.get(id)).filter((node): node is YardNode => Boolean(node))
    const portIndex = pathNodes.findIndex(node => node.id === portNodeId)
    if (portIndex < 0 || pathNodes.length < 2) return berth % 2 === 0 ? -1 : 1
    const remote = portIndex === 0 ? pathNodes[pathNodes.length - 1] : pathNodes[0]
    return Math.sign((remote.longitude - pathNodes[portIndex].longitude) * Math.cos(portLatitude * Math.PI / 180)) || 1
  }, [nodes, portLatitude, portNodeId, vessel.currentRoutePath, berth])
  const routeDistanceAtPortKm = useMemo(
    () => distanceAlongRouteToNodeKm(vessel.currentRoutePath, nodes, portNodeId),
    [vessel.currentRoutePath, nodes, portNodeId],
  )
  const laneOffset = (berth - 8) * 18
  const localRoute = useMemo<Point[]>(() => tanker && berth < 2
    ? [[berthPosition[0], berthPosition[1]], [230, 8], [232, -70], [225, -150], [120 + (berth === 0 ? -18 : 18), -184], [20 + side * 48, -194]]
    : routeForBerth(berthPosition[0], berthPosition[1], side, laneOffset), [berthPosition, side, tanker, berth, laneOffset])
  const sailing = !oceanDisplay && ['SAILING', 'REPOSITIONING'].includes(vessel.status) && vessel.currentRoutePath.length > 1
  const startAtPort = vessel.currentRoutePath[0] === portNodeId
  const motionRoute = useMemo(() => sailing && !startAtPort ? [...localRoute].reverse() : localRoute, [sailing, startAtPort, localRoute])
  const hull = useMemo(() => {
    const stations = barge
      ? [{ z: -17, width: 1.9 }, { z: -15, width: 2.8 }, { z: 14, width: 2.8 }, { z: 17, width: 2.8 }]
      : [
        { z: -17, width: 0 }, { z: -15.5, width: 2.15 }, { z: -13.5, width: 2.8 },
        { z: 13.5, width: 2.8 }, { z: 15.5, width: 2.25 }, { z: 17, width: 0 },
      ]
    const profile: [number, number][] = [
      [-0.72, 0.06], [-1, 0.28], [-1, 1.28], [-0.82, 1.95],
      [0.82, 1.95], [1, 1.28], [1, 0.28], [0.72, 0.06],
    ]
    const positions: number[] = []
    const indices: number[] = []
    for (const station of stations) for (const [widthFactor, y] of profile) positions.push(station.width * widthFactor, y, station.z)
    const ringSize = profile.length
    for (let station = 0; station < stations.length - 1; station++) {
      for (let edge = 0; edge < ringSize; edge++) {
        const a = station * ringSize + edge
        const b = station * ringSize + (edge + 1) % ringSize
        const c = (station + 1) * ringSize + (edge + 1) % ringSize
        const d = (station + 1) * ringSize + edge
        indices.push(a, d, b, b, d, c)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }, [barge])
  const deckContainers = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    index,
    x: -1.425 + (index % 4) * 0.95,
    z: -10.4 + Math.floor(index / 4) * 5.2,
    tiers: vessel.assignedCargoIds.length === 0
      ? containerShip && index < 12 ? 1 : 0
      : 1 + (index % 4 === 0 ? 1 : 0) + (index < Math.min(vessel.assignedCargoIds.length, 2) * 2 ? 1 : 0),
  })), [vessel.assignedCargoIds.length, containerShip])
  useEffect(() => {
    const time = cursor.current
    if (!simulationRunning || simulationTimeHours < time.server) time.visual = simulationTimeHours
    else time.visual = Math.max(time.visual, simulationTimeHours)
    time.server = simulationTimeHours
    time.running = simulationRunning
    time.rate = clockRates[clockProfileId] ?? 1
  }, [simulationTimeHours, simulationRunning, clockProfileId])
  useEffect(() => () => { poses.current.delete(vessel.id) }, [poses, vessel.id])
  useFrame(({ clock }, delta) => {
    if (!SCENE_MOTION_ENABLED) return
    if (!group.current) return
    const time = cursor.current
    if (sailing && time.running) time.visual += delta * time.rate
    let targetPosition = berthPosition
    let heading = 0
    if (sailing) {
      const start = vessel.currentVoyageStartedAt ?? time.server
      const end = vessel.expectedArrivalAt ?? start + 72
      const progress = end <= start ? 1 : Math.max(0, Math.min(1, (time.visual - start) / (end - start)))
      targetPosition = pointAlongRoute(motionRoute, progress)
      const ahead = pointAlongRoute(motionRoute, Math.min(1, progress + 0.003))
      // The modeled bow faces local -Z, so rotate against the travel vector.
      heading = Math.atan2(targetPosition[0] - ahead[0], targetPosition[1] - ahead[1])
    }
    let portDistanceKm = vessel.currentNodeId === portNodeId && !sailing ? 0 : Number.POSITIVE_INFINITY
    if (sailing && vessel.currentRouteDistanceKm && vessel.currentRouteDistanceKm > 0) {
      const start = vessel.currentVoyageStartedAt ?? time.server
      const end = vessel.expectedArrivalAt ?? start + 72
      const progress = end <= start ? 1 : Math.max(0, Math.min(1, (time.visual - start) / (end - start)))
      if (routeDistanceAtPortKm !== null) {
        const traveledKm = vessel.currentRouteDistanceKm * progress
        portDistanceKm = Math.abs(traveledKm - routeDistanceAtPortKm)
      }
    }
    if (nearPort.current ? portDistanceKm > PORT_ANIMATION_EXIT_DISTANCE_KM : portDistanceKm <= PORT_ANIMATION_ENTER_DISTANCE_KM) {
      nearPort.current = !nearPort.current
    }
    const bob = oceanDisplay
      ? Math.sin(clock.elapsedTime * 0.72 + berth) * 0.62 + Math.sin(clock.elapsedTime * 0.39 + berth * 0.4) * 0.24
      : nearPort.current ? Math.sin(clock.elapsedTime * 1.1 + berth) * 0.32 : 0
    const roll = oceanDisplay
      ? Math.sin(clock.elapsedTime * 0.53 + berth * 0.7) * 0.038
      : nearPort.current ? Math.sin(clock.elapsedTime * 0.8 + berth) * 0.022 : 0
    const frameDelta = Math.min(delta, 0.08)
    const smoothing = 1 - Math.exp(-frameDelta * (sailing ? 2.2 : 5.5))
    if (sailing) {
      const dx = targetPosition[0] - group.current.position.x
      const dz = targetPosition[1] - group.current.position.z
      const distance = Math.hypot(dx, dz)
      const step = Math.min(distance, 32 * frameDelta)
      if (distance > 0.001) {
        group.current.position.x += dx / distance * step
        group.current.position.z += dz / distance * step
      }
    } else {
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetPosition[0], 5.5, frameDelta)
      group.current.position.z = THREE.MathUtils.damp(group.current.position.z, targetPosition[1], 5.5, frameDelta)
    }
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, -0.65 + bob, 4, frameDelta)
    const quayFacing = !oceanDisplay && (tanker ? berth < 2 : berth < 5 || berth >= 13 && berth < 17)
    const dockHeading = tanker ? -Math.PI / 2 : Math.PI / 2
    const desiredHeading = sailing ? heading : oceanDisplay ? 0 : quayFacing ? dockHeading : 0
    const yawDelta = Math.atan2(Math.sin(desiredHeading - group.current.rotation.y), Math.cos(desiredHeading - group.current.rotation.y))
    group.current.rotation.y += yawDelta * smoothing
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, roll, 2.8, frameDelta)
    poses.current.set(vessel.id, { x: group.current.position.x, z: group.current.position.z, yaw: group.current.rotation.y, length: vesselProfile.length, width: vesselProfile.beam, status: vessel.status })
    const waves = proximityWaves.current
    if (waves) {
      waves.visible = nearPort.current && insidePortSea(group.current.position.x, group.current.position.z, 13 * 1.85)
      waves.children.forEach((wave, index) => {
        const phase = (clock.elapsedTime * 0.24 + index * 0.5) % 1
        wave.scale.setScalar(1 + phase * 0.85)
        const material = (wave as THREE.Mesh).material as THREE.MeshBasicMaterial
        material.opacity = nearPort.current ? (1 - phase) * 0.35 : 0
      })
    }
  })
  const handleClick = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    select({
      id: vessel.id,
      title: containerShip ? 'Container ship' : vessel.type ?? (tanker ? 'Liquid bulk tanker' : 'Container ship'),
      status: vessel.status,
      detail: `${vessel.capability} capability · ${vessel.deadweightTonnes ? `${vessel.deadweightTonnes.toLocaleString()} t DWT` : 'capacity not supplied'} · ${vessel.assignedCargoIds.length} assigned cargo${oceanDisplay ? ' · displayed in open water' : sailing ? ' · following the live local sea lane' : ' · moored with wave motion'}`,
      shipPose: group.current ? { x: group.current.position.x, z: group.current.position.z, yaw: group.current.rotation.y, scaleX: group.current.scale.x, scaleY: group.current.scale.y, scaleZ: group.current.scale.z } : undefined,
    })
  }, [select, sailing, vessel, tanker, oceanDisplay])
  return <>
    {sailing && <Line points={motionRoute.map(([x, z]) => [x, -0.55, z] as WorldPoint)} color="#54cfc3" lineWidth={1.8} transparent opacity={0.72} />}
    <group ref={group} position={[berthPosition[0], -0.65, berthPosition[1]]} scale={[modelScale.x, modelScale.y, modelScale.z]} onClick={handleClick}>
      <group ref={proximityWaves} position={[0, 0.05, 0]}>
        {[0, 1].map(index => <mesh key={index} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[13, 0.24, 8, 48]} />
          <meshBasicMaterial color="#66d5d0" transparent opacity={0.25} depthWrite={false} />
        </mesh>)}
      </group>
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial color={tanker ? '#627d83' : vessel.type === 'BULK_CARRIER' ? '#44586e' : '#35495d'} roughness={0.62} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      {selected && <mesh position={[0, 2.48, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.9, 18.9, 1]} renderOrder={5}>
        <torusGeometry args={[1, 0.055, 8, 96]} />
        <meshBasicMaterial color="#55fff0" toneMapped={false} transparent opacity={0.96} depthWrite={false} />
      </mesh>}
      {/* One deck plate sits cleanly above the hull, avoiding intersecting coplanar layers. */}
      <Block position={[0, 2.04, 0]} size={[4.55, 0.14, 27.2]} color="#929da1" />
      {/* Open deck fittings stay visible on light ships as well as loaded vessels. */}
      {[-2.16, 2.16].map(x => <group key={`deck-rail-${x}`}>
        <Block position={[x, 2.31, 0]} size={[0.08, 0.48, 26.4]} color="#bdc4c0" />
        <Block position={[x, 2.58, 0]} size={[0.1, 0.06, 26.8]} color="#d8c58e" emissive="#43351c" />
        {Array.from({ length: 13 }, (_, index) => <Block key={index} position={[x, 2.3, -12.2 + index * 2]} size={[0.12, 0.55, 0.12]} color="#d1d4ce" />)}
      </group>)}
      {[-1.87, 1.87].map(x => <Block key={`deck-lane-${x}`} position={[x, 2.12, 0]} size={[0.055, 0.018, 24.8]} color="#d9bd75" emissive="#3f351f" />)}
      <Block position={[0, 2.2, -13.2]} size={[2.5, 0.1, 3.8]} color="#b73831" />
      {tanker ? <TankerDeck /> : <>
        {deckContainers.flatMap(({ index, x, z, tiers }) => Array.from({ length: tiers }, (_, tier) => (
          <group key={`container-${index}-${tier}`} position={[x, 2.75 + tier * 1.06, z]}>
            <Block position={[0, 0, 0]} size={[0.93, 1.02, 4.88]} color={palette[(index + tier + berth) % palette.length]} />
            <Block position={[0, 0.31, -2.43]} size={[0.91, 0.018, 0.018]} color="#e7ded0" />
            <Block position={[0, 0.31, 2.43]} size={[0.91, 0.018, 0.018]} color="#e7ded0" />
          </group>
        )))}
      </>}
      {!tanker && vessel.assignedCargoIds.length === 0 && [-7.8, -2.6, 2.6, 7.8].map((z, index) => <group key={`empty-hatch-${index}`}>
        <Block position={[0, 2.2, z]} size={[3.58, 0.16, 2.16]} color="#68777a" />
        {[-1.55, 1.55].map(x => <Block key={x} position={[x, 2.3, z]} size={[0.07, 0.08, 2.03]} color="#c8b579" emissive="#4b3f22" />)}
      </group>)}
      <Block position={[0, 4, 12.1]} size={[4.6, 3.5, 5.4]} color="#283641" />
      <Block position={[0, 5.93, 12.3]} size={[4.9, 0.3, 5.8]} color="#172631" />
      <mesh position={[0, 5.03, 9.35]}>
        <boxGeometry args={[4.22, 1.32, 0.08]} />
        <meshPhysicalMaterial color="#75bbca" emissive="#16485b" emissiveIntensity={0.34} metalness={0.22} roughness={0.14} transparent opacity={0.86} />
      </mesh>
      {[-1.5, 0, 1.5].map(x => <Block key={`bridge-window-mullion-${x}`} position={[x, 5.03, 9.42]} size={[0.075, 1.42, 0.1]} color="#b5c7c6" />)}
      <Block position={[0, 5.75, 9.42]} size={[4.35, 0.08, 0.1]} color="#a8b9b8" />
      {[-1, 1].map(side => <mesh key={`bridge-side-window-${side}`} position={[side * 2.28, 5.02, 12.4]} rotation={[0, side * Math.PI / 2, 0]}>
        <boxGeometry args={[4.35, 1.3, 0.07]} />
        <meshPhysicalMaterial color="#5593a4" emissive="#123f4c" emissiveIntensity={0.2} metalness={0.18} roughness={0.18} transparent opacity={0.78} />
      </mesh>)}
      {[-1.5, -0.5, 0.5, 1.5].map((x, index) => <group key={`bridge-console-${index}`} position={[x, 4.22, 10.05]}>
        <Block position={[0, 0, 0]} size={[0.86, 0.62, 0.36]} color="#101b24" />
        <mesh position={[0, 0.02, 0.2]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.72, 0.42]} /><meshBasicMaterial color={index % 2 ? '#37c9c7' : '#4b8fe2'} /></mesh>
        <Block position={[0, -0.27, 0.22]} size={[0.54, 0.025, 0.015]} color="#72ddd0" emissive="#19756c" />
      </group>)}
      <Block position={[0, 6.25, 12.3]} size={[1.5, 0.12, 1.4]} color="#c2cccb" />
      <Block position={[0, 5.76, 9.45]} size={[3.9, 0.055, 0.08]} color="#41d8d1" emissive="#15a39b" />
      <Block position={[0, 7, 12.3]} size={[0.16, 1.4, 0.16]} color="#bbc5c4" />
      <WorldLabel position={[0, 8.1, 0]} size={1.8}>{`${vessel.id} · ${vessel.status}`}</WorldLabel>
      <mesh position={[0, 3.4, 0]}>
        <boxGeometry args={[6.2, 8.6, 34]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  </>
}

function TankerDeck() {
  return <>
    {[-7.5, -2.5, 2.5, 7.5].map((z, index) => <group key={z} position={[0, 2.75, z]}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[0.88, 0.88, 1.05, 16]} /><meshStandardMaterial color={index % 2 ? '#b7b5a5' : '#c2c0b0'} roughness={0.7} /></mesh>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.82, 0.82, 0.12, 16]} /><meshStandardMaterial color="#566b67" /></mesh>
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
    if (!SCENE_MOTION_ENABLED) return
    if (!group.current) return
    const progress = (clock.elapsedTime * (0.014 + index * 0.001) + index * 0.23) % 1
    const position = pointAlongRoute(route, progress)
    const next = pointAlongRoute(route, (progress + 0.002) % 1)
    group.current.position.set(position[0], -0.79 + Math.sin(clock.elapsedTime * 2 + index) * 0.06, position[1])
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
    <Line points={[[-4.5, 0.19, -1], [-6.8, 0.19, -2], [-8, 0.19, -2.7]]} color="#cbe6e3" lineWidth={1.4} transparent opacity={0.68} />
    <mesh position={[0, 1, 0]}><boxGeometry args={[9.5, 4.5, 3.8]} /><meshBasicMaterial transparent opacity={0} /></mesh>
  </group>
}

const vehicleBodies = new Map<string, Footprint2>()

function vehiclePositionBlocked(id: string, candidate: Footprint2) {
  if (VEHICLE_STATIC_OBSTACLES.some(box => footprintsOverlap(candidate, {
    x: box.x, z: box.z, yaw: 0, length: box.hz * 2, beam: box.hx * 2,
  }))) return true
  for (const [otherId, body] of vehicleBodies) {
    if (otherId !== id && footprintsOverlap(candidate, body)) return true
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
  const dimensions: [number, number, number] = kind === 'YARD TRUCK' ? [8, 3, 3.6] : kind === 'PICKUP' ? [7.2, 2.8, 3.4] : [6.8, 2.1, 3.2]
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
    if (!SCENE_MOTION_ENABLED) return
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
    const vehicleFootprint: Footprint2 = {
      x: candidateX,
      z: candidateZ,
      yaw: state.heading + Math.PI / 2,
      length: dimensions[0],
      beam: dimensions[2],
      clearance: 0.8,
    }
    if (vehiclePositionBlocked(id, vehicleFootprint)) {
      state.speed = 0
      state.x = previousX
      state.z = previousZ
    } else {
      state.x = candidateX
      state.z = candidateZ
    }
    vehicleBodies.set(id, { ...vehicleFootprint, x: state.x, z: state.z })
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
  const cabMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 }), [bodyColor])
  useEffect(() => () => cabMaterial.dispose(), [cabMaterial])
  return <group ref={group} onClick={click}>
    {/* WT truck proportions: separate chassis, ribbed cargo box, rounded cab, glass, and axles. */}
    <Block position={[-0.45, 0.75, 0]} size={[7.7, 0.42, 3.15]} color="#3b4357" />
    <Block position={[-2.05, 2.48, 0]} size={[4.95, 3.05, 3.05]} color={kind === 'YARD TRUCK' ? '#f7f8fc' : bodyColor} />
    {[-3.8, -2.95, -2.1, -1.25, -0.4].map((x) => <Block key={`rib-${x}`} position={[x, 2.48, 1.56]} size={[0.075, 2.68, 0.08]} color="#70808b" />)}
    <Block position={[-2.05, 1.05, 0]} size={[5.15, 0.28, 3.35]} color="#9aa3b8" />
    <Block position={[-4.56, 2.48, 0]} size={[0.09, 2.95, 3.1]} color="#e3e7f0" />
    <Block position={[-4.61, 2.48, 0]} size={[0.06, 2.65, 0.09]} color="#6f7d8b" />
    <Block position={[-4.61, 2.48, 0.8]} size={[0.06, 2.65, 0.08]} color="#6f7d8b" />
    <Block position={[2.4, 0.84, 0]} size={[1.8, 0.4, 2.6]} color="#3b4357" />
    <RoundedBox args={[2.45, 2.5, 2.75]} radius={0.22} smoothness={2} position={[2.55, 2.05, 0]} material={cabMaterial} castShadow />
    <Block position={[2.62, 1.18, 0]} size={[2.5, 0.28, 2.82]} color={kind === 'YARD TRUCK' ? '#c47855' : '#9aa3b8'} />
    <Block position={[2.61, 2.65, 1.39]} size={[1.45, 0.85, 0.08]} color="#23345e" />
    <Block position={[2.61, 2.65, -1.39]} size={[1.45, 0.85, 0.08]} color="#23345e" />
    {[-3.2, -1.85, 1.65, 2.8].flatMap((x) => [-1, 1].map(side => <group key={`${x}:${side}`} position={[x, 0.55, side * 1.68]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.58, 0.58, 0.4, 14]} /><meshStandardMaterial color="#2a2f3d" roughness={0.9} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, side * 0.21, 0]}><cylinderGeometry args={[0.25, 0.25, 0.42, 12]} /><meshStandardMaterial color="#c9cfdc" /></mesh>
    </group>))}
    <Block position={[3.82, 1.18, 0]} size={[0.28, 0.36, 2.8]} color="#9aa3b8" />
    <Block position={[3.89, 1.42, 0.92]} size={[0.08, 0.22, 0.42]} color="#ffe9a8" emissive="#ffd36b" />
    <Block position={[3.89, 1.42, -0.92]} size={[0.08, 0.22, 0.42]} color="#ffe9a8" emissive="#ffd36b" />
    {!driving && <WorldLabel position={[0, dimensions[1] + 3.2, 0]} size={0.95}>{`${id}${cargoType ? ` · ${cargoType.toUpperCase()}` : ''} · CLICK TO DRIVE`}</WorldLabel>}
    <mesh position={[0, dimensions[1] * 0.45, 0]} onClick={click}>
      <boxGeometry args={[dimensions[0] * 1.35, dimensions[1] * 1.5, dimensions[2] * 1.3]} /><meshBasicMaterial transparent opacity={0} />
    </mesh>
  </group>
}

function BreakwaterMarkers() {
  return <>
    {[-1, 1].map((side, sideIndex) => Array.from({ length: 6 }, (_, index) => <group key={`${sideIndex}:${index}`} position={[side < 0 ? -146 + index * 18 : 42 + index * 18, 0, -156]}>
      <Block position={[0, 3.2, 0]} size={[1, 6.4, 1]} color="#e7e2cc" />
      <Block position={[0, 6.7, 0]} size={[2, 0.7, 2]} color={index % 2 ? '#d27a58' : '#70958c'} emissive={index % 2 ? '#ac4930' : '#486e66'} />
    </group>))}
    {[-1, 1].flatMap((side, sideIndex) => Array.from({ length: 4 }, (_, index) => {
      const t = index / 3
      return <group key={`arm-${sideIndex}:${index}`} position={[side * (220 - t * 70), 0, -240 + t * 84]}>
        <Block position={[0, 3.2, 0]} size={[1, 6.4, 1]} color="#e7e2cc" />
        <Block position={[0, 6.7, 0]} size={[2, 0.7, 2]} color={index % 2 ? '#d27a58' : '#70958c'} emissive={index % 2 ? '#ac4930' : '#486e66'} />
      </group>
    }) )}
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

function Scene({ vessels, nodes, portNodeId, portLatitude, simulationTimeHours, simulationRunning, clockProfileId, previewHour, dayNightFrozen, select, selectedId, drivingVehicleId, droneMode, constructViewer, constructSelection, cameraControls, onDrive, onExitDrive, onExitDrone, onIncidents, onIncidentDetected }: {
  vessels: YardVessel[]
  nodes: YardNode[]
  portNodeId: string
  portLatitude: number
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  previewHour: number | null
  dayNightFrozen: boolean
  select: (selection: Selection) => void
  selectedId: string | null
  drivingVehicleId: string | null
  droneMode: boolean
  constructViewer: boolean
  constructSelection: ConstructPick[]
  onExitDrone: () => void
  cameraControls: { current: CameraControls | null }
  onDrive: (id: string, position: Point) => void
  onExitDrive: () => void
  onIncidents: (incidents: PortIncident[]) => void
  onIncidentDetected: (incident: PortIncident) => void
}) {
  const vesselPoses = useRef(new Map<string, VesselPose>())
  const renderedVessels = vessels.filter(vessel => vessel.startsAtPort || vessel.routeTouchesPort || vessel.currentNodeId === portNodeId)
  const berthAssignments = useMemo(() => {
    const slots = BerthPositions()
    const classCounts = new Map<string, number>()
    let oceanCount = 0
    const occupied: Array<{ x: number; z: number; yaw: number; length: number; beam: number; clearance?: number }> = collisionAreas.map(area => ({
      x: (area.minX + area.maxX) / 2,
      z: (area.minZ + area.maxZ) / 2,
      yaw: 0,
      length: area.maxZ - area.minZ,
      beam: area.maxX - area.minX,
    }))
    return renderedVessels.slice(0, 2).map(vessel => {
      const kind = vesselClassFor(vessel.type ?? '', vessel.capability)
      const tanker = kind === 'tanker'
      const oceanDisplay = !vessel.routeTouchesPort && !vessel.startsAtPort && vessel.currentNodeId !== portNodeId
      const key = tanker ? 'tanker' : 'cargo'
      const berth = oceanDisplay ? oceanCount++ : classCounts.get(key) ?? 0
      if (!oceanDisplay) classCounts.set(key, berth + 1)
      const preferred: Point = oceanDisplay
        ? [-480 + (berth % 7) * 160, -420 - Math.floor(berth / 7) * 112]
        : tanker
        ? berth < 2 ? [[130, 28], [214, 28]][berth] as Point : [-330 + ((berth - 2) % 16) * 44, -230 - Math.floor((berth - 2) / 16) * 90]
        : slots[berth] ?? [-410 + ((berth - slots.length) % 20) * 44, -310 - Math.floor((berth - slots.length) / 20) * 90]
      const quayFacing = !oceanDisplay && (tanker ? berth < 2 : berth < 5 || berth >= 13 && berth < 17)
      const yaw = oceanDisplay ? 0 : tanker ? berth < 2 ? -Math.PI / 2 : 0 : quayFacing ? Math.PI / 2 : 0
      const profile = VESSEL_PROFILES[kind]
      const candidate = { x: preferred[0], z: preferred[1], yaw, length: profile.length, beam: profile.beam, clearance: 0.8 }
      const placed = findClearFootprint(candidate, occupied)
      occupied.push(placed)
      return { vessel: { ...vessel, oceanDisplay }, berth, berthPosition: [placed.x, placed.z] as Point }
    })
  }, [renderedVessels, portNodeId])
  return <>
    <OverlapMonitor poses={vesselPoses} onIncidents={onIncidents} onIncidentDetected={onIncidentDetected} />
    <LightingCycle simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} previewHour={previewHour} dayNightFrozen={dayNightFrozen} />
    <group scale={[WORLD_SCALE, WORLD_SCALE, WORLD_SCALE]}>
    <group position={PORT_WORLD_OFFSET}><LekkiPortWorld showCargoVessels={false} /></group>
    {constructViewer && <ConstructViewerOverlay />}
    {constructViewer && <ConstructCellHighlights selection={constructSelection} />}
    {berthAssignments.map(({ vessel, berth, berthPosition }) => <Ship key={vessel.id} vessel={vessel} berth={berth} berthPosition={berthPosition} nodes={nodes} portNodeId={portNodeId} portLatitude={portLatitude} simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} poses={vesselPoses} select={select} oceanDisplay={Boolean(vessel.oceanDisplay)} selected={selectedId === vessel.id} />)}
    <DroneController active={droneMode} cameraControls={cameraControls} onExit={onExitDrone} />
    </group>
  </>
}

function formatHour(hour: number) {
  const rounded = Math.floor(((hour % 24) + 24) % 24)
  return `${String(rounded).padStart(2, '0')}:00`
}

export default function PortYard({ vessels, demands, nodes, port, simulationTimeHours, simulationRunning, clockProfileId, dayNightFrozen, onToggleOverlays, onFocusScene, onIncidentDetected }: {
  vessels: YardVessel[]
  demands: YardDemand[]
  nodes: YardNode[]
  port: { portId: string; latitude: number; longitude: number } | null
  simulationTimeHours: number
  simulationRunning: boolean
  clockProfileId: string
  dayNightFrozen: boolean
  onToggleOverlays: () => void
  onFocusScene: () => void
  onIncidentDetected: (incident: PortIncident) => void
}) {
  const [selected, setSelected] = useState<Selection>(null)
  const [bridgeView, setBridgeView] = useState(false)
  const [drivingVehicleId, setDrivingVehicleId] = useState<string | null>(null)
  const [droneMode, setDroneMode] = useState(false)
  const [constructViewer, setConstructViewer] = useState(false)
  const [constructSelection, setConstructSelection] = useState<ConstructPick[]>([])
  const [constructMarquee, setConstructMarquee] = useState<ConstructMarquee | null>(null)
  const [selectionCopyStatus, setSelectionCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [portIncidents, setPortIncidents] = useState<PortIncident[]>([])
  const [worldClockVisible, setWorldClockVisible] = useState(true)
  const [previewHour, setPreviewHour] = useState<number | null>(null)
  const [cameraPov, setCameraPov] = useState('overview')
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
  const setPov = (value: string) => {
    setBridgeView(false)
    if (cameraControls.current) cameraControls.current.minDistance = 100
    setCameraPov(value)
    setDroneMode(false)
    if (value === 'overview') {
      cameraControls.current?.setLookAt(...PORT_AERIAL_POSITION, ...PORT_AERIAL_TARGET, true)
    } else if (value === 'ship-approach') {
      cameraControls.current?.setLookAt(-180 * WORLD_SCALE, 36 * WORLD_SCALE, 140 * WORLD_SCALE, -350 * WORLD_SCALE, 3 * WORLD_SCALE, 27 * WORLD_SCALE, true)
    } else {
      cameraControls.current?.setLookAt(65 * WORLD_SCALE, 80 * WORLD_SCALE, 250 * WORLD_SCALE, -90 * WORLD_SCALE, 0, 25 * WORLD_SCALE, true)
    }
  }
  const handleDrive = useCallback((id: string, position: Point, cargoType?: string) => {
    setBridgeView(false)
    if (cameraControls.current) cameraControls.current.minDistance = 100
    setDroneMode(false)
    setDrivingVehicleId(id)
    setSelected({ id, title: 'Driveable harbor vehicle', status: 'PLAYER CONTROL', detail: `Use W/A/S/D to drive, Space to brake, and Esc to stop driving.${cargoType ? ` Cargo on board: ${cargoType}.` : ''}` })
    cameraControls.current?.setLookAt((position[0] + 34) * WORLD_SCALE, 26 * WORLD_SCALE, (position[1] + 37) * WORLD_SCALE, position[0] * WORLD_SCALE, 0, position[1] * WORLD_SCALE, true)
  }, [])
  const exitDrive = useCallback(() => {
    if (drivingVehicleId) cameraControls.current?.setLookAt(...PORT_AERIAL_POSITION, ...PORT_AERIAL_TARGET, true)
    setDrivingVehicleId(null)
  }, [drivingVehicleId])
  const enterBridge = useCallback(() => {
    if (!selected?.shipPose) return
    const { x, z, yaw } = selected.shipPose
    const pointAt = (localZ: number, localY: number): WorldPoint => [
      (x + Math.sin(yaw) * localZ * selected.shipPose!.scaleZ) * WORLD_SCALE,
      (-0.65 + localY * selected.shipPose!.scaleY) * WORLD_SCALE,
      (z + Math.cos(yaw) * localZ * selected.shipPose!.scaleZ) * WORLD_SCALE,
    ]
    const camera = pointAt(11.35, 4.98)
    const target = pointAt(-2, 4.95)
    setBridgeView(true)
    setDroneMode(false)
    setDrivingVehicleId(null)
    if (cameraControls.current) {
      cameraControls.current.minDistance = 6
      cameraControls.current.setLookAt(...camera, ...target, true)
    }
  }, [selected])
  const exitBridge = useCallback(() => {
    setBridgeView(false)
    if (cameraControls.current) cameraControls.current.minDistance = 100
    cameraControls.current?.setLookAt(...PORT_AERIAL_POSITION, ...PORT_AERIAL_TARGET, true)
  }, [])
  const pickConstructCell = useCallback((region: ConstructPick, shift: boolean) => {
    if (!constructViewer) return
    setConstructSelection(current => {
      if (!shift) return [region]
      return current.some(item => item.key === region.key)
        ? current.filter(item => item.key !== region.key)
        : [...current, region]
    })
  }, [constructViewer])
  const copyConstructSelection = useCallback(async () => {
    const totalGridCells = constructSelection.reduce((total, region) => total + region.width * region.depth, 0)
    const payload = {
      source: 'Rycorn Universal Port Construct Viewer',
      schemaVersion: 1,
      gridCellSizeMeters: 10,
      coordinateFrame: 'local-port-grid; x east, z south; one scene unit equals one meter',
      totalGridCells,
      selections: constructSelection.map((region, index) => ({
        id: index + 1,
        label: region.label,
        columns: [region.columnMin + 1, region.columnMax + 1],
        rows: [region.rowMin + 1, region.rowMax + 1],
        centerSceneUnits: [Number(region.x.toFixed(1)), Number(region.z.toFixed(1))],
        sizeMeters: [region.width * 10, region.depth * 10],
        block: { type: 'rectangular-prism', sizeMeters: [region.width * 10, 0.2, region.depth * 10] },
        gridCells: region.width * region.depth,
      })),
    }
    const text = JSON.stringify(payload, null, 2)
    try {
      let copied = false
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
          copied = true
        } catch {
          // Fall back below when clipboard permissions or browser support are unavailable.
        }
      }
      if (!copied) {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('Clipboard copy was unavailable')
      }
      setSelectionCopyStatus('copied')
    } catch {
      setSelectionCopyStatus('failed')
    }
  }, [constructSelection])
  useEffect(() => setSelectionCopyStatus('idle'), [constructSelection])
  useEffect(() => {
    let frame = 0
    let attempts = 0
    let cancelled = false
    const aimAtHarbor = () => {
      if (cancelled) return
      if (cameraControls.current) {
        cameraControls.current.setLookAt(...PORT_AERIAL_POSITION, ...PORT_AERIAL_TARGET, false)
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
    <Canvas shadows dpr={[0.65, 1]} camera={{ position: PORT_AERIAL_POSITION, fov: 38, near: 12, far: 12000 }} gl={{ powerPreference: 'high-performance', antialias: false }} onPointerMissed={() => setSelected(null)}>
      <Scene vessels={vessels} nodes={nodes} portNodeId={portNodeId} portLatitude={portLatitude} simulationTimeHours={simulationTimeHours} simulationRunning={simulationRunning} clockProfileId={clockProfileId} previewHour={previewHour} dayNightFrozen={dayNightFrozen} select={setSelected} selectedId={selected?.id ?? null} drivingVehicleId={drivingVehicleId} droneMode={droneMode} constructViewer={constructViewer} constructSelection={constructSelection} cameraControls={cameraControls} onDrive={handleDrive} onExitDrive={exitDrive} onExitDrone={() => setDroneMode(false)} onIncidents={setPortIncidents} onIncidentDetected={onIncidentDetected} />
      <ConstructGridPicker active={constructViewer} onPick={pickConstructCell} onMarquee={setConstructMarquee} />
      <CameraControls ref={cameraControls} makeDefault minDistance={100} maxDistance={7000} minPolarAngle={0.04} maxPolarAngle={Math.PI * 0.38} dollyToCursor smoothTime={0.45} draggingSmoothTime={0.18} />
    </Canvas>
    {portIncidents.length > 0 && <aside className="port-incident-panel" aria-live="polite"><small>ACTIVE PHYSICAL OVERLAP INCIDENTS · {portIncidents.length}</small>{portIncidents.map(incident => <article key={incident.id}><b>{incident.title}</b><span>{incident.detail}</span></article>)}</aside>}
    <nav className="angle-view-controls" aria-label="Harbor camera and drone controls">
      <small>CAMERA · POV</small>
      <select aria-label="Choose harbor point of view" value={cameraPov} onChange={event => setPov(event.target.value)}>
        <option value="overview">Harbor overview</option>
        <option value="ship-approach">Ship approach</option>
        <option value="quay">Quay perspective</option>
      </select>
      <div>{angleViews.map(({ label, x, z }) => <button key={label} aria-label={`View harbor from ${label}`} onClick={() => { setDroneMode(false); setCameraPov('overview'); cameraControls.current?.setLookAt(x, 2600, z, ...PORT_AERIAL_TARGET, true) }}>{label}</button>)}</div>
      <div className="camera-action-row" aria-label="Camera movement">
        <button aria-label="Zoom in" title="Zoom in" onClick={() => cameraControls.current?.dolly(cameraControls.current.distance * 0.25, true)}>+</button>
        <button aria-label="Zoom out" title="Zoom out" onClick={() => cameraControls.current?.dolly(-cameraControls.current.distance * 0.25, true)}>−</button>
        <button aria-label="Rotate left" title="Rotate left" onClick={() => cameraControls.current?.rotate(Math.PI / 6, 0, true)}>↶</button>
        <button aria-label="Rotate right" title="Rotate right" onClick={() => cameraControls.current?.rotate(-Math.PI / 6, 0, true)}>↷</button>
        <button aria-label="Reset camera" title="Reset camera" onClick={() => setPov('overview')}>⌂</button>
      </div>
      <div className="camera-mode-row">
        <button onClick={onToggleOverlays}>LAYERS</button>
        <button onClick={onFocusScene}>FOCUS SCENE</button>
      </div>
      <button className={constructViewer ? 'construct-toggle is-active' : 'construct-toggle'} aria-pressed={constructViewer} onClick={() => setConstructViewer(value => !value)}>CONSTRUCT VIEWER</button>
      <button className={droneMode ? 'drone-toggle is-active' : 'drone-toggle'} onClick={() => { setDrivingVehicleId(null); setDroneMode(value => !value) }}>{droneMode ? 'EXIT DRONE' : 'FLY DRONE'}</button>
      <small className="camera-hint">DRAG ROTATE · RIGHT-DRAG PAN · WHEEL ZOOM</small>
    </nav>
    {constructViewer && <aside className="construct-selection-panel">
      <header><div><small>CONSTRUCT VIEWER</small><b>{constructSelection.reduce((total, region) => total + region.width * region.depth, 0)} GRID CELLS SELECTED</b></div><nav aria-label="Selection actions"><button onClick={() => void copyConstructSelection()} disabled={!constructSelection.length} title="Copy selected block coordinates and sizes as JSON">{selectionCopyStatus === 'copied' ? 'COPIED' : selectionCopyStatus === 'failed' ? 'COPY FAILED' : 'COPY JSON'}</button><button onClick={() => setConstructSelection([])} disabled={!constructSelection.length}>CLEAR</button></nav></header>
      <p>Drag across grid squares; Shift-drag adds another patch.</p>
      {constructSelection.length > 0 && <ol>{constructSelection.map((item, index) => <li key={item.key}><span>{index + 1}</span>{item.label}</li>)}</ol>}
    </aside>}
    {constructViewer && constructMarquee && <div className="construct-marquee" style={constructMarquee} />}
    {selected && <aside className="object-inspector"><button onClick={() => { setSelected(null); exitDrive(); if (bridgeView) exitBridge() }} aria-label="Close selection">×</button><small>SELECTED 3D ASSET</small><b>{selected.id}</b><span>{selected.title} · {selected.status}</span><p>{selected.detail}</p>{selected.shipPose && <button className="bridge-view-button" onClick={bridgeView ? exitBridge : enterBridge}>{bridgeView ? 'EXIT BRIDGE VIEW' : 'ENTER BRIDGE VIEW'}</button>}</aside>}
    {droneMode && <aside className="drone-hud"><button aria-label="Stop drone flight" onClick={() => setDroneMode(false)}>×</button><small>DRONE FLIGHT</small><span>W A S D FLY · Q / E HEIGHT · CLICK-DRAG STEER · ESC EXIT</span></aside>}
  </div>
}
