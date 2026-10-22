import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
)
export const IconBox = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
)
export const IconTruck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
)
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 5v14M16 5v14" /></svg>
)
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m8 5 12 7-12 7z" /></svg>
)
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>
)
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
)
export const IconRotL = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
)
export const IconRotR = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
)
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
)
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 12 5 5 9-10" /></svg>
)
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
)
export const IconDoc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
)
export const IconPackage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16v13H4zM2 4h20v3H2zM10 11h4" /></svg>
)
export const IconForklift = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 18V9h6l3 5v4M13 18h2M16 4v14h5" /><circle cx="6.5" cy="18.5" r="1.5" /><circle cx="12" cy="18.5" r="1.5" /></svg>
)
export const IconDock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 21V8l9-5 9 5v13" /><path d="M7 21v-8h10v8M7 17h10" /></svg>
)
export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
)
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
)

/** Brand mark: isometric cube. */
export const Logo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M16 2 29 9v14l-13 7-13-7V9z" fill="#2f6bed" />
    <path d="M16 2 29 9l-13 7L3 9z" fill="#6f9bff" />
    <path d="M16 16v14l13-7V9z" fill="#1f4fc4" />
  </svg>
)
