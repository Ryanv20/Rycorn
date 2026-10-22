import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Carrier } from '../sim/sim'

const cache = new Map<string, CanvasTexture>()

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(...repeat)
  }
  cache.set(key, t)
  return t
}

/** Vertical corrugated metal stripes. */
export function corrugated(base: string, dark: string, light: string) {
  return make(`corr-${base}`, 64, 64, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, 64, 64)
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = dark
      g.fillRect(x, 0, 2, 64)
      g.fillStyle = light
      g.fillRect(x + 3, 0, 2, 64)
    }
  })
}

export function cardboard() {
  return make('cardboard', 256, 256, (g) => {
    g.fillStyle = '#e2b47a'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#d29f62'
    g.fillRect(0, 124, 256, 8)
    g.fillRect(124, 0, 8, 256)
    g.fillStyle = 'rgba(255,240,215,0.55)'
    g.fillRect(52, 0, 22, 256)
    g.fillRect(180, 0, 22, 256)
    g.strokeStyle = 'rgba(150,100,50,0.25)'
    g.lineWidth = 3
    g.strokeRect(2, 2, 252, 252)
  })
}

export function wrapped() {
  return make('wrapped', 256, 256, (g) => {
    g.fillStyle = '#2f6bed'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#2459d6'
    g.fillRect(0, 124, 256, 8)
    g.fillRect(124, 0, 8, 256)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = -256; i < 256; i += 64) {
      g.beginPath()
      g.moveTo(i, 256)
      g.lineTo(i + 30, 256)
      g.lineTo(i + 286, 0)
      g.lineTo(i + 256, 0)
      g.fill()
    }
  })
}

export function palletWood() {
  return make('pallet', 128, 128, (g) => {
    g.fillStyle = '#c9a272'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#e3c193'
    for (let x = 4; x < 128; x += 26) g.fillRect(x, 0, 18, 128)
  })
}

function logoMark(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(x, y - s)
  g.lineTo(x + s * 0.9, y - s * 0.5)
  g.lineTo(x + s * 0.9, y + s * 0.5)
  g.lineTo(x, y + s)
  g.lineTo(x - s * 0.9, y + s * 0.5)
  g.lineTo(x - s * 0.9, y - s * 0.5)
  g.closePath()
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.beginPath()
  g.moveTo(x, y - s)
  g.lineTo(x + s * 0.9, y - s * 0.5)
  g.lineTo(x, y)
  g.lineTo(x - s * 0.9, y - s * 0.5)
  g.closePath()
  g.fill()
}

export function trailerSide(c: Carrier) {
  return make(`trailer-${c.name}`, 1024, 360, (g) => {
    g.fillStyle = '#f7f8fc'
    g.fillRect(0, 0, 1024, 360)
    g.fillStyle = '#e7eaf3'
    for (let x = 0; x < 1024; x += 64) g.fillRect(x, 0, 3, 360)
    g.fillStyle = c.accent
    g.globalAlpha = 0.9
    g.beginPath()
    g.moveTo(0, 300)
    g.quadraticCurveTo(520, 250, 1024, 150)
    g.lineTo(1024, 210)
    g.quadraticCurveTo(520, 300, 0, 340)
    g.closePath()
    g.fill()
    g.globalAlpha = 1
    logoMark(g, 330, 150, 44, c.accent)
    g.fillStyle = '#1b2a55'
    g.font = '700 92px Inter, system-ui, sans-serif'
    g.textBaseline = 'middle'
    g.fillText(c.name, 395, 152)
  })
}

export function containerSide(color: string, label: string) {
  return make(`cont-${color}-${label}`, 512, 160, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = 'rgba(0,0,0,0.12)'
    for (let x = 0; x < 512; x += 16) g.fillRect(x, 0, 5, 160)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = '800 44px Inter, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 256, 82)
  })
}

export function windows(base: string) {
  return make(`win-${base}`, 128, 128, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#b9c7e6'
    for (let y = 14; y < 128; y += 32) for (let x = 10; x < 128; x += 30) g.fillRect(x, y, 18, 14)
  })
}

export function roofLogo(name: string) {
  return make(`roof-${name}`, 256, 256, (g) => {
    g.clearRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(255,255,255,0.95)'
    g.beginPath()
    g.arc(128, 128, 120, 0, Math.PI * 2)
    g.fill()
    logoMark(g, 128, 128, 64, '#2f6bed')
  })
}

export function signText(text: string, bg: string, fg: string) {
  return make(`sign-${text}-${bg}`, 512, 96, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 512, 96)
    g.fillStyle = fg
    g.font = '700 52px Inter, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 50)
  })
}
