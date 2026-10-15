import { useMemo } from 'react'
import * as THREE from 'three'
import { CITY_B_OFFSET_Z, ROAD_HALF, WORLD_HALF, WAREHOUSES, yardHalfWidth, buildingCenterZ } from '../sim/world'
import { Trees, ShippingContainer } from './Props'
import { windows } from './textures'

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...p })
const MAT = {
  ground: std({ color: '#e6e9f5' }),
  road: std({ color: '#cdd2e2' }),
  sidewalk: std({ color: '#f7f8fc' }),
  lane: std({ color: '#ffffff' }),
  park: std({ color: '#dbeedd' }),
  lot: std({ color: '#eceef6' }),
}

let s = 11
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646

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
      <pointLight position={[2.9, 7.2, 0]} color="#ffe5a3" intensity={2.4} distance={30} decay={2} />
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

export function World() {
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
  const districtBTrees = useMemo(
    () => trees.filter(([, z]) => (z >= 30 && z < 130) || (z >= 6 && z < 10)).map(([x, z, scale]) => [x, z + districtBOffsetZ, scale] as [number, number, number]),
    [trees],
  )

  return (
    <group>
      <mesh material={MAT.ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_HALF * 4, WORLD_HALF * 4]} />
      </mesh>
      {/* highway with sidewalks */}
      <Road x={0} z={0} w={WORLD_HALF * 2 + 80} d={ROAD_HALF * 2} dashAlong="x" />
      {[
        { x: -260, name: 'HARBOR AVENUE' },
        { x: -160, name: 'TERMINAL WAY' },
        { x: -60, name: 'PIER STREET' },
        { x: 40, name: 'CHANNEL ROAD' },
        { x: 140, name: 'DEPOT STREET' },
        { x: 250, name: 'PORT BOULEVARD' },
      ].map((pole) => (
        <RoadsidePole key={pole.name} x={pole.x} z={ROAD_HALF + 4} name={pole.name} />
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
      {blocks.map((b, i) => (
        <CityBlock key={i} {...b} />
      ))}
      {/* City B: independent copies of district A's roads, blocks, signs, and park trees. */}
      <Road x={0} z={districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={ROAD_HALF * 2} dashAlong="x" />
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Road key={`b-n-${x}`} x={x} z={-60 + districtBOffsetZ} w={9} d={108} dashAlong="z" />
      ))}
      {[-150, -50, 50, 150, 250, -250].map((x) => (
        <Road key={`b-s-${x}`} x={x} z={62 + districtBOffsetZ} w={9} d={100} dashAlong="z" />
      ))}
      <Road x={0} z={62 + districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      <Road x={0} z={-118 + districtBOffsetZ} w={WORLD_HALF * 2 + 80} d={9} dashAlong="x" />
      {blocks.map((b, i) => (
        <CityBlock key={`b-${i}`} {...b} z={b.z + districtBOffsetZ} />
      ))}
      <mesh material={MAT.sidewalk} position={[0, 0.06, ROAD_HALF + 1.2 + districtBOffsetZ]} receiveShadow>
        <boxGeometry args={[WORLD_HALF * 2 + 80, 0.12, 2.4]} />
      </mesh>
      <Trees points={districtBTrees} />
      {[
        { x: -260, name: 'HARBOR AVENUE' },
        { x: -160, name: 'TERMINAL WAY' },
        { x: -60, name: 'PIER STREET' },
        { x: 40, name: 'CHANNEL ROAD' },
        { x: 140, name: 'DEPOT STREET' },
        { x: 250, name: 'PORT BOULEVARD' },
      ].map((pole) => (
        <RoadsidePole key={`b-${pole.name}`} x={pole.x} z={districtBOffsetZ + ROAD_HALF + 4} name={pole.name} />
      ))}
      {/* parking/truck lots between warehouses */}
      {WAREHOUSES.slice(0, -1).map((w) => {
        const x = w.cx + 50
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
      <Trees points={trees} />
    </group>
  )
}
