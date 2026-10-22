import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Forklift, Truck } from '../sim/sim'
import { trailerSide } from './textures'
import { PalletModel } from './Props'
import { useUI } from '../store'

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra })

export const M = {
  tire: mat('#2a2f3d', { roughness: 0.9 }),
  hub: mat('#c9cfdc'),
  glass: mat('#23345e', { roughness: 0.25, metalness: 0.3 }),
  chassis: mat('#3b4357'),
  trailer: mat('#f7f8fc'),
  trailerRoof: mat('#eef0f6'),
  rearDoor: mat('#e3e7f0'),
  bumper: mat('#9aa3b8'),
  light: mat('#ffe9a8', { emissive: '#ffd36b', emissiveIntensity: 0.4 }),
  red: mat('#ef4b4b', { emissive: '#c52b2b', emissiveIntensity: 0.3 }),
  forkYellow: mat('#f6b40e'),
  forkDark: mat('#2d3343'),
  forkSteel: mat('#6b7388', { metalness: 0.4, roughness: 0.4 }),
  seat: mat('#1f2430'),
}

const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 20).rotateZ(Math.PI / 2)
const hubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.44, 12).rotateZ(Math.PI / 2)
const smallWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.28, 16).rotateZ(Math.PI / 2)

const cabMats = new Map<string, THREE.MeshStandardMaterial>()
const cabMat = (c: string) => {
  if (!cabMats.has(c)) cabMats.set(c, mat(c, { roughness: 0.45 }))
  return cabMats.get(c)!
}

function useHover() {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
  }
}

export function TruckModel({ truck }: { truck: Truck }) {
  const group = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const select = useUI((s) => s.select)
  const hover = useHover()
  const side = useMemo(() => trailerSide(truck.carrier), [truck.carrier])
  const sideMat = useMemo(() => new THREE.MeshStandardMaterial({ map: side, roughness: 0.6 }), [side])
  const cab = cabMat(truck.carrier.cab)
  const stripe = cabMat(truck.carrier.accent)

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.position.set(truck.pos.x, 0, truck.pos.z)
    g.rotation.y = truck.heading
    wheels.current?.children.forEach((w) => (w.rotation.x = truck.wheel))
  })

  const wheelZ = [4.55, -2.9, -4.1]
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        select({ type: 'truck', id: truck.id })
      }}
      {...hover}
    >
      {/* chassis */}
      <mesh material={M.chassis} position={[0, 0.72, -0.2]} castShadow>
        <boxGeometry args={[2.1, 0.36, 10.6]} />
      </mesh>
      {/* trailer */}
      <mesh material={M.trailer} position={[0, 2.55, -1.25]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 3.1, 8.5]} />
      </mesh>
      <mesh material={sideMat} position={[1.255, 2.55, -1.25]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8.5, 3.1]} />
      </mesh>
      <mesh material={sideMat} position={[-1.255, 2.55, -1.25]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8.5, 3.1]} />
      </mesh>
      <mesh material={M.rearDoor} position={[0, 2.55, -5.51]}>
        <boxGeometry args={[2.4, 3.0, 0.04]} />
      </mesh>
      <mesh material={M.red} position={[0.95, 1.15, -5.52]}>
        <boxGeometry args={[0.3, 0.14, 0.04]} />
      </mesh>
      <mesh material={M.red} position={[-0.95, 1.15, -5.52]}>
        <boxGeometry args={[0.3, 0.14, 0.04]} />
      </mesh>
      {/* cab */}
      <RoundedBox args={[2.45, 2.7, 2.3]} radius={0.28} smoothness={3} position={[0, 2.0, 4.25]} material={cab} castShadow />
      <mesh material={stripe} position={[0, 1.15, 4.25]}>
        <boxGeometry args={[2.5, 0.32, 2.2]} />
      </mesh>
      <mesh material={M.glass} position={[0, 2.65, 5.36]}>
        <boxGeometry args={[2.1, 0.95, 0.1]} />
      </mesh>
      <mesh material={M.glass} position={[1.23, 2.65, 4.6]}>
        <boxGeometry args={[0.04, 0.85, 0.9]} />
      </mesh>
      <mesh material={M.glass} position={[-1.23, 2.65, 4.6]}>
        <boxGeometry args={[0.04, 0.85, 0.9]} />
      </mesh>
      <mesh material={M.bumper} position={[0, 0.75, 5.42]}>
        <boxGeometry args={[2.4, 0.4, 0.2]} />
      </mesh>
      <mesh material={M.light} position={[0.85, 1.25, 5.42]}>
        <boxGeometry args={[0.4, 0.2, 0.06]} />
      </mesh>
      <mesh material={M.light} position={[-0.85, 1.25, 5.42]}>
        <boxGeometry args={[0.4, 0.2, 0.06]} />
      </mesh>
      {/* wheels */}
      <group ref={wheels}>
        {wheelZ.flatMap((z) =>
          [-1, 1].map((s) => (
            <group key={`${z}${s}`} position={[s * 1.05, 0.52, z]}>
              <mesh geometry={wheelGeo} material={M.tire} castShadow />
              <mesh geometry={hubGeo} material={M.hub} />
            </group>
          )),
        )}
      </group>
    </group>
  )
}

export function ForkliftModel({ fl }: { fl: Forklift }) {
  const group = useRef<THREE.Group>(null)
  const carriage = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const boxLoad = useRef<THREE.Group>(null)
  const blueLoad = useRef<THREE.Group>(null)
  const select = useUI((s) => s.select)
  const hover = useHover()

  useFrame(() => {
    if (!group.current) return
    group.current.position.set(fl.pos.x, 0, fl.pos.z)
    group.current.rotation.y = fl.heading
    if (carriage.current) carriage.current.position.y = fl.lift
    if (load.current) load.current.visible = !!fl.carrying
    if (boxLoad.current) boxLoad.current.visible = fl.carrying === 'box'
    if (blueLoad.current) blueLoad.current.visible = fl.carrying === 'blue'
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        select({ type: 'forklift', id: fl.id })
      }}
      {...hover}
    >
      {/* body */}
      <RoundedBox args={[1.35, 0.9, 2.0]} radius={0.12} smoothness={2} position={[0, 0.75, -0.2]} material={M.forkYellow} castShadow />
      <RoundedBox args={[1.35, 0.7, 0.6]} radius={0.15} smoothness={2} position={[0, 0.8, -1.25]} material={M.forkDark} castShadow />
      <mesh material={M.seat} position={[0, 1.38, -0.45]}>
        <boxGeometry args={[0.6, 0.35, 0.55]} />
      </mesh>
      {/* overhead guard */}
      {[
        [-0.6, 0.45], [0.6, 0.45], [-0.6, -0.95], [0.6, -0.95],
      ].map(([x, z], i) => (
        <mesh key={i} material={M.forkDark} position={[x, 1.75, z]} castShadow>
          <boxGeometry args={[0.08, 1.15, 0.08]} />
        </mesh>
      ))}
      <mesh material={M.forkDark} position={[0, 2.35, -0.25]} castShadow>
        <boxGeometry args={[1.3, 0.08, 1.5]} />
      </mesh>
      {/* mast */}
      <mesh material={M.forkSteel} position={[-0.45, 1.45, 0.92]} castShadow>
        <boxGeometry args={[0.12, 2.7, 0.14]} />
      </mesh>
      <mesh material={M.forkSteel} position={[0.45, 1.45, 0.92]} castShadow>
        <boxGeometry args={[0.12, 2.7, 0.14]} />
      </mesh>
      <mesh material={M.forkSteel} position={[0, 2.75, 0.92]}>
        <boxGeometry args={[1.0, 0.1, 0.12]} />
      </mesh>
      {/* carriage + forks */}
      <group ref={carriage}>
        <mesh material={M.forkDark} position={[0, 0.35, 1.02]}>
          <boxGeometry args={[1.05, 0.6, 0.08]} />
        </mesh>
        <mesh material={M.forkSteel} position={[-0.32, 0.03, 1.75]}>
          <boxGeometry args={[0.14, 0.06, 1.45]} />
        </mesh>
        <mesh material={M.forkSteel} position={[0.32, 0.03, 1.75]}>
          <boxGeometry args={[0.14, 0.06, 1.45]} />
        </mesh>
        <group ref={load} position={[0, 0.06, 1.8]} visible={false}>
          <group ref={boxLoad}>
            <PalletModel kind="box" />
          </group>
          <group ref={blueLoad}>
            <PalletModel kind="blue" />
          </group>
        </group>
      </group>
      {/* wheels */}
      {[
        [-0.62, 0.55], [0.62, 0.55], [-0.62, -1.1], [0.62, -1.1],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={smallWheelGeo} material={M.tire} position={[x, 0.3, z]} />
      ))}
    </group>
  )
}
