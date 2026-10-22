import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Warehouse } from '../sim/sim'
import { sim } from '../sim/sim'
import {
  BUILDING_DEPTH, DOCK_REAR_Z, FRONT_Z, SLOT_ROWS, SLOT_COLS, SLOT_STEP,
  buildingCenterZ, buildingWidth, dockX, slotStart, yardHalfWidth,
} from '../sim/world'
import { corrugated, roofLogo, signText, windows } from './textures'
import { SlotPallet, ShippingContainer, PalletModel } from './Props'
import { useUI } from '../store'

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...p })

const MAT = {
  concrete: std({ color: '#e3e6ef' }),
  plinth: std({ color: '#cfd4e1' }),
  frame: std({ color: '#4338a8' }),
  frameWhite: std({ color: '#5145bd' }),
  interior: std({ color: '#2b3452', roughness: 1 }),
  shutter: std({ color: '#d4d9e5' }),
  bumper: std({ color: '#262b38' }),
  canopy: std({ color: '#f6f7fb' }),
  roofBlue: std({ color: '#5145bd', roughness: 0.55 }),
  roofRidge: std({ color: '#f4f6fb' }),
  roofWhite: std({ color: '#e9ecf4' }),
  parapet: std({ color: '#f7f8fc' }),
  skylight: std({ color: '#b8cdf5', roughness: 0.3, metalness: 0.2 }),
  hvac: std({ color: '#c3c9d8' }),
  hvacDark: std({ color: '#8d95a8' }),
  yard: std({ color: '#f0f1f8', roughness: 0.95 }),
  yellow: std({ color: '#f3c74d', roughness: 0.9 }),
  fence: std({ color: '#aab2c5', roughness: 0.6 }),
}

function wallMaterial(style: Warehouse['style'], len: number, h: number) {
  const base =
    style === 'blue' ? corrugated('#5145bd', '#40369f', '#6c61d4') : corrugated('#665bd0', '#5146b6', '#8178e0')
  const tex = base.clone()
  tex.needsUpdate = true
  tex.repeat.set(len / 2.2, h / 8)
  return std({ map: tex, roughness: 0.6 })
}

function Dock({ w, i, h }: { w: Warehouse; i: number; h: number }) {
  const shutter = useRef<THREE.Mesh>(null)
  const x = dockX(w, i)
  const doorH = 4.4
  const sign = useMemo(() => std({ map: signText(`D${i + 1}`, '#1f3f9f', '#ffffff') }), [i])
  useFrame(() => {
    const open = w.dockState[i].open
    const m = shutter.current
    if (!m) return
    const k = Math.max(0.04, 1 - open)
    m.scale.y = k
    m.position.y = 1.1 + doorH - (doorH * k) / 2
  })
  return (
    <group position={[x, 0, FRONT_Z]}>
      <mesh material={MAT.interior} position={[0, 1.1 + doorH / 2, 0.02]}>
        <planeGeometry args={[3.6, doorH]} />
      </mesh>
      <mesh ref={shutter} material={MAT.shutter} position={[0, 1.1 + doorH / 2, 0.06]}>
        <boxGeometry args={[3.6, doorH, 0.06]} />
      </mesh>
      {/* frame */}
      <mesh material={w.style === 'blue' ? MAT.frame : MAT.frameWhite} position={[-1.95, 1.1 + doorH / 2, 0.12]} castShadow>
        <boxGeometry args={[0.3, doorH + 0.3, 0.24]} />
      </mesh>
      <mesh material={w.style === 'blue' ? MAT.frame : MAT.frameWhite} position={[1.95, 1.1 + doorH / 2, 0.12]} castShadow>
        <boxGeometry args={[0.3, doorH + 0.3, 0.24]} />
      </mesh>
      <mesh material={w.style === 'blue' ? MAT.frame : MAT.frameWhite} position={[0, 1.25 + doorH, 0.12]} castShadow>
        <boxGeometry args={[4.2, 0.3, 0.24]} />
      </mesh>
      {/* bumpers */}
      <mesh material={MAT.bumper} position={[-1.3, 0.75, 0.75]}>
        <boxGeometry args={[0.35, 0.5, 0.25]} />
      </mesh>
      <mesh material={MAT.bumper} position={[1.3, 0.75, 0.75]}>
        <boxGeometry args={[0.35, 0.5, 0.25]} />
      </mesh>
      {/* canopy */}
      <mesh material={MAT.canopy} position={[0, Math.min(h - 0.6, doorH + 2.1), 1.1]} castShadow>
        <boxGeometry args={[4.6, 0.18, 2.2]} />
      </mesh>
      <mesh material={sign} position={[0, Math.min(h - 0.6, doorH + 2.1) + 0.5, 0.05]}>
        <planeGeometry args={[1.3, 0.5]} />
      </mesh>
    </group>
  )
}

function GableRoof({ width, depth, rise }: { width: number; depth: number; rise: number }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    const d = depth / 2 + 0.7
    s.moveTo(-d, 0)
    s.lineTo(d, 0)
    s.lineTo(d, 0.25)
    s.lineTo(0, rise + 0.25)
    s.lineTo(-d, 0.25)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: width + 1.2, bevelEnabled: false })
    g.rotateY(Math.PI / 2)
    g.translate(-(width + 1.2) / 2, 0, 0)
    return g
  }, [width, depth, rise])
  return (
    <group>
      <mesh geometry={geo} material={MAT.roofBlue} castShadow receiveShadow />
      <mesh material={MAT.roofRidge} position={[0, rise + 0.3, 0]}>
        <boxGeometry args={[width + 1.3, 0.25, 0.7]} />
      </mesh>
    </group>
  )
}

export function WarehouseModel({ w }: { w: Warehouse }) {
  const W = buildingWidth(w)
  const D = BUILDING_DEPTH
  const H = w.style === 'blue' ? 8 : 9.5
  const cz = buildingCenterZ
  const setActive = useUI((s) => s.setActiveWh)
  const mats = useMemo(() => {
    const front = wallMaterial(w.style, W, H)
    const side = wallMaterial(w.style, D, H)
    const top = MAT.roofWhite
    return [side, side, top, top, front, front]
  }, [w.style, W, D, H])
  const logo = useMemo(() => new THREE.MeshStandardMaterial({ map: roofLogo(w.name), transparent: true, roughness: 0.5 }), [w.name])
  const name = useMemo(
    () => std({ map: signText(w.name.toUpperCase(), '#4338a8', '#ffffff') }),
    [w.name, w.style],
  )
  const officeMat = useMemo(() => std({ map: windows('#f6f7fb') }), [])
  const slots = sim.slots.filter((s) => s.whId === w.id)
  const yardHalf = yardHalfWidth(w)
  const rise = 3.4

  return (
    <group position={[0, 0, w.zOffset]}>
    <group>
      {/* building */}
      <group
        onClick={(e) => {
          e.stopPropagation()
          setActive(w.id)
        }}
      >
        <mesh material={mats} position={[w.cx, H / 2, cz]} castShadow receiveShadow>
          <boxGeometry args={[W, H, D]} />
        </mesh>
        <mesh material={MAT.plinth} position={[w.cx, 0.55, FRONT_Z + 0.3]} receiveShadow>
          <boxGeometry args={[W + 0.2, 1.1, 0.8]} />
        </mesh>
        {w.style === 'blue' ? (
          <group position={[w.cx, H, cz]}>
            <GableRoof width={W} depth={D} rise={rise} />
            <mesh material={logo} position={[0, rise / 2 + 0.45, D / 4 + 0.1]} rotation={[-Math.PI / 2 + Math.atan2(rise, D / 2 + 0.7), 0, 0]}>
              <planeGeometry args={[5, 5]} />
            </mesh>
          </group>
        ) : (
          <group position={[w.cx, H, cz]}>
            {/* parapet */}
            {[
              [0, D / 2, W + 0.4, 0.4], [0, -D / 2, W + 0.4, 0.4],
            ].map(([x, z, l, t], i) => (
              <mesh key={i} material={MAT.parapet} position={[x, 0.4, z]} castShadow>
                <boxGeometry args={[l, 0.8, t]} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={s} material={MAT.parapet} position={[(s * W) / 2, 0.4, 0]} castShadow>
                <boxGeometry args={[0.4, 0.8, D]} />
              </mesh>
            ))}
            {/* skylights */}
            {Array.from({ length: Math.floor(W / 8) }, (_, k) => (
              <mesh key={k} material={MAT.skylight} position={[-W / 2 + 6 + k * 8, 0.15, -2]}>
                <boxGeometry args={[2.2, 0.3, D * 0.55]} />
              </mesh>
            ))}
            {/* rooftop units */}
            {Array.from({ length: w.style === 'cold' ? 8 : 4 }, (_, k) => (
              <group key={k} position={[-W / 2 + 4 + ((k * 7.3) % (W - 8)), 0.6, D / 2 - 4 - (k % 2) * 6]}>
                <mesh material={MAT.hvac} castShadow>
                  <boxGeometry args={[2.6, 1.2, 2.2]} />
                </mesh>
                <mesh material={MAT.hvacDark} position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.75, 20]} />
                </mesh>
              </group>
            ))}
            <mesh material={logo} position={[W / 2 - 6, 0.2, D / 2 - 6]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[6, 6]} />
            </mesh>
          </group>
        )}
        {/* name sign */}
        <mesh material={name} position={[w.cx, H - 1.3, FRONT_Z + 0.02]}>
          <planeGeometry args={[Math.min(16, W * 0.4), 1.6]} />
        </mesh>
        {/* office annex */}
        <mesh material={officeMat} position={[w.cx - W / 2 - 4, 3, cz + 6]} castShadow receiveShadow>
          <boxGeometry args={[8, 6, 14]} />
        </mesh>
        <mesh material={MAT.parapet} position={[w.cx - W / 2 - 4, 6.1, cz + 6]} castShadow>
          <boxGeometry args={[8.4, 0.3, 14.4]} />
        </mesh>
      </group>

      {Array.from({ length: w.docks }, (_, i) => (
        <Dock key={i} w={w} i={i} h={H} />
      ))}

      {/* yard pavement */}
      <mesh material={MAT.yard} position={[w.cx, 0.01, (FRONT_Z - 6) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[yardHalf * 2, FRONT_Z * -1 - 6 + 2]} />
      </mesh>
      <YardMarkings w={w} />
      <Fence w={w} />

      {slots.map((s) => (
        <SlotPallet key={s.id} slot={s} zOffset={w.zOffset} />
      ))}

      {/* backyard props */}
      <ShippingContainer color="#24a1a6" label="OCEANIC" position={[w.cx + W / 2 - 8, 0, cz - D / 2 - 4]} />
      <ShippingContainer color="#2f6bed" label="BLUELINE" position={[w.cx + W / 2 - 8, 0, cz - D / 2 - 7]} />
      <ShippingContainer color="#24a1a6" label="OCEANIC" position={[w.cx + W / 2 - 8, 2.6, cz - D / 2 - 5.5]} />
      {[0, 1, 2].map((k) => (
        <group key={k} position={[w.cx - W / 2 + 12 + k * 1.6, 0, cz - D / 2 - 4]}>
          <PalletModel kind={k === 1 ? 'blue' : 'box'} />
        </group>
      ))}
    </group>
    </group>
  )
}

function YardMarkings({ w }: { w: Warehouse }) {
  const lines: [number, number, number, number][] = [] // x, z, w, d
  for (let i = 0; i < w.docks; i++) {
    const x = dockX(w, i)
    const z0 = DOCK_REAR_Z - 0.6
    const z1 = -11.5
    lines.push([x - 1.85, (z0 + z1) / 2, 0.12, z1 - z0])
    lines.push([x + 1.85, (z0 + z1) / 2, 0.12, z1 - z0])
  }
  for (const side of [-1, 1]) {
    for (const z of SLOT_ROWS) {
      const x0 = w.cx + side * (slotStart(w) - 1)
      const x1 = w.cx + side * (slotStart(w) + (SLOT_COLS - 1) * SLOT_STEP + 1)
      const cx = (x0 + x1) / 2
      const len = Math.abs(x1 - x0)
      lines.push([cx, z - 1, len, 0.1], [cx, z + 1, len, 0.1])
    }
  }
  return (
    <group>
      {lines.map(([x, z, lw, ld], i) => (
        <mesh key={i} material={MAT.yellow} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[lw, ld]} />
        </mesh>
      ))}
    </group>
  )
}

function Fence({ w }: { w: Warehouse }) {
  const half = yardHalfWidth(w) + 0.5
  const z0 = FRONT_Z - BUILDING_DEPTH - 4
  const z1 = -7
  const posts: [number, number][] = []
  for (const s of [-1, 1]) for (let z = z0; z <= z1; z += 3) posts.push([w.cx + s * half, z])
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} material={MAT.fence} position={[x, 0.7, z]}>
          <boxGeometry args={[0.12, 1.4, 0.12]} />
        </mesh>
      ))}
      {[-1, 1].map((s) =>
        [0.5, 1.3].map((y) => (
          <mesh key={`${s}${y}`} material={MAT.fence} position={[w.cx + s * half, y, (z0 + z1) / 2]}>
            <boxGeometry args={[0.06, 0.06, z1 - z0]} />
          </mesh>
        )),
      )}
    </group>
  )
}
