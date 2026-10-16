import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { CITY_B_OFFSET_Z, CITY_C_OFFSET_Z, PORT_1_OFFSET_Z, PORT_2_OFFSET_Z, PORT_MAIN_OFFSET_Z, ROAD_HALF, WORLD_HALF, WAREHOUSES, yardHalfWidth, buildingCenterZ } from '../sim/world'
import { Trees, ShippingContainer } from './Props'
import { signText, windows } from './textures'
import { daylightAmount, getDayNightSeconds } from './dayNight'
import { useUI } from '../store'

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...p })
const MAT = {
  road: std({ color: '#cdd2e2' }),
  sidewalk: std({ color: '#f7f8fc' }),
  lane: std({ color: '#ffffff' }),
  park: std({ color: '#dbeedd' }),
  lot: std({ color: '#eceef6' }),
}

let s = 11
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
const TEST_STREET_XS = [-150, -50, 50]
const TEST_ROUTE_MIN_Z = CITY_B_OFFSET_Z - 6
const TEST_ROUTE_MAX_Z = 6

function onTestStreet(x: number, z: number) {
  return z > TEST_ROUTE_MIN_Z && z < TEST_ROUTE_MAX_Z && TEST_STREET_XS.some((streetX) => Math.abs(x - streetX) < 7)
}

function poleXClearOfTestStreets(x: number) {
  const streetX = TEST_STREET_XS.find((street) => Math.abs(x - street) <= 12)
  return streetX === undefined ? x : streetX - 12
}

function Road({ x, z, w, d, dashAlong }: { x: number; z: number; w: number; d: number; dashAlong: 'x' | 'z' }) {
  const dashes = useMemo(() => {
    const out: [number, number][] = []
    const len = dashAlong === 'x' ? w : d
    for (let t = -len / 2 + 2; t < len / 2; t += 6) out.push(dashAlong === 'x' ? [x + t, z] : [x, z + t])
    return out
  }, [x, z, w, d, dashAlong])
  const dashGeo = useMemo(() => new THREE.PlaneGeometry(dashAlong === 'x' ? 3 : 0.25, dashAlong === 'x' ? 0.25 : 3), [dashAlong])
  return (
    <group>
      <mesh material={MAT.road} position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      <instancedMesh
        args={[dashGeo, MAT.lane, dashes.length]}
        ref={(m) => {
          if (!m) return
          const mx = new THREE.Matrix4()
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
          dashes.forEach(([dx, dz], i) => {
            mx.compose(new THREE.Vector3(dx, 0.03, dz), q, new THREE.Vector3(1, 1, 1))
            m.setMatrixAt(i, mx)
          })
          m.instanceMatrix.needsUpdate = true
        }}
      />
    </group>
  )
}

function makeCityGroundGeometry() {
  const groundColor = new THREE.Color('#e6e9f5')
  const apronColor = new THREE.Color('#b8c0c7')
  const waterColor = new THREE.Color('#387f88')
  const xStops = [-WORLD_HALF * 3, 390, 550, 910]
  const zStops = [-1900, -625, -620, 40, 55, 120, 1100]
  const positions: number[] = []
  const colors: number[] = []

  for (let xi = 0; xi < xStops.length - 1; xi++) {
    for (let zi = 0; zi < zStops.length - 1; zi++) {
      const x0 = xStops[xi], x1 = xStops[xi + 1]
      const z0 = zStops[zi], z1 = zStops[zi + 1]
      const inPortBand = z0 >= -625 && z1 <= 120
      const color = x0 >= 550 && inPortBand
        ? waterColor
        : x0 >= 390 && x1 <= 550 && z0 >= -620 && z1 <= 120
          ? apronColor
          : groundColor
      const corners: [number, number, number][] = [
        [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1],
      ]
      for (const index of [0, 2, 1, 0, 3, 2]) {
        positions.push(...corners[index])
        colors.push(color.r, color.g, color.b)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function HarborBarge({ offsetZ }: { offsetZ: number }) {
  const materials = useLoader(MTLLoader, '/assets/port/RiverBargeAmar.mtl')
  const source = useLoader(OBJLoader, '/assets/port/RiverBargeAmar.obj', (loader) => loader.setMaterials(materials))
  const model = useMemo(() => source.clone(true), [source])
  const select = useUI((state) => state.select)
  return (
    <group
      position={[556, 0.1, offsetZ - 66]}
      scale={0.9}
      onClick={(event) => { event.stopPropagation(); select({ type: 'ship', id: `POLA-BARGE-${offsetZ}` }) }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      <primitive object={model} />
      {/* Add visible cargo to the existing barge model, sized to its narrow deck. */}
      {Array.from({ length: 6 }, (_, i) => <ShippingContainer
        key={i}
        color={['#c83f32', '#315d9b', '#d79b35'][i % 3]}
        label={`B${i + 1}`}
        position={[3.2 + (i % 2) * 3.1, 2.1, -12 + Math.floor(i / 2) * 12]}
        rotation={Math.PI / 2}
        scale={0.94}
      />)}
    </group>
  )
}

function QuayCrane({ z }: { z: number }) {
  const steel = std({ color: '#d04a35', metalness: 0.35, roughness: 0.55 })
  const dark = std({ color: '#363e4d', metalness: 0.45, roughness: 0.5 })
  return (
    <group position={[518, 0, z]}>
      <mesh material={steel} position={[-12, 7, 0]} castShadow><boxGeometry args={[1.5, 14, 2]} /></mesh>
      <mesh material={steel} position={[12, 7, 0]} castShadow><boxGeometry args={[1.5, 14, 2]} /></mesh>
      <mesh material={steel} position={[0, 14.5, 0]} castShadow><boxGeometry args={[28, 1.6, 2]} /></mesh>
      <mesh material={steel} position={[46, 16, 0]} castShadow><boxGeometry args={[72, 1.1, 1.5]} /></mesh>
      <mesh material={dark} position={[75, 10, 0]}><boxGeometry args={[0.35, 11, 0.35]} /></mesh>
      <mesh material={dark} position={[75, 4.4, 0]}><boxGeometry args={[5, 0.6, 2.2]} /></mesh>
      <mesh material={dark} position={[0, 1, -1.2]}><boxGeometry args={[32, 0.7, 4.8]} /></mesh>
    </group>
  )
}

function HarborMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh material={darkQuayMetal} position={[0, 0.35, 0]}>
        <cylinderGeometry args={[1.1, 1.5, 0.7, 12]} />
      </mesh>
      <mesh material={regionBorderMat} position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 1.7, 10]} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.4, 12, 8]} />
        <meshStandardMaterial color="#fff3cb" emissive="#ffd56a" emissiveIntensity={1.8} />
      </mesh>
    </group>
  )
}

const PORT_SECTIONS = [PORT_1_OFFSET_Z, PORT_2_OFFSET_Z, PORT_MAIN_OFFSET_Z]

function YardGantry({ x, z }: { x: number; z: number }) {
  const frame = std({ color: '#e0a22e', metalness: 0.22, roughness: 0.62 })
  const wheel = darkQuayMetal
  return (
    <group position={[x, 0, z]}>
      <mesh material={frame} position={[0, 9.2, 0]} castShadow><boxGeometry args={[82, 1.2, 1.4]} /></mesh>
      {[-40, 40].map((side) => <group key={side} position={[side, 0, 0]}>
        <mesh material={frame} position={[0, 4.5, 0]} castShadow><boxGeometry args={[1.3, 9, 1.3]} /></mesh>
        {[-2.1, 2.1].map((wheelSide) => <mesh key={wheelSide} material={wheel} position={[0, 0.7, wheelSide]}><cylinderGeometry args={[0.65, 0.65, 1.1, 10]} /></mesh>)}
      </group>)}
      <mesh material={frame} position={[12, 8.35, 0]}><boxGeometry args={[0.6, 0.6, 0.6]} /></mesh>
      <mesh material={wheel} position={[12, 5.2, 0]}><boxGeometry args={[0.35, 5.7, 0.35]} /></mesh>
      <mesh material={frame} position={[12, 2.2, 0]}><boxGeometry args={[10, 0.45, 3.4]} /></mesh>
    </group>
  )
}

function TerminalGate({ z }: { z: number }) {
  const canopy = std({ color: '#5145bd', roughness: 0.7 })
  const white = std({ color: '#eef0f6', roughness: 0.72 })
  const safety = std({ color: '#e2aa31', roughness: 0.65 })
  return (
    <group position={[0, 0, z]}>
      <Road x={431} z={0} w={86} d={17} dashAlong="x" />
      <mesh material={canopy} position={[431, 6, 0]} castShadow><boxGeometry args={[68, 1, 15]} /></mesh>
      {[399, 417, 435, 453, 471].map((x) => <group key={x} position={[x, 0, 0]}>
        <mesh material={white} position={[0, 2.2, 0]} castShadow><boxGeometry args={[5, 4.4, 5]} /></mesh>
        <mesh material={canopy} position={[0, 4.6, 0]}><boxGeometry args={[5.5, 0.45, 5.5]} /></mesh>
        <mesh material={safety} position={[5, 0.9, 0]} rotation={[0, 0, 0.05]}><boxGeometry args={[5.5, 0.18, 0.2]} /></mesh>
      </group>)}
      {[390, 481].map((x) => <mesh key={x} material={frameMaterial} position={[x, 4.1, 0]} castShadow><boxGeometry args={[0.7, 8.2, 0.7]} /></mesh>)}
    </group>
  )
}

const frameMaterial = std({ color: '#465064', metalness: 0.35, roughness: 0.62 })

function PortSupportBuilding({ x, z, label, width = 24 }: { x: number; z: number; label: string; width?: number }) {
  const wall = std({ color: '#d9dce5', roughness: 0.82 })
  const roof = std({ color: '#5145bd', roughness: 0.7 })
  const glass = std({ color: '#9dc8d5', roughness: 0.3, metalness: 0.12 })
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signText(label, '#4338a8', '#ffffff'), roughness: 0.65 }), [label])
  return (
    <group position={[x, 0, z]}>
      <mesh material={wall} position={[0, 3.5, 0]} castShadow receiveShadow><boxGeometry args={[width, 7, 13]} /></mesh>
      <mesh material={roof} position={[0, 7.15, 0]} castShadow><boxGeometry args={[width + 0.8, 0.4, 13.8]} /></mesh>
      {[-width * 0.3, 0, width * 0.3].map((wx) => <mesh key={wx} material={glass} position={[wx, 3.7, 6.58]}><boxGeometry args={[3.4, 2.5, 0.12]} /></mesh>)}
      <mesh material={sign} position={[0, 5.7, 6.65]}><planeGeometry args={[width * 0.65, 1.4]} /></mesh>
      <mesh material={frameMaterial} position={[-width / 2 - 1, 0.8, 0]}><boxGeometry args={[1, 1.6, 1]} /></mesh>
      <mesh material={frameMaterial} position={[width / 2 + 1, 0.8, 0]}><boxGeometry args={[1, 1.6, 1]} /></mesh>
    </group>
  )
}

function HarborTug({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  const hull = std({ color: '#29394f', roughness: 0.5, metalness: 0.2 })
  const cabin = std({ color: '#e9edf4', roughness: 0.55 })
  const red = std({ color: '#c83f32', roughness: 0.62 })
  const glass = std({ color: '#8fc4d3', roughness: 0.25 })
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]} scale={0.85}>
      <mesh material={hull} position={[0, 1.7, 0]} castShadow><boxGeometry args={[8, 3.4, 22]} /></mesh>
      <mesh material={red} position={[0, 0.45, 0]}><boxGeometry args={[8.2, 0.8, 21]} /></mesh>
      <mesh material={cabin} position={[0, 4.7, -4]} castShadow><boxGeometry args={[5.4, 3.2, 7]} /></mesh>
      <mesh material={glass} position={[0, 4.9, -0.42]}><boxGeometry args={[4.4, 1.8, 0.12]} /></mesh>
      <mesh material={cabin} position={[0, 7, -4]}><boxGeometry args={[2.2, 1.4, 2.5]} /></mesh>
    </group>
  )
}

function ContainerShip() {
  const hull = std({ color: '#27364c', metalness: 0.18, roughness: 0.58 })
  const waterline = std({ color: '#c83f32', roughness: 0.62 })
  const deck = std({ color: '#7d8792', roughness: 0.8 })
  const stacks = useMemo(() => Array.from({ length: 5 * 10 }, (_, index) => {
    const row = Math.floor(index / 10)
    const col = index % 10
    return { index, x: -6 + row * 3, z: -38 + col * 10.8, height: col % 3 === 0 ? 3 : 2 }
  }), [])
  const hullGeometry = useMemo(() => {
    // Cross sections taper only at the bow and stern, leaving a broad cargo deck.
    // A single closed hull avoids the intersecting box/cone surfaces that caused flicker.
    const stations = [
      { z: -71, width: 0 }, { z: -65, width: 8.5 }, { z: -58, width: 10 },
      { z: 56, width: 10 }, { z: 66, width: 8.5 }, { z: 71, width: 0 },
    ]
    const profile: [number, number][] = [
      [-0.72, 0.72], [-1, 1.15], [-1, 4.45], [-0.82, 5.05],
      [0.82, 5.05], [1, 4.45], [1, 1.15], [0.72, 0.72],
    ]
    const positions: number[] = []
    const indices: number[] = []
    for (const station of stations) {
      for (const [widthFactor, y] of profile) positions.push(station.width * widthFactor, y, station.z)
    }
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
  }, [])
  const select = useUI((state) => state.select)
  return (
    <group
      position={[590, 0, PORT_MAIN_OFFSET_Z - 70]}
      scale={0.9}
      onClick={(event) => { event.stopPropagation(); select({ type: 'ship', id: 'POLA-CARGO-01' }) }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      <mesh geometry={hullGeometry} material={hull} castShadow receiveShadow />
      {/* The red band sits below the hull with a visible seam; it does not cut through it. */}
      <mesh material={waterline} position={[0, 0.47, 0]}><boxGeometry args={[15.2, 0.26, 124]} /></mesh>
      {/* Deck is slightly above the hull cap to prevent coplanar flicker. */}
      <mesh material={deck} position={[0, 5.09, 0]}><boxGeometry args={[16.2, 0.06, 124]} /></mesh>
      <mesh material={cabinShipMat} position={[0, 9.65, -54]} castShadow><boxGeometry args={[13.5, 8.5, 15]} /></mesh>
      <mesh material={shipGlassMat} position={[0, 10.1, -46.4]}><boxGeometry args={[9, 3.6, 0.14]} /></mesh>
      {stacks.map(({ index, x, z, height }) => Array.from({ length: height }, (_, level) => (
        <ShippingContainer key={`${index}-${level}`} color={['#c83f32', '#d79b35', '#315d9b', '#e2e3df', '#268477'][index % 5]} label={`V${String(index + 1).padStart(2, '0')}`} position={[x, 5.2 + level * 2.38, z]} rotation={Math.PI / 2} scale={0.88} />
      )))}
    </group>
  )
}

const cabinShipMat = std({ color: '#f0f2f6', roughness: 0.62 })
const shipGlassMat = std({ color: '#88bbc9', roughness: 0.3 })

function PortDistrict() {
  const quay = useMemo(() => std({ color: '#929ba5', roughness: 0.9 }), [])
  const containers = useMemo(() => {
    const colors = ['#c83f32', '#d79b35', '#315d9b', '#e2e3df', '#268477']
    return PORT_SECTIONS.slice(0, 2).flatMap((offsetZ, section) => Array.from({ length: 48 }, (_, i) => ({
      section,
      id: i,
      color: colors[(i + section * 2) % colors.length],
      label: `T${section + 1}-${String(i + 1).padStart(2, '0')}`,
      x: 400 + (i % 6) * 13,
      z: offsetZ - 12 - Math.floor(i / 6) * 8.5,
    })))
  }, [])
  const cranes = [-5, -75, -145, -225, -295, -365, -445, -515, -585]
  return (
    <group>
      {/* One full-size continuous quay spans the three terminal sections. */}
      <mesh material={quay} position={[550, 1, -290]} castShadow receiveShadow>
        <boxGeometry args={[5, 2, 666]} />
      </mesh>
      {/* The generated ground already supplies the concrete apron here. Avoid a second,
          raised slab under roads and assets, which produced visible z-fighting. */}
      {/* Three-deep container terminal storage, stacked three high. */}
      {containers.flatMap((container) => Array.from({ length: 3 }, (_, level) => (
        <ShippingContainer key={`${container.section}-${container.id}-${level}`} color={container.color} label={container.label} position={[container.x, 0.03 + level * 2.16, container.z]} scale={0.82} />
      )))}
      {PORT_SECTIONS.map((offsetZ, section) => (
        <group key={`terminal-kit-${section}`}>
          {/* Truck lanes and staging use the same marked-road pieces as the city. */}
          {section < 2
            ? <Road x={485} z={offsetZ - 49} w={12} d={94} dashAlong="z" />
            : <Road x={465} z={offsetZ - 68} w={10} d={76} dashAlong="z" />}
          <Road x={431} z={offsetZ - 82} w={12} d={36} dashAlong="z" />
          <Road x={404} z={offsetZ - 70} w={56} d={10} dashAlong="x" />
          {section < 2
            ? <Road x={459} z={offsetZ - 82} w={54} d={8} dashAlong="x" />
            : <Road x={449} z={offsetZ - 82} w={34} d={8} dashAlong="x" />}
          <TerminalGate z={offsetZ - 99} />
          <PortSupportBuilding x={404} z={offsetZ + 1} label="TERMINAL OFFICE" width={20} />
          <PortSupportBuilding x={479} z={offsetZ + 16} label="REEFER SERVICE" width={17} />
          <PortSupportBuilding x={402} z={offsetZ - 119} label="MAINTENANCE" width={19} />
          {section < 2 ? (
            <>
              {[offsetZ - 34, offsetZ - 69].map((z) => <YardGantry key={`gantry-${z}`} x={433} z={z} />)}
              {/* Reefer service points beside refrigerated container rows. */}
              {Array.from({ length: 8 }, (_, i) => <mesh key={`reefer-${i}`} material={reeferLightMat} position={[472, 1.9, offsetZ - 15 - i * 7]}><boxGeometry args={[0.35, 0.5, 0.35]} /></mesh>)}
            </>
          ) : (
            <group>
              {/* Open loading apron: loose containers wait beside the ship berth. */}
              <mesh material={quay} position={[495, 0.08, offsetZ - 68]} receiveShadow><boxGeometry args={[40, 0.16, 76]} /></mesh>
              {Array.from({ length: 18 }, (_, i) => <ShippingContainer
                key={`pickup-${i}`}
                color={['#c83f32', '#d79b35', '#315d9b', '#268477'][i % 4]}
                label={`LOAD-${String(i + 1).padStart(2, '0')}`}
                position={[482 + (i % 3) * 13, 0.16, offsetZ - 24 - Math.floor(i / 3) * 11]}
                scale={0.9}
              />)}
            </group>
          )}
        </group>
      ))}
      <ContainerShip />
      <HarborTug x={576} z={PORT_MAIN_OFFSET_Z + 12} rotation={Math.PI / 2} />
      <HarborTug x={578} z={PORT_MAIN_OFFSET_Z - 144} rotation={Math.PI / 2} />
      {cranes.map((z) => <QuayCrane key={z} z={z} />)}
      {PORT_SECTIONS.map((offsetZ) => <HarborBarge key={offsetZ} offsetZ={offsetZ} />)}
      {/* 36 bollards serve the longer quay. */}
      {Array.from({ length: 36 }, (_, i) => (
        <mesh key={i} material={darkQuayMetal} position={[546, 0.65, -610 + i * 18]}>
          <cylinderGeometry args={[0.42, 0.42, 1.3, 12]} />
        </mesh>
      ))}
    </group>
  )
}

const reeferLightMat = new THREE.MeshStandardMaterial({ color: '#b6f0e8', emissive: '#4cddd0', emissiveIntensity: 0.8, roughness: 0.42 })

const darkQuayMetal = new THREE.MeshStandardMaterial({ color: '#343d49', metalness: 0.6, roughness: 0.45 })
const regionBorderMat = new THREE.MeshStandardMaterial({ color: '#e32636', emissive: '#4a080d', emissiveIntensity: 0.25, roughness: 0.75 })

const poleMat = std({ color: '#465064', metalness: 0.55, roughness: 0.45 })
const lampMat = new THREE.MeshStandardMaterial({
  color: '#fff1c2', emissive: '#ffd36b', emissiveIntensity: 2.2, roughness: 0.35,
})
const streetSigns = new Map<string, THREE.CanvasTexture>()

function streetSignTexture(label: string) {
  const existing = streetSigns.get(label)
  if (existing) return existing
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#343d55'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#f5f7ff'
  ctx.lineWidth = 8
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 48px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  streetSigns.set(label, texture)
  return texture
}

function RoadsidePole({ x, z, name }: { x: number; z: number; name: string }) {
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: streetSignTexture(name), roughness: 0.7 }), [name])
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const night = 1 - daylightAmount(getDayNightSeconds())
    lampMat.emissiveIntensity = night * 2.2
    if (light.current) light.current.intensity = night * 2.4
  })
  return (
    <group position={[x, 0, z]}>
      <mesh material={poleMat} position={[0, 4.1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 8.2, 10]} />
      </mesh>
      <mesh material={poleMat} position={[1.5, 7.9, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[3.1, 0.13, 0.13]} />
      </mesh>
      <mesh material={lampMat} position={[2.9, 7.65, 0]}>
        <boxGeometry args={[0.85, 0.2, 0.5]} />
      </mesh>
      <pointLight ref={light} position={[2.9, 7.2, 0]} color="#ffe5a3" intensity={2.4} distance={30} decay={2} />
      <mesh position={[-0.65, 6.6, 0]}>
        <boxGeometry args={[5.8, 1.55, 0.18]} />
        <meshStandardMaterial color="#20263a" roughness={0.65} />
      </mesh>
      <mesh material={sign} position={[-0.65, 6.6, 0.11]}>
        <planeGeometry args={[5.55, 1.35]} />
      </mesh>
    </group>
  )
}

function CityBlock({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const buildings = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; c: string }[] = []
    // Seed by the block's east-west footprint so the matching block in B gets
    // the same building arrangement while remaining a separate mesh instance.
    let seed = (Math.abs(Math.round((x + 500) * 17 + w * 31 + d * 47)) % 2147483646) + 1
    const blockRnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const cols = Math.max(1, Math.floor(w / 18))
    const rows = Math.max(1, Math.floor(d / 18))
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (blockRnd() < 0.18) continue
        const bw = 9 + blockRnd() * 6
        const bd = 9 + blockRnd() * 6
        out.push({
          x: x - w / 2 + (i + 0.5) * (w / cols),
          z: z - d / 2 + (j + 0.5) * (d / rows),
          w: bw,
          d: bd,
          h: 4 + blockRnd() * 10,
          c: blockRnd() < 0.5 ? '#f3f4f9' : '#e9edf7',
        })
      }
    return out
  }, [x, z, w, d])
  return (
    <group>
      <mesh material={MAT.sidewalk} position={[x, 0.08, z]} receiveShadow>
        <boxGeometry args={[w + 2, 0.16, d + 2]} />
      </mesh>
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
    </group>
  )
}

const winMats = new Map<string, THREE.MeshStandardMaterial>()
function Building({ x, z, w, d, h, c }: { x: number; z: number; w: number; d: number; h: number; c: string }) {
  const m = useMemo(() => {
    const key = `${c}-${Math.round(w)}-${Math.round(h)}`
    if (!winMats.has(key)) {
      const t = windows(c).clone()
      t.needsUpdate = true
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(w / 6, h / 6)
      winMats.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }))
    }
    return winMats.get(key)!
  }, [c, w, h])
  const roof = useMemo(() => std({ color: c }), [c])
  return (
    <mesh material={[m, m, roof, roof, m, m]} position={[x, h / 2 + 0.16, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  )
}

// Keep sidewalks and buildings clear of the north/south Pier Street corridor.
function overlapsPierStreet(b: { x: number; z: number; w: number; d: number }) {
  const overlapsX = TEST_STREET_XS.some((streetX) => Math.abs(b.x - streetX) < b.w / 2 + 1 + 6)
  const overlapsZ = b.z + b.d / 2 + 1 > TEST_ROUTE_MIN_Z && b.z - b.d / 2 - 1 < TEST_ROUTE_MAX_Z
  return overlapsX && overlapsZ
}

export function World() {
  const layers = useUI((state) => state.layers)
  const groundGeometry = useMemo(makeCityGroundGeometry, [])
  const groundMaterial = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), [])
  const region = { minX: -340, maxX: 910, minZ: -625, maxZ: 120 }
  const regionWidth = region.maxX - region.minX
  const regionDepth = region.maxZ - region.minZ
  const regionCenterX = (region.minX + region.maxX) / 2
  const regionCenterZ = (region.minZ + region.maxZ) / 2
  // District B is a separate scene instance of the same city block kit, shifted
  // north of the warehouse back row. Its meshes and lights are mounted anew.
  const districtBOffsetZ = CITY_B_OFFSET_Z
  const trees = useMemo(() => {
    const pts: [number, number, number][] = []
    // street trees south of highway
    for (let x = -WORLD_HALF; x < WORLD_HALF; x += 9 + rnd() * 6) pts.push([x, ROAD_HALF + 3 + rnd(), 0.8 + rnd() * 0.4])
    // around each warehouse
    for (const w of WAREHOUSES) {
      const half = yardHalfWidth(w) + 4
      for (let z = -10; z > -75; z -= 7 + rnd() * 5) {
        pts.push([w.cx - half - 1 - rnd() * 3, z + w.zOffset, 0.8 + rnd() * 0.5])
        pts.push([w.cx + half + 1 + rnd() * 3, z + w.zOffset, 0.8 + rnd() * 0.5])
      }
      for (let x = w.cx - half; x < w.cx + half; x += 8 + rnd() * 6) pts.push([x, buildingCenterZ + w.zOffset - 28 - rnd() * 4, 0.9 + rnd() * 0.5])
    }
    // park clusters
    for (let i = 0; i < 70; i++) pts.push([-WORLD_HALF + rnd() * WORLD_HALF * 2, 30 + rnd() * 90, 0.7 + rnd() * 0.6])
    return pts
  }, [])

  const blocks = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = []
    for (let bx = -WORLD_HALF + 30; bx < WORLD_HALF; bx += 60)
      for (const bz of [32, 92]) if (rnd() > 0.25) out.push({ x: bx, z: bz, w: 44, d: 40 })
    // back row north of warehouses
    for (let bx = -WORLD_HALF + 30; bx < WORLD_HALF; bx += 60) if (rnd() > 0.4) out.push({ x: bx, z: -110, w: 40, d: 26 })
    return out
  }, [])
  const clearTrees = useMemo(
    () => trees.filter(([x, z]) => !onTestStreet(x, z) && !onTestStreet(x, z + districtBOffsetZ)),
    [trees, districtBOffsetZ],
  )
  const districtBTrees = useMemo(
    () => clearTrees.filter(([, z]) => (z >= 30 && z < 130) || (z >= 6 && z < 10)).map(([x, z, scale]) => [x, z + districtBOffsetZ, scale] as [number, number, number]),
    [clearTrees, districtBOffsetZ],
  )
  const districtCTrees = useMemo(
    () => clearTrees.filter(([, z]) => (z >= 30 && z < 130) || (z >= 6 && z < 10)).map(([x, z, scale]) => [x, z + CITY_C_OFFSET_Z, scale] as [number, number, number]),
    [clearTrees],
  )

  return (
    <group>
      <mesh geometry={groundGeometry} material={groundMaterial} receiveShadow />
      <group visible={layers.city}>
      {/* Red perimeter stays at the original rectangular bounds. */}
      <mesh material={regionBorderMat} position={[regionCenterX, 0.3, region.minZ]}>
        <boxGeometry args={[regionWidth, 0.6, 2]} />
      </mesh>
      <mesh material={regionBorderMat} position={[regionCenterX, 0.3, region.maxZ]}>
        <boxGeometry args={[regionWidth, 0.6, 2]} />
      </mesh>
      <mesh material={regionBorderMat} position={[region.minX, 0.3, regionCenterZ]}>
        <boxGeometry args={[2, 0.6, regionDepth]} />
      </mesh>
      <mesh material={regionBorderMat} position={[region.maxX, 0.3, regionCenterZ]}>
        <boxGeometry args={[2, 0.6, regionDepth]} />
      </mesh>
      {/* highway with sidewalks */}
      <Road x={0} z={0} w={WORLD_HALF * 2 + 80} d={ROAD_HALF * 2} dashAlong="x" />
      {[
        { x: -260, name: 'HARBOR AVENUE' },
        { x: -160, name: 'TERMINAL WAY' },
        { x: -50, name: 'PIER STREET' },
        { x: 40, name: 'CHANNEL ROAD' },
        { x: 140, name: 'DEPOT STREET' },
        { x: 250, name: 'PORT BOULEVARD' },
      ].map((pole) => (
        <RoadsidePole key={pole.name} x={poleXClearOfTestStreets(pole.x)} z={ROAD_HALF + 4} name={pole.name} />
      ))}
      <mesh material={MAT.sidewalk} position={[0, 0.06, ROAD_HALF + 1.2]} receiveShadow>
        <boxGeometry args={[WORLD_HALF * 2 + 80, 0.12, 2.4]} />
      </mesh>
      {/* cross streets */}
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Road key={x} x={x} z={-60} w={9} d={108} dashAlong="z" />
      ))}
      {[-150, -50, 50, 150, 250, -250].map((x) => (
        <Road key={`s${x}`} x={x} z={62} w={9} d={100} dashAlong="z" />
      ))}
      <Road x={0} z={62} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      <Road x={0} z={-118} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      {blocks.filter((b) => !overlapsPierStreet(b)).map((b, i) => (
        <CityBlock key={i} {...b} />
      ))}
      {/* City B: independent copies of district A's roads, blocks, signs, and park trees. */}
      <Road x={0} z={districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={ROAD_HALF * 2} dashAlong="x" />
      {/* Shared arterial links every district, including the port, into one road network. */}
      <Road x={320} z={PORT_MAIN_OFFSET_Z / 2} w={9} d={Math.abs(PORT_MAIN_OFFSET_Z) + 12} dashAlong="z" />
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Road key={`b-n-${x}`} x={x} z={-60 + districtBOffsetZ} w={9} d={108} dashAlong="z" />
      ))}
      {[-150, 50].map((x) => (
        <Road key={`intercity-${x}`} x={x} z={districtBOffsetZ / 2 - 60} w={9} d={116} dashAlong="z" />
      ))}
      {/* Pier Street continues through the gap so the test truck can drive between districts. */}
      <Road x={-50} z={districtBOffsetZ / 2 - 60} w={9} d={116} dashAlong="z" />
      {[-150, -50, 50, 150, 250, -250].map((x) => (
        <Road key={`b-s-${x}`} x={x} z={62 + districtBOffsetZ} w={9} d={100} dashAlong="z" />
      ))}
      <Road x={0} z={62 + districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      <Road x={0} z={-118 + districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      {blocks.filter((b) => !overlapsPierStreet({ ...b, z: b.z + districtBOffsetZ })).map((b, i) => (
        <CityBlock key={`b-${i}`} {...b} z={b.z + districtBOffsetZ} />
      ))}
      <mesh material={MAT.sidewalk} position={[0, 0.06, ROAD_HALF + 1.2 + districtBOffsetZ]} receiveShadow>
        <boxGeometry args={[WORLD_HALF * 2 + 80, 0.12, 2.4]} />
      </mesh>
      <Trees points={districtBTrees} />
      {[
        { x: -260, name: 'HARBOR AVENUE' },
        { x: -160, name: 'TERMINAL WAY' },
        { x: -50, name: 'PIER STREET' },
        { x: 40, name: 'CHANNEL ROAD' },
        { x: 140, name: 'DEPOT STREET' },
        { x: 250, name: 'PORT BOULEVARD' },
      ].map((pole) => (
        <RoadsidePole key={`b-${pole.name}`} x={poleXClearOfTestStreets(pole.x)} z={districtBOffsetZ + ROAD_HALF + 4} name={pole.name} />
      ))}
      {/* City C remains a regular independent city district. */}
      <Road x={0} z={CITY_C_OFFSET_Z} w={WORLD_HALF * 2 + 80} d={ROAD_HALF * 2} dashAlong="x" />
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Road key={`c-n-${x}`} x={x} z={CITY_C_OFFSET_Z - 60} w={9} d={108} dashAlong="z" />
      ))}
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Road key={`c-s-${x}`} x={x} z={CITY_C_OFFSET_Z + 62} w={9} d={100} dashAlong="z" />
      ))}
      <Road x={0} z={CITY_C_OFFSET_Z + 62} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      <Road x={0} z={CITY_C_OFFSET_Z - 118} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      {blocks.map((b, i) => <CityBlock key={`c-${i}`} {...b} z={b.z + CITY_C_OFFSET_Z} />)}
      <mesh material={MAT.sidewalk} position={[0, 0.06, ROAD_HALF + 1.2 + CITY_C_OFFSET_Z]} receiveShadow>
        <boxGeometry args={[WORLD_HALF * 2 + 80, 0.12, 2.4]} />
      </mesh>
      {[
        { x: -260, name: 'HARBOR AVENUE' },
        { x: -160, name: 'TERMINAL WAY' },
        { x: -50, name: 'PIER STREET' },
        { x: 40, name: 'CHANNEL ROAD' },
        { x: 140, name: 'DEPOT STREET' },
        { x: 250, name: 'PORT BOULEVARD' },
      ].map((pole) => (
        <RoadsidePole key={`c-${pole.name}`} x={poleXClearOfTestStreets(pole.x)} z={CITY_C_OFFSET_Z + ROAD_HALF + 4} name={pole.name} />
      ))}
      <Trees points={districtCTrees} />
      {[
        { offsetZ: PORT_1_OFFSET_Z, id: 'port-1', parent: 'City A' },
        { offsetZ: PORT_2_OFFSET_Z, id: 'port-2', parent: 'City B' },
        { offsetZ: PORT_MAIN_OFFSET_Z, id: 'port-main', parent: 'City C' },
      ].map(({ offsetZ, id, parent }) => (
        <group key={id}>
          {/* Each port is aligned and road-connected with its parent city. */}
          <Road x={350} z={offsetZ} w={20} d={ROAD_HALF * 2} dashAlong="x" />
          {/* The port entrance branches directly from its city's road and the shared arterial. */}
          <Road x={360} z={offsetZ - 35} w={9} d={70} dashAlong="z" />
          <Road x={377.5} z={offsetZ - 70} w={35} d={9} dashAlong="x" />
          <RoadsidePole x={344} z={offsetZ + ROAD_HALF + 4} name={`${id.replace('port-', 'P')} · ${parent}`} />
        </group>
      ))}
      {/* One full-size port serves all three city frontages. */}
      </group>
      <group visible={layers.port}>
        <PortDistrict />
        {[610, 680, 750, 820, 890].map((x) => <HarborMarker key={x} x={x} z={90} />)}
      </group>
      <group visible={layers.city}>
      {/* parking/truck lots between warehouses */}
      {WAREHOUSES.slice(0, -1).map((w) => {
        const lotCenter = w.cx + 50
        const crossing = TEST_STREET_XS.find((street) => Math.abs(lotCenter - street) < 10)
        const x = crossing === undefined ? lotCenter : lotCenter + 20
        const z = w.zOffset - 82
        return (
          <group key={w.id}>
            <mesh material={MAT.lot} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[20, 30]} />
            </mesh>
            <ShippingContainer color="#24a1a6" label="OCEANIC" position={[x - 4, 0, z + 6]} rotation={Math.PI / 2} />
            <ShippingContainer color="#f08a0b" label="CARGOVIVA" position={[x, 0, z + 4]} rotation={Math.PI / 2} />
            <ShippingContainer color="#2f6bed" label="BLUELINE" position={[x + 4, 0, z + 2]} rotation={Math.PI / 2} />
          </group>
        )
      })}
      <Trees points={clearTrees} />
      </group>
    </group>
  )
}
