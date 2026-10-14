import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const boxGeometry = new THREE.BoxGeometry(1, 1, 1)

function material(color: number, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness })
}

function block(parent: THREE.Object3D, color: number, position: [number, number, number], size: [number, number, number], mat = material(color)) {
  const mesh = new THREE.Mesh(boxGeometry, mat)
  mesh.position.set(...position)
  mesh.scale.set(...size)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function makeLabel(text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#eef0df'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#315c5c'
  context.font = '600 46px sans-serif'
  context.fillText(text, 24, 82)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshBasicMaterial({ map: texture }))
  sign.position.set(0, 0.6, 1.01)
  return sign
}

function makeWarehouse(scene: THREE.Scene, x: number, z: number, w: number, d: number, color: number, label: string) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  scene.add(group)
  block(group, 0x345d60, [0, 1.05, 0], [w, 2.1, d], material(color))
  block(group, 0x598184, [0, 2.15, 0], [w + 0.2, 0.18, d + 0.2])
  block(group, 0x263f41, [0, 0.48, d / 2 + 0.015], [w * 0.22, 0.96, 0.08])
  group.add(makeLabel(label))
  for (let i = 0; i < 8; i++) block(group, 0x8ca19a, [-w / 2 + 0.35 + i * (w - 0.7) / 7, 0.16, d / 2 + 0.02], [0.035, 0.24, 0.035])
}

function makeContainer(scene: THREE.Object3D, x: number, y: number, z: number, color: number) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  scene.add(group)
  block(group, color, [0, 0.48, 0], [1.45, 0.95, 0.72])
  const ribMat = material(new THREE.Color(color).multiplyScalar(1.23).getHex())
  for (let i = 0; i < 7; i++) block(group, color, [-0.62 + i * 0.205, 0.48, 0.367], [0.025, 0.78, 0.025], ribMat)
  return group
}

function makeCrane(scene: THREE.Scene, x: number, z: number, color: number) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  scene.add(group)
  const steel = material(color, 0.55)
  block(group, color, [-1.3, 3.1, 0], [0.2, 6.2, 0.2], steel)
  block(group, color, [1.3, 3.1, 0], [0.2, 6.2, 0.2], steel)
  block(group, color, [0, 6.2, 0], [3.1, 0.22, 0.28], steel)
  block(group, 0xf0e8d3, [0, 6.02, 0], [2.8, 0.14, 0.34])
  block(group, color, [-1.3, 0.32, 0], [0.46, 0.35, 0.7], steel)
  block(group, color, [1.3, 0.32, 0], [0.46, 0.35, 0.7], steel)
  const trolley = new THREE.Group()
  group.add(trolley)
  block(trolley, 0xc57857, [0, 5.77, 0], [0.65, 0.35, 0.48])
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1, 0.035), material(0x364c47))
  cable.position.y = -0.6
  trolley.add(cable)
  const spreader = block(trolley, 0x334d4a, [0, -1.1, 0], [1.2, 0.12, 0.72])
  return { group, trolley, cable, spreader }
}

function makeTruck(scene: THREE.Scene, color: number, startZ: number) {
  const group = new THREE.Group()
  scene.add(group)
  block(group, color, [-0.25, 0.48, 0], [1.5, 0.82, 0.82])
  block(group, 0xe9e9d9, [0.78, 0.55, 0], [0.68, 0.98, 0.82])
  block(group, 0x8bb3b4, [0.79, 0.72, 0.416], [0.36, 0.3, 0.025])
  const wheels: THREE.Mesh[] = []
  for (const x of [-0.72, 0.72]) for (const z of [-0.33, 0.33]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 16), material(0x263835))
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.25, z)
    wheel.castShadow = true
    group.add(wheel)
    wheels.push(wheel)
  }
  group.position.set(-9, 0, startZ)
  return { group, wheels, startZ }
}

function makeShip(scene: THREE.Scene) {
  const ship = new THREE.Group()
  ship.position.set(8.5, 0.3, 3.4)
  scene.add(ship)
  const hullShape = new THREE.Shape()
  hullShape.moveTo(-5.4, -0.8)
  hullShape.lineTo(4.3, -0.8)
  hullShape.lineTo(5.5, 0.25)
  hullShape.lineTo(4.2, 0.9)
  hullShape.lineTo(-4.5, 0.9)
  hullShape.lineTo(-5.4, -0.8)
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.24, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.06 }), material(0x294950, 0.4))
  hull.rotation.x = -Math.PI / 2
  hull.position.y = 0.68
  hull.castShadow = true
  ship.add(hull)
  block(ship, 0xf0ebd9, [3.65, 1.35, 0.68], [1.15, 1.9, 1.18])
  block(ship, 0xb8d0cc, [3.65, 1.7, 1.28], [0.55, 0.4, 0.025])
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    makeContainer(ship, -3.4 + col * 1.35, 1.2 + row * 0.95, -0.1 + (col % 2) * 0.68, [0xc27757, 0x557f86, 0x6f8e78, 0xd0a16b][(row + col) % 4])
  }
  return ship
}

export default function PortYard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dce9e7')
    scene.fog = new THREE.Fog('#dce9e7', 31, 64)
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100)
    camera.position.set(18, 18, 24)
    camera.lookAt(0, 1.1, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.16

    scene.add(new THREE.HemisphereLight(0xeaf4ed, 0x788c7c, 2.2))
    const sun = new THREE.DirectionalLight(0xffe7c4, 3.2)
    sun.position.set(-8, 20, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -20
    sun.shadow.camera.right = 20
    sun.shadow.camera.top = 20
    sun.shadow.camera.bottom = -20
    scene.add(sun)

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x83aaa9, roughness: 0.33, metalness: 0.12 })
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 50, 1, 1), waterMat)
    water.rotation.x = -Math.PI / 2
    water.position.set(0, -0.32, 0)
    water.receiveShadow = true
    scene.add(water)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), material(0xd5d7c9))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(-1, -0.12, -2)
    ground.receiveShadow = true
    scene.add(ground)
    block(scene, 0xc5baa0, [-1, -0.02, 7.5], [34, 0.42, 1.2])
    block(scene, 0xb5aa92, [-1, -0.05, 6.82], [34, 0.3, 0.16])

    // Painted yard lanes and a striped quay safety edge.
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xe9e3ca })
    for (let i = 0; i < 7; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 20), laneMat)
      line.position.set(-11 + i * 3.3, -0.105, -2)
      scene.add(line)
    }
    for (let i = 0; i < 34; i++) block(scene, i % 2 ? 0xd9d0ae : 0xc98462, [-17 + i, 0.21, 6.9], [0.7, 0.035, 0.16])

    makeWarehouse(scene, -8.6, -5.1, 7, 4.6, 0x47787c, 'RYCORN')
    makeWarehouse(scene, -1, -6.1, 5.4, 3.8, 0x688d79, 'PORT 01')
    const colors = [0x3e7582, 0xc17857, 0x71917c, 0xd0a16b]
    const yardContainers: THREE.Group[] = []
    for (let i = 0; i < 4; i++) {
      const x = 3 + (i % 2) * 1.7
      const z = -6 + Math.floor(i / 2) * 1.2
      yardContainers.push(makeContainer(scene, x, 0, z, colors[i]))
      if (i < 2) makeContainer(scene, x, 1, z, colors[(i + 2) % colors.length])
    }
    for (let i = 0; i < 3; i++) makeContainer(scene, -10 + i * 1.55, 0, 2.1, colors[(i + 1) % colors.length])

    const cranes = [makeCrane(scene, 4.4, 2.2, 0xe3dfc9), makeCrane(scene, 10.7, 2.2, 0xe3dfc9)]
    const ship = makeShip(scene)
    const trucks = [makeTruck(scene, 0x3f6f91, 0.5), makeTruck(scene, 0xeee9d9, -2.3)]

    const buoys: THREE.Mesh[] = []
    for (let i = 0; i < 5; i++) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), material(0xd58a61))
      buoy.position.set(-9 + i * 4.5, -0.1, 10 + (i % 2) * 1.2)
      scene.add(buoy)
      buoys.push(buoy)
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: 0, y: 0 }
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    canvas.addEventListener('pointermove', onPointerMove)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const clock = new THREE.Clock()
    let animationId = 0
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()
      if (!reduceMotion) {
        waterMat.roughness = 0.3 + Math.sin(time * 0.75) * 0.035
        water.position.z = Math.sin(time * 0.42) * 0.035
        ship.position.y = 0.3 + Math.sin(time * 1.1) * 0.055
        ship.rotation.z = Math.sin(time * 0.8) * 0.009
        cranes.forEach(({ trolley, cable, spreader }, index) => {
          const phase = time * 0.55 + index * 1.8
          trolley.position.x = Math.sin(phase) * 0.82
          const lift = 1.1 + (Math.sin(phase * 0.72 + 1) + 1) * 0.82
          cable.scale.y = lift
          cable.position.y = 5.62 - lift / 2
          spreader.position.y = 5.62 - lift
        })
        trucks.forEach(({ group, wheels, startZ }, index) => {
          const cycle = (time * (index ? 0.72 : 0.93) + index * 0.52) % 1
          group.position.x = -11 + cycle * 19
          group.position.z = startZ + Math.sin(cycle * Math.PI * 2) * 0.14
          wheels.forEach(wheel => { wheel.rotation.z = -time * 2.8 })
        })
        yardContainers[0].position.y = Math.max(0, Math.sin(time * 0.55) * 0.08)
        buoys.forEach((buoy, index) => { buoy.position.y = -0.1 + Math.sin(time * 1.2 + index) * 0.045 })
        camera.position.x += (18 + pointer.x * 0.55 - camera.position.x) * 0.018
        camera.position.y += (18 - pointer.y * 0.38 - camera.position.y) * 0.018
        camera.lookAt(0, 1.1, 0)
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      observer.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(item => { item.dispose() })
        }
      })
      renderer.dispose()
    }
  }, [])

  return <canvas className="yard-canvas" ref={canvasRef} aria-label="Three dimensional animated port yard with moving cranes, trucks, and vessel" />
}
