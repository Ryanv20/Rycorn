import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot } from '../sim/sim'
import { cardboard, containerSide, palletWood, wrapped } from './textures'
import { useUI } from '../store'

const palletMat = new THREE.MeshStandardMaterial({ map: palletWood(), roughness: 0.85 })
const boxMat = new THREE.MeshStandardMaterial({ map: cardboard(), roughness: 0.8 })
const blueMat = new THREE.MeshStandardMaterial({ map: wrapped(), roughness: 0.35, metalness: 0.05 })
const palletGeo = new THREE.BoxGeometry(1.25, 0.16, 1.25)
const stackGeo = new THREE.BoxGeometry(1.12, 1.0, 1.12)
const stackGeoTall = new THREE.BoxGeometry(1.12, 0.5, 1.12)

export function PalletModel({ kind, tall = false }: { kind: 'box' | 'blue'; tall?: boolean }) {
  return (
    <group>
      <mesh geometry={palletGeo} material={palletMat} position={[0, 0.08, 0]} castShadow receiveShadow />
      <mesh geometry={stackGeo} material={kind === 'box' ? boxMat : blueMat} position={[0, 0.66, 0]} castShadow receiveShadow />
      {tall && (
        <mesh geometry={stackGeoTall} material={boxMat} position={[0, 1.41, 0]} scale={[0.9, 1, 0.9]} castShadow />
      )}
    </group>
  )
}

const pinMat = new THREE.MeshStandardMaterial({ color: '#2f6bed', roughness: 0.35 })
const pinWhite = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })
const pinHead = new THREE.SphereGeometry(0.55, 24, 16)
const pinTip = new THREE.ConeGeometry(0.42, 1.0, 20).rotateX(Math.PI)
const pinDot = new THREE.SphereGeometry(0.22, 16, 10)

export function MapPin({ offset = 0 }: { offset?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * 2 + offset) * 0.15
  })
  return (
    <group ref={ref}>
      <mesh geometry={pinHead} material={pinMat} position={[0, 1.15, 0]} castShadow />
      <mesh geometry={pinTip} material={pinMat} position={[0, 0.55, 0]} />
      <mesh geometry={pinDot} material={pinWhite} position={[0, 1.18, 0.45]} />
    </group>
  )
}

export function SlotPallet({ slot, zOffset = 0 }: { slot: Slot; zOffset?: number }) {
  const group = useRef<THREE.Group>(null)
  const box = useRef<THREE.Group>(null)
  const blue = useRef<THREE.Group>(null)
  const pin = useRef<THREE.Group>(null)
  const select = useUI((s) => s.select)
  const tall = useMemo(() => slot.id.charCodeAt(slot.id.length - 1) % 3 === 0, [slot.id])
  useFrame(() => {
    if (!group.current) return
    group.current.visible = slot.filled
    if (box.current) box.current.visible = slot.kind === 'box'
    if (blue.current) blue.current.visible = slot.kind === 'blue'
    if (pin.current) pin.current.visible = slot.pin
  })
  return (
    <group
      ref={group}
      position={[slot.x, 0, slot.z - zOffset]}
      scale={1.3}
      onClick={(e) => {
        e.stopPropagation()
        select({ type: 'slot', id: slot.id }, false)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={box}>
        <PalletModel kind="box" tall={tall} />
      </group>
      <group ref={blue}>
        <PalletModel kind="blue" />
      </group>
      <group ref={pin} position={[0, tall ? 2.0 : 1.4, 0]}>
        <MapPin offset={slot.x} />
      </group>
    </group>
  )
}

// ───────────── static scenery

const trunkMat = new THREE.MeshStandardMaterial({ color: '#b08a6a', roughness: 0.9 })
const leafMats = ['#8fd27c', '#7cc86d', '#a3dc8c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }))
const trunkGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.4, 8)
const leafGeo = new THREE.CapsuleGeometry(0.95, 1.5, 6, 14)

export function Trees({ points }: { points: [number, number, number][] }) {
  // instanced trunks + foliage for performance
  const trunks = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh[]>([])
  const groups = useMemo(() => leafMats.map((_, i) => points.filter((_, k) => k % 3 === i)), [points])
  const setup = (mesh: THREE.InstancedMesh | null, pts: [number, number, number][], y: number) => {
    if (!mesh) return
    const m = new THREE.Matrix4()
    pts.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, y * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return (
    <group>
      <instancedMesh
        ref={(m) => {
          trunks.current = m
          setup(m, points, 0.7)
        }}
        args={[trunkGeo, trunkMat, points.length]}
        castShadow
      />
      {groups.map((pts, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            if (m) leaves.current[i] = m
            setup(m, pts, 2.6)
          }}
          args={[leafGeo, leafMats[i], pts.length]}
          castShadow
        />
      ))}
    </group>
  )
}

export function ShippingContainer({ color, label, position, rotation = 0, scale = 1 }: { color: string; label: string; position: [number, number, number]; rotation?: number; scale?: number }) {
  const m = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ map: containerSide(color, label), roughness: 0.6 })
    const plain = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    return [plain, plain, plain, plain, side, side]
  }, [color, label])
  return (
    <mesh position={[position[0], position[1] + 1.3 * scale, position[2]]} rotation={[0, rotation, 0]} scale={scale} material={m} castShadow receiveShadow>
      <boxGeometry args={[12, 2.6, 2.5]} />
    </mesh>
  )
}
