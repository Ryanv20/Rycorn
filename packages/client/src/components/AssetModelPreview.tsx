import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CatalogAsset } from '../../../../packages/scale-engine/src/assets'

function makeContainer(parent: THREE.Group, x: number, y: number, z: number, length: number, beam: number, height: number, color: string) {
  const unit = new THREE.Group()
  unit.position.set(x, y, z)
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0.12 })
  const box = new THREE.Mesh(new THREE.BoxGeometry(length, height, beam), material)
  box.castShadow = true; box.receiveShadow = true; unit.add(box)
  const ribMaterial = new THREE.MeshStandardMaterial({ color: '#d6d9d0', roughness: 0.65, metalness: 0.38 })
  for (let i = 1; i < 14; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.018, height * 0.94, beam + 0.012), ribMaterial)
    rib.position.x = -length / 2 + (length * i) / 14
    unit.add(rib)
  }
  const corner = new THREE.MeshStandardMaterial({ color: '#d8bf84', metalness: 0.65, roughness: 0.4 })
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const fitting = new THREE.Mesh(new THREE.BoxGeometry(0.08, height + 0.035, 0.08), corner)
    fitting.position.set(dx * (length / 2 - 0.045), 0, dz * (beam / 2 - 0.045)); unit.add(fitting)
  }
  parent.add(unit)
}

function buildAsset(asset: CatalogAsset, color: string) {
  const group = new THREE.Group()
  const { length: rawLength, beam: rawBeam, height: rawHeight } = asset.dimensions
  const ratio = 13 / Math.max(rawLength, rawBeam, rawHeight, 1)
  const length = rawLength * ratio, beam = rawBeam * ratio, height = rawHeight * ratio
  const steel = new THREE.MeshStandardMaterial({ color, metalness: 0.48, roughness: 0.46 })
  const deckMaterial = new THREE.MeshStandardMaterial({ color: '#65736f', metalness: 0.3, roughness: 0.78 })
  const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
    return mesh
  }
  const p = asset.preview
  if (['ship', 'barge', 'tug', 'tanker'].includes(p)) {
    const hullShape = new THREE.Shape()
    hullShape.moveTo(-length * 0.49, -beam * 0.42); hullShape.lineTo(length * 0.36, -beam * 0.5)
    hullShape.lineTo(length * 0.49, -beam * 0.26); hullShape.lineTo(length * 0.49, beam * 0.26)
    hullShape.lineTo(length * 0.36, beam * 0.5); hullShape.lineTo(-length * 0.49, beam * 0.42); hullShape.closePath()
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: Math.max(0.45, height * 0.34), bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 }), steel)
    hull.rotation.x = -Math.PI / 2; hull.position.y = 0.08; hull.castShadow = true; hull.receiveShadow = true; group.add(hull)
    const deckY = height * 0.34 + 0.28
    addBox(0, deckY, 0, length * 0.91, 0.28, beam * 0.82, deckMaterial)
    // Barge deck remains visible when unladen; cargo vessels get restrained, correctly proportioned ISO stow.
    if (p === 'ship') {
      const count = asset.id === 'container-ship' ? 4 : 2
      const cellLength = Math.min(1.06, length * 0.17), cellBeam = Math.min(0.58, beam * 0.31), cellHeight = Math.max(0.48, height * 0.2)
      const colors = ['#b6503f', '#345d83', '#c09743', '#477a68', '#875368']
      for (let row = 0; row < 2; row++) for (let bay = 0; bay < count; bay++) {
        const tiers = asset.id === 'container-ship' && bay < count - 1 ? 2 : 1
        for (let tier = 0; tier < tiers; tier++) makeContainer(group, -length * 0.12 + bay * cellLength * 1.08, deckY + cellHeight / 2 + tier * cellHeight, (row - 0.5) * cellBeam * 1.12, cellLength, cellBeam, cellHeight, colors[(bay + row * 2 + tier) % colors.length])
      }
    } else if (p === 'barge') {
      for (let x = -length * 0.35; x <= length * 0.35; x += length * 0.2) addBox(x, deckY + 0.12, 0, 0.04, 0.03, beam * 0.74, new THREE.MeshStandardMaterial({ color: '#a2a69a', roughness: 0.8 }))
    } else if (p === 'tanker') {
      for (let i = 0; i < 4; i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.17, beam * 0.17, length * 0.13, 24), new THREE.MeshStandardMaterial({ color: '#aab6ad', metalness: 0.38, roughness: 0.5 }))
        tank.rotation.z = Math.PI / 2; tank.position.set(-length * 0.23 + i * length * 0.15, deckY + height * 0.15, 0); tank.castShadow = true; group.add(tank)
      }
    }
    const cabinX = length * 0.34, cabinY = deckY + height * 0.3
    const cabinLength = length * 0.13, cabinHeight = height * 0.65, cabinBeam = beam * 0.53
    const cabinTrim = new THREE.MeshStandardMaterial({ color: '#d5ded5', roughness: 0.55 })
    const cabinRoof = new THREE.MeshStandardMaterial({ color: '#e5ebe1', roughness: 0.5 })
    const bridgeGlass = new THREE.MeshPhysicalMaterial({ color: '#8ec4d2', transparent: true, opacity: 0.28, roughness: 0.18, metalness: 0.08, side: THREE.DoubleSide, depthWrite: false })
    const cabinWall = new THREE.MeshStandardMaterial({ color: '#263640', roughness: 0.65, metalness: 0.3 })
    // Open-framed wheelhouse: the captain POV looks through real glazing at the sea.
    addBox(cabinX, cabinY - cabinHeight * 0.48, 0, cabinLength, 0.12, cabinBeam, cabinTrim)
    addBox(cabinX + cabinLength * 0.47, cabinY, 0, cabinLength * 0.08, cabinHeight * 0.85, cabinBeam, cabinTrim)
    for (const side of [-1, 1]) addBox(cabinX, cabinY + cabinHeight * 0.02, side * cabinBeam * 0.48, cabinLength, cabinHeight * 0.09, 0.12, cabinTrim)
    addBox(cabinX, cabinY + cabinHeight * 0.49, 0, cabinLength * 1.12, cabinHeight * 0.1, cabinBeam * 1.12, cabinRoof)
    const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(0.035, cabinHeight * 0.72, cabinBeam * 0.8), bridgeGlass)
    frontWindow.position.set(cabinX - cabinLength * 0.49, cabinY, 0); group.add(frontWindow)
    for (const side of [-1, 1]) {
      const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(cabinLength * 0.8, cabinHeight * 0.68, 0.035), bridgeGlass)
      sideWindow.position.set(cabinX, cabinY, side * cabinBeam * 0.48); group.add(sideWindow)
    }
    addBox(cabinX - cabinLength * 0.08, cabinY - cabinHeight * 0.19, 0, cabinLength * 0.32, cabinHeight * 0.1, cabinBeam * 0.74, cabinWall)
    const screenFrame = new THREE.MeshStandardMaterial({ color: '#101a21', roughness: 0.48, metalness: 0.44 })
    const screenFace = new THREE.MeshStandardMaterial({ color: '#2e8892', emissive: '#1bc9c2', emissiveIntensity: 0.45, roughness: 0.28 })
    for (const z of [-cabinBeam * 0.31, -cabinBeam * 0.1, cabinBeam * 0.1, cabinBeam * 0.31]) {
      addBox(cabinX - cabinLength * 0.1, cabinY - cabinHeight * 0.02, z, cabinLength * 0.035, cabinHeight * 0.25, cabinBeam * 0.15, screenFrame)
      const display = new THREE.Mesh(new THREE.PlaneGeometry(cabinBeam * 0.13, cabinHeight * 0.19), screenFace)
      display.rotation.y = Math.PI / 2; display.position.set(cabinX + cabinLength * 0.08, cabinY - cabinHeight * 0.015, z); group.add(display)
    }
    const helm = new THREE.Mesh(new THREE.TorusGeometry(cabinHeight * 0.12, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: '#cfad72', metalness: 0.68, roughness: 0.4 }))
    helm.position.set(cabinX + cabinLength * 0.24, cabinY - cabinHeight * 0.16, 0); helm.rotation.y = Math.PI / 2; group.add(helm)
    for (const x of [-length * 0.3, length * 0.3]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.04, 0.035, beam * 0.84), new THREE.MeshStandardMaterial({ color: '#d9bd7d', metalness: 0.7, emissive: '#795b24', emissiveIntensity: 0.12 }))
      rail.position.set(x, deckY + 0.18, 0); group.add(rail)
    }
  } else if (p === 'container') {
    makeContainer(group, 0, height / 2, 0, length, beam, height, color)
  } else if (asset.id === 'street-tree') {
    const trunk = new THREE.MeshStandardMaterial({ color: '#76543d', roughness: 0.95 })
    const foliage = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.045, beam * 0.075, height * 0.5, 10), trunk)
    stem.position.y = height * 0.25; stem.castShadow = true; group.add(stem)
    for (const [x, y, z, scale] of [[0, 0.67, 0, 0.31], [-0.17, 0.62, 0, 0.22], [0.16, 0.7, 0.04, 0.24], [0, 0.84, -0.04, 0.2]] as const) {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(length * scale, 16, 12), foliage)
      crown.position.set(x * length, y * height, z * beam); crown.castShadow = true; group.add(crown)
    }
  } else if (asset.id === 'lekki-world-ground') {
    addBox(0, 0, 0, length, 0.08, beam, new THREE.MeshStandardMaterial({ color: '#c5cfad', roughness: 1 }))
    addBox(length * 0.31, 0.055, 0, length * 0.3, 0.055, beam, new THREE.MeshStandardMaterial({ color: '#aeb9bd', roughness: 0.93 }))
    addBox(length * 0.46, 0.04, 0, length * 0.08, 0.03, beam, new THREE.MeshStandardMaterial({ color: '#286e83', roughness: 0.34, metalness: 0.18 }))
  } else if (asset.id === 'city-road' || asset.id === 'city-sidewalk' || asset.id === 'warehouse-yard') {
    const pavement = new THREE.MeshStandardMaterial({ color, roughness: 0.96 })
    addBox(0, 0.035, 0, length, 0.07, beam, pavement)
    if (asset.id === 'city-road') {
      const paint = new THREE.MeshStandardMaterial({ color: '#f7f7e9', roughness: 0.8 })
      for (let x = -length * 0.43; x < length * 0.45; x += length * 0.13) addBox(x, 0.076, 0, length * 0.055, 0.012, Math.max(0.035, beam * 0.02), paint)
    } else if (asset.id === 'warehouse-yard') {
      const yellow = new THREE.MeshStandardMaterial({ color: '#d7aa43', roughness: 0.74 })
      for (let z = -beam * 0.34; z <= beam * 0.34; z += beam * 0.34) addBox(0, 0.078, z, length * 0.86, 0.014, 0.055, yellow)
    }
  } else if (asset.id === 'street-light-sign') {
    const steelPole = new THREE.MeshStandardMaterial({ color, metalness: 0.68, roughness: 0.42 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.1, beam * 0.17, height, 12), steelPole)
    pole.position.set(-length * 0.22, height * 0.5, 0); pole.castShadow = true; group.add(pole)
    addBox(-length * 0.06, height * 0.95, 0, length * 0.36, beam * 0.09, beam * 0.09, steelPole)
    const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe5a3', emissive: '#ffcc71', emissiveIntensity: 1.4, roughness: 0.28 })
    addBox(length * 0.13, height * 0.91, 0, length * 0.09, beam * 0.16, beam * 0.28, lampMat)
    addBox(-length * 0.36, height * 0.76, 0, length * 0.48, height * 0.18, beam * 0.25, new THREE.MeshStandardMaterial({ color: '#26343d', roughness: 0.7 }))
    addBox(-length * 0.36, height * 0.76, beam * 0.135, length * 0.42, height * 0.145, 0.018, new THREE.MeshStandardMaterial({ color: '#89cbbd', emissive: '#276f65', emissiveIntensity: 0.42 }))
  } else if (asset.id === 'warehouse-pallet-load') {
    const wood = new THREE.MeshStandardMaterial({ color: '#9c744a', roughness: 0.9 })
    const cargo = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    for (const z of [-beam * 0.34, 0, beam * 0.34]) addBox(0, height * 0.08, z, length * 0.94, height * 0.1, beam * 0.16, wood)
    addBox(0, height * 0.51, 0, length * 0.84, height * 0.78, beam * 0.82, cargo)
    for (let x = -length * 0.32; x <= length * 0.33; x += length * 0.13) addBox(x, height * 0.52, beam * 0.415, 0.025, height * 0.7, 0.018, new THREE.MeshStandardMaterial({ color: '#ddc69c', roughness: 0.8 }))
  } else if (asset.id === 'lekki-city-building' || asset.id === 'warehouse-dock') {
    const facade = new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    if (asset.id === 'lekki-city-building') {
      addBox(0, height * 0.48, 0, length * 0.88, height * 0.94, beam * 0.84, facade)
      const glass = new THREE.MeshStandardMaterial({ color: '#528494', metalness: 0.22, roughness: 0.24, emissive: '#163944', emissiveIntensity: 0.22 })
      for (const side of [-1, 1]) for (let floor = 0; floor < 3; floor++) for (let bay = 0; bay < 3; bay++) addBox((bay - 1) * length * 0.24, height * (0.2 + floor * 0.26), side * beam * 0.425, length * 0.13, height * 0.12, 0.025, glass)
      addBox(0, height * 0.96, 0, length * 0.94, height * 0.05, beam * 0.9, deckMaterial)
    } else {
      addBox(0, height * 0.42, 0, length * 0.92, height * 0.82, beam * 0.84, facade)
      const bay = new THREE.MeshStandardMaterial({ color: '#26343c', roughness: 0.8 })
      const safety = new THREE.MeshStandardMaterial({ color: '#d2a74c', roughness: 0.7 })
      for (let x = -length * 0.36; x <= length * 0.36; x += length * 0.24) {
        addBox(x, height * 0.34, beam * 0.43, length * 0.14, height * 0.42, 0.025, bay)
        addBox(x, height * 0.12, beam * 0.46, length * 0.16, height * 0.035, 0.12, safety)
      }
      addBox(0, height * 0.86, 0, length * 0.96, height * 0.12, beam * 0.9, deckMaterial)
    }
  } else {
    // Equipment and terminal assets are built as shaded 3D masses at catalog proportions.
    if (p === 'crane') {
      addBox(0, height * 0.58, 0, length * 0.72, height * 0.1, beam * 0.12, steel)
      for (const x of [-length * 0.32, length * 0.32]) addBox(x, height * 0.3, 0, beam * 0.1, height * 0.58, beam * 0.1, steel)
      addBox(length * 0.28, height * 0.79, 0, length * 0.36, height * 0.06, beam * 0.1, steel)
      addBox(0, height * 0.9, 0, length * 0.11, height * 0.18, beam * 0.13, deckMaterial)
    } else if (p === 'warehouse' || p === 'terminal') {
      addBox(0, height * 0.42, 0, length * 0.9, height * 0.82, beam * 0.88, steel)
      if (p === 'warehouse') {
        for (const z of [-beam * 0.45, beam * 0.45]) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(length, beam) * 0.48, height * 0.24, 4), deckMaterial)
          roof.position.set(0, height * 0.92, z * 0.5); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.45); group.add(roof)
        }
      }
    } else if (p === 'vehicle') {
      if (asset.id === 'freight-truck') {
        const tire = new THREE.MeshStandardMaterial({ color: '#202832', roughness: 0.92 })
        const trailerX = -length * 0.13
        addBox(trailerX, height * 0.56, 0, length * 0.53, height * 0.66, beam * 0.76, new THREE.MeshStandardMaterial({ color: '#e6ebe8', roughness: 0.68 }))
        addBox(trailerX, height * 0.91, 0, length * 0.53, height * 0.035, beam * 0.78, deckMaterial)
        addBox(length * 0.34, height * 0.41, 0, length * 0.23, height * 0.48, beam * 0.88, steel)
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(length * 0.025, height * 0.22, beam * 0.68), new THREE.MeshPhysicalMaterial({ color: '#76b8c8', roughness: 0.19, metalness: 0.15 }))
        windshield.position.set(length * 0.455, height * 0.59, 0); group.add(windshield)
        addBox(0, height * 0.15, 0, length * 0.88, height * 0.09, beam * 0.32, deckMaterial)
        for (const x of [-length * 0.33, -length * 0.25, -length * 0.15, length * 0.28, length * 0.43]) for (const side of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.12, height * 0.12, beam * 0.12, 16), tire)
          wheel.rotation.x = Math.PI / 2; wheel.position.set(x, height * 0.12, side * beam * 0.43); group.add(wheel)
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.05, height * 0.05, beam * 0.125, 12), new THREE.MeshStandardMaterial({ color: '#b4c0be', metalness: 0.72, roughness: 0.38 }))
          hub.rotation.x = Math.PI / 2; hub.position.set(x, height * 0.12, side * beam * 0.43); group.add(hub)
        }
      } else if (asset.id === 'forklift') {
        const tire = new THREE.MeshStandardMaterial({ color: '#252d37', roughness: 0.95 })
        const mastMat = new THREE.MeshStandardMaterial({ color: '#aeb8ba', metalness: 0.52, roughness: 0.42 })
        addBox(length * 0.08, height * 0.2, 0, length * 0.78, height * 0.25, beam * 0.67, new THREE.MeshStandardMaterial({ color: '#d1a84f', roughness: 0.58 }))
        addBox(length * 0.3, height * 0.34, 0, length * 0.22, height * 0.38, beam * 0.7, steel)
        // Open protective cage and seat make this visibly distinct from the port trucks.
        for (const x of [-length * 0.18, length * 0.24]) for (const side of [-1, 1]) addBox(x, height * 0.64, side * beam * 0.34, length * 0.035, height * 0.55, beam * 0.035, deckMaterial)
        addBox(0, height * 0.92, 0, length * 0.52, height * 0.045, beam * 0.75, deckMaterial)
        addBox(length * 0.17, height * 0.47, 0, length * 0.11, height * 0.12, beam * 0.24, new THREE.MeshStandardMaterial({ color: '#222832' }))
        for (const side of [-1, 1]) {
          addBox(-length * 0.43, height * 0.57, side * beam * 0.33, length * 0.045, height * 0.82, beam * 0.045, mastMat)
          addBox(-length * 0.44, height * 0.18, side * beam * 0.2, length * 0.47, height * 0.035, beam * 0.055, mastMat)
        }
        for (const x of [-length * 0.31, length * 0.3]) for (const side of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.12, height * 0.12, beam * 0.13, 14), tire)
          wheel.rotation.x = Math.PI / 2; wheel.position.set(x, height * 0.13, side * beam * 0.38); group.add(wheel)
        }
      } else {
        // Yard tractor / compact terminal vehicle.
        addBox(0, height * 0.22, 0, length * 0.92, height * 0.2, beam * 0.72, deckMaterial)
        addBox(length * 0.13, height * 0.48, 0, length * 0.28, height * 0.38, beam * 0.65, steel)
        for (const x of [-length * 0.3, length * 0.3]) for (const z of [-beam * 0.37, beam * 0.37]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.13, height * 0.13, beam * 0.12, 16), new THREE.MeshStandardMaterial({ color: '#18232a', roughness: 0.92 }))
          wheel.rotation.x = Math.PI / 2; wheel.position.set(x, height * 0.12, z); group.add(wheel)
        }
      }
    } else if (p === 'bridge') {
      const floorY = height * 0.25
      const cabinX = length * 0.34, cabinLength = length * 0.58, cabinBeam = beam * 0.74, cabinHeight = height * 0.43
      const cabinY = floorY + cabinHeight * 0.58
      addBox(0, floorY, 0, length, 0.2, beam, deckMaterial)
      const trim = new THREE.MeshStandardMaterial({ color: '#59656a', metalness: 0.48, roughness: 0.58 })
      const glass = new THREE.MeshPhysicalMaterial({ color: '#9bd9e3', transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.08, side: THREE.DoubleSide, depthWrite: false })
      const frame = new THREE.MeshStandardMaterial({ color: '#1a2a34', metalness: 0.4, roughness: 0.5 })
      addBox(cabinX, floorY + 0.08, 0, cabinLength, 0.16, cabinBeam, trim)
      addBox(cabinX + cabinLength * 0.48, cabinY, 0, cabinLength * 0.07, cabinHeight, cabinBeam, trim)
      for (const side of [-1, 1]) addBox(cabinX, cabinY + cabinHeight * 0.48, side * cabinBeam * 0.49, cabinLength, cabinHeight * 0.08, 0.12, trim)
      addBox(cabinX, cabinY + cabinHeight, 0, cabinLength * 1.12, 0.22, cabinBeam * 1.12, frame)
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.07, cabinHeight * 0.82, cabinBeam * 0.82), glass)
      front.position.set(cabinX - cabinLength * 0.5, cabinY + cabinHeight * 0.47, 0); group.add(front)
      for (const side of [-1, 1]) {
        const sidePane = new THREE.Mesh(new THREE.BoxGeometry(cabinLength * 0.9, cabinHeight * 0.78, 0.06), glass)
        sidePane.position.set(cabinX, cabinY + cabinHeight * 0.47, side * cabinBeam * 0.49); group.add(sidePane)
      }
      addBox(cabinX - cabinLength * 0.12, floorY + cabinHeight * 0.25, 0, cabinLength * 0.27, 0.26, cabinBeam * 0.78, frame)
      for (const z of [-cabinBeam * 0.3, -cabinBeam * 0.1, cabinBeam * 0.1, cabinBeam * 0.3]) {
        addBox(cabinX - cabinLength * 0.11, floorY + cabinHeight * 0.42, z, cabinLength * 0.035, cabinHeight * 0.3, cabinBeam * 0.15, frame)
        const display = new THREE.Mesh(new THREE.PlaneGeometry(cabinBeam * 0.14, cabinHeight * 0.23), new THREE.MeshStandardMaterial({ color: '#1a6f7c', emissive: '#29c3be', emissiveIntensity: 0.85, roughness: 0.3 }))
        display.rotation.y = Math.PI / 2; display.position.set(cabinX + cabinLength * 0.02, floorY + cabinHeight * 0.42, z); group.add(display)
      }
    } else {
      addBox(0, height * 0.35, 0, length * 0.82, height * 0.65, beam * 0.74, steel)
    }
  }
  return group
}

export default function AssetModelPreview({ asset, color }: { asset: CatalogAsset; color: string }) {
  const host = useRef<HTMLDivElement>(null)
  const captainCapable = ['ship', 'barge', 'tug', 'tanker', 'bridge'].includes(asset.preview)
  const [view, setView] = useState<'orbit' | 'captain' | 'bow' | 'port' | 'starboard' | 'overhead'>(() => captainCapable ? 'captain' : 'orbit')
  const [lighting, setLighting] = useState<'day' | 'night'>('day')
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm'>('clear')
  useEffect(() => {
    const element = host.current
    if (!element) return
    const isNight = lighting === 'night'
    const scene = new THREE.Scene()
    const sky = new THREE.Color(isNight ? (weather === 'storm' ? '#111824' : '#071725') : weather === 'storm' ? '#4b5b65' : '#87bdd5')
    scene.background = sky
    scene.fog = new THREE.Fog(sky, 34, 100)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = isNight ? 0.68 : 1.12
    renderer.domElement.className = 'asset-model-canvas'
    element.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(isNight ? '#506b91' : '#d6edf3', '#29434a', isNight ? 0.48 : weather === 'storm' ? 1.15 : 2.1))
    const sun = new THREE.DirectionalLight(isNight ? '#8eafd6' : '#fff1d2', isNight ? 0.18 : weather === 'storm' ? 1.15 : 3.3)
    sun.position.set(-12, 22, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun)
    const fill = new THREE.DirectionalLight('#58c7d5', isNight ? 0.75 : 1.4); fill.position.set(12, 7, -15); scene.add(fill)
    const waterMaterial = new THREE.MeshStandardMaterial({ color: isNight ? (weather === 'storm' ? '#101d29' : '#071e34') : weather === 'storm' ? '#304e5d' : '#135369', roughness: weather === 'storm' ? 0.56 : 0.32, metalness: 0.34 })
    const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 40, 40), waterMaterial)
    water.rotation.x = -Math.PI / 2; water.position.y = -0.42; water.receiveShadow = true; scene.add(water)
    const grid = new THREE.GridHelper(100, 50, '#60c2bd', '#447982'); grid.position.y = -0.4
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach(material => { material.transparent = true; material.opacity = isNight ? 0.08 : 0.16 }); scene.add(grid)
    const model = buildAsset(asset, color); scene.add(model)
    const dimensions = asset.dimensions
    const ratio = 13 / Math.max(dimensions.length, dimensions.beam, dimensions.height, 1)
    const fit = Math.max(dimensions.length, dimensions.beam, dimensions.height) * ratio
    const cameraPos: Record<typeof view, [number, number, number]> = {
      orbit: [1.32, 0.88, 1.55], captain: [0, 0, 0], bow: [-1.8, 0.48, 0],
      port: [-0.12, 0.45, 1.95], starboard: [-0.12, 0.45, -1.95], overhead: [0, 2.1, 0.08],
    }
    const lookTarget: Record<typeof view, [number, number, number]> = {
      orbit: [0, 0.27, 0], captain: [0, 0, 0], bow: [-0.18, 0.22, 0],
      port: [0, 0.25, 0], starboard: [0, 0.25, 0], overhead: [0, 0.1, 0],
    }
    const offset = cameraPos[view], look = lookTarget[view]
    let viewTarget = new THREE.Vector3(look[0] * fit, look[1] * fit, look[2] * fit)
    if (view === 'captain' && ['ship', 'barge', 'tug', 'tanker', 'bridge'].includes(asset.preview)) {
      const normalizedLength = dimensions.length * ratio
      const normalizedHeight = dimensions.height * ratio
      const deckY = normalizedHeight * 0.34 + 0.28
      const cabinX = normalizedLength * 0.34
      const cabinY = asset.preview === 'bridge' ? normalizedHeight * (0.25 + 0.43 * 0.58) : deckY + normalizedHeight * 0.3
      camera.position.set(cabinX + normalizedLength * 0.01, cabinY, 0)
      viewTarget = new THREE.Vector3(cabinX - normalizedLength * 0.2, cabinY + 0.04, 0)
      camera.near = 0.01
    } else camera.position.set(offset[0] * fit, offset[1] * fit, offset[2] * fit).add(viewTarget)
    camera.lookAt(viewTarget)
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(viewTarget))
    let dragging = false, lastX = 0, lastY = 0
    const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      spherical.theta -= (event.clientX - lastX) * 0.008
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.clientY - lastY) * 0.008, 0.16, Math.PI * 0.48)
      lastX = event.clientX; lastY = event.clientY
      camera.position.setFromSpherical(spherical).add(viewTarget); camera.lookAt(viewTarget)
    }
    const up = () => { dragging = false }
    const zoom = (event: WheelEvent) => { spherical.radius = THREE.MathUtils.clamp(spherical.radius * (event.deltaY > 0 ? 1.08 : 0.92), fit * 0.45, fit * 4); camera.position.setFromSpherical(spherical).add(viewTarget); camera.lookAt(viewTarget) }
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up); renderer.domElement.addEventListener('wheel', zoom, { passive: true })
    let frame = 0
    let disposed = false
    let nextFlash = 0
    const lightning = new THREE.PointLight('#c9eaff', 0, fit * 3, 2)
    lightning.position.set(-fit, fit * 1.5, -fit); scene.add(lightning)
    const rainCount = weather === 'clear' ? 0 : 160
    const rainPositions = new Float32Array(rainCount * 6)
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * fit * 3, y = Math.random() * fit * 1.8, z = (Math.random() - 0.5) * fit * 3
      rainPositions.set([x, y, z, x - 0.12, y - fit * 0.055, z - 0.06], i * 6)
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
    const rainMaterial = new THREE.LineBasicMaterial({ color: '#c5e9f4', transparent: true, opacity: weather === 'storm' ? 0.82 : 0.48 })
    const rain = new THREE.LineSegments(rainGeometry, rainMaterial); scene.add(rain)
    if (asset.id === 'barge') {
      model.visible = false
      const mtlLoader = new MTLLoader()
      mtlLoader.setPath('/assets/port/')
      void mtlLoader.loadAsync('RiverBargeAmar.mtl').then(materials => {
        materials.preload()
        const objLoader = new OBJLoader(); objLoader.setMaterials(materials)
        return objLoader.setPath('/assets/port/').loadAsync('RiverBargeAmar.obj')
      }).then(sourceModel => {
        if (disposed) return
        const bounds = new THREE.Box3().setFromObject(sourceModel)
        const sourceSize = bounds.getSize(new THREE.Vector3()), sourceCenter = bounds.getCenter(new THREE.Vector3())
        sourceModel.position.sub(sourceCenter); sourceModel.scale.setScalar(fit / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 0.001))
        sourceModel.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true } })
        scene.add(sourceModel)
      }).catch(error => console.error('Could not load the source barge model', error))
    }
    if (asset.modelUrl) {
      model.visible = false
      const loadSourceModel = asset.modelUrl.toLowerCase().endsWith('.glb')
        ? new GLTFLoader().loadAsync(asset.modelUrl).then(result => result.scene)
        : new FBXLoader().loadAsync(asset.modelUrl)
      void loadSourceModel.then(sourceModel => {
        if (disposed) return
        sourceModel.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(sourceModel)
        const sourceSize = bounds.getSize(new THREE.Vector3())
        const sourceCenter = bounds.getCenter(new THREE.Vector3())
        sourceModel.position.sub(sourceCenter)
        sourceModel.scale.multiplyScalar(fit / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 0.001))
        const tint = new THREE.Color(color)
        sourceModel.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          object.castShadow = true
          object.receiveShadow = true
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          object.material = materials.map(material => {
            const cloned = material.clone()
            if ('color' in cloned && (cloned as THREE.MeshStandardMaterial).color) (cloned as THREE.MeshStandardMaterial).color.multiply(tint)
            return cloned
          })
        })
        scene.add(sourceModel)
      }).catch(error => console.error(`Could not load ${asset.name}`, error))
    }
    const resize = () => { const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix() }
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    const render = (time: number) => {
      water.position.y = -0.42 + Math.sin(time * 0.00045) * (weather === 'storm' ? 0.07 : 0.025)
      const waves = water.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < waves.count; i++) { const x = waves.getX(i), y = waves.getY(i); waves.setZ(i, Math.sin(x * 0.22 + time * 0.0007) * (weather === 'storm' ? 0.28 : 0.12) + Math.sin(y * 0.3 - time * 0.00048) * 0.07) }
      waves.needsUpdate = true
      for (let i = 0; i < rainCount; i++) {
        const p = i * 2, y = rainPositions[p * 3 + 1] - fit * (weather === 'storm' ? 0.04 : 0.023)
        if (y < -fit * 0.4) { const x = (Math.random() - 0.5) * fit * 3, z = (Math.random() - 0.5) * fit * 3, top = fit * (0.9 + Math.random()); rainPositions.set([x, top, z, x - 0.12, top - fit * 0.055, z - 0.06], p * 3) }
        else { rainPositions[p * 3 + 1] = y; rainPositions[p * 3 + 4] = y - fit * 0.055 }
      }
      if (rainCount) rainGeometry.attributes.position.needsUpdate = true
      if (weather === 'storm' && time > nextFlash) { lightning.intensity = 3 + Math.random() * 5; nextFlash = time + 120 + Math.random() * 450 }
      else lightning.intensity = Math.max(0, lightning.intensity - 0.35)
      renderer.render(scene, camera); frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up); renderer.domElement.removeEventListener('wheel', zoom)
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()) } })
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [asset, color, view, lighting, weather])
  return <div className="asset-model-preview-shell">
    <div className="asset-preview-toolbar">
      <div className="asset-preview-povs" role="group" aria-label="Camera viewpoint">
        {([['orbit', 'ORBIT'], ...(captainCapable ? [['captain', 'CAPTAIN POV'] as const] : []), ['bow', 'BOW'], ['port', 'PORT'], ['starboard', 'STBD'], ['overhead', 'TOP']] as const).map(([id, label]) => <button key={id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>{label}</button>)}
      </div>
      <div className="asset-preview-scene-controls">
        <button onClick={() => setLighting(mode => mode === 'day' ? 'night' : 'day')}>{lighting.toUpperCase()} / {lighting === 'day' ? '☼' : '☾'}</button>
        <select value={weather} onChange={event => setWeather(event.target.value as typeof weather)} aria-label="Preview weather"><option value="clear">CLEAR SEA</option><option value="rain">RAIN</option><option value="storm">STORM</option></select>
      </div>
    </div>
    <div ref={host} className="asset-model-stage" />
  </div>
}
