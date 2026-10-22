import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowUpDown, Boxes, Check, Search, Ship, SlidersHorizontal, X } from 'lucide-react'
import { ASSET_CATALOG, type AssetCategory, type CatalogAsset } from '../../../../packages/scale-engine/src/assets'
import AssetModelPreview from './AssetModelPreview'

const categories: Array<'All assets' | AssetCategory> = ['All assets', 'Vessels', 'Cargo', 'Port equipment', 'City & roads', 'Bridge systems', 'Naval fleet', 'Environments']
type SceneInstance = { id: string; assetId: string; world: string; detail: string }
type FleetInstance = { vesselId: string; vesselType: string; status: string; locationName?: string }

function makePortInstances(): SceneInstance[] {
  const items: SceneInstance[] = []
  const add = (id: string, assetId: string, detail: string, world = 'Lekki port') => items.push({ id, assetId, world, detail })
  for (let i = 1; i <= 2; i++) add(`POLA-CARGO-${String(i).padStart(2, '0')}`, 'container-ship', 'Berth vessel')
  for (let i = 1; i <= 2; i++) add(`POLA-TUG-${String(i).padStart(2, '0')}`, 'harbor-tug', 'Harbor assist vessel')
  for (let i = 1; i <= 3; i++) add(`POLA-BARGE-${String(i).padStart(2, '0')}`, 'barge', 'Cargo barge with 6 deck containers')
  for (let i = 1; i <= 9; i++) add(`STS-CRANE-${String(i).padStart(2, '0')}`, 'sts-crane', 'Quay gantry')
  for (let i = 1; i <= 4; i++) add(`YARD-GANTRY-${String(i).padStart(2, '0')}`, 'rtg-crane', 'Container yard gantry')
  for (let i = 1; i <= 3; i++) add(`TERMINAL-GATE-${String(i).padStart(2, '0')}`, 'terminal-gate', 'Terminal entrance')
  for (let i = 1; i <= 9; i++) add(`PORT-BUILDING-${String(i).padStart(2, '0')}`, 'port-support-building', 'Terminal support building')
  for (let i = 1; i <= 36; i++) add(`QUAY-BOLLARD-${String(i).padStart(2, '0')}`, 'mooring-bollard', 'Mooring bollard')
  for (let i = 1; i <= 16; i++) add(`REEFER-POWER-${String(i).padStart(2, '0')}`, 'reefer-power-beacon', 'Reefer power status beacon')
  for (let i = 1; i <= 5; i++) add(`HARBOR-MARKER-${String(i).padStart(2, '0')}`, 'harbor-navigation-marker', 'Illuminated port approach marker')
  for (let i = 1; i <= 20; i++) add(`LEKKI-WAREHOUSE-${String(i).padStart(2, '0')}`, 'port-warehouse', 'Warehouse structure', 'Lekki city / warehouses')
  for (let i = 1; i <= 66; i++) add(`FL-${String(i).padStart(2, '0')}`, 'forklift', 'Simulation forklift', 'Lekki warehouse network')
  for (let i = 1; i <= 19; i++) add(`TRK-ROAD-${String(i).padStart(2, '0')}`, 'freight-truck', 'Initial moving road traffic', 'Lekki city roads')
  for (let i = 1; i <= 111; i++) add(`LEKKI-CITY-BUILDING-${String(i).padStart(3, '0')}`, 'lekki-city-building', 'Generated low-rise block building', 'Lekki city')
  for (let i = 1; i <= 76; i++) add(`LEKKI-ROAD-${String(i).padStart(3, '0')}`, 'city-road', 'Paved road segment with lane markings', 'Lekki city')
  for (let i = 1; i <= 17; i++) add(`LEKKI-ROAD-POLE-${String(i).padStart(2, '0')}`, 'street-light-sign', 'Road sign and night-responsive streetlight', 'Lekki city')
  for (let i = 1; i <= 660; i++) add(`LEKKI-TREE-${String(i).padStart(3, '0')}`, 'street-tree', 'Instanced street, yard or park tree', 'Lekki city')
  for (let i = 1; i <= 68; i++) add(`LEKKI-DOCK-${String(i).padStart(3, '0')}`, 'warehouse-dock', 'Warehouse loading bay', 'Lekki warehouse network')
  for (let i = 1; i <= 60; i++) add(`LEKKI-WH-PALLET-${String(i).padStart(3, '0')}`, 'warehouse-pallet-load', 'Static warehouse staging pallet', 'Lekki warehouse network')
  for (let i = 1; i <= 60; i++) add(`LEKKI-WH-CONTAINER-${String(i).padStart(3, '0')}`, 'iso-40-container', 'Warehouse yard container', 'Lekki warehouse network')
  for (let i = 1; i <= 57; i++) add(`LEKKI-LOT-CONTAINER-${String(i).padStart(3, '0')}`, 'iso-40-container', 'Container staged in roadside parking lot', 'Lekki city')
  for (let i = 1; i <= 54; i++) add(`LEKKI-SIDEWALK-${String(i).padStart(2, '0')}`, 'city-sidewalk', 'Road edge or city block pedestrian apron', 'Lekki city')
  for (let i = 1; i <= 19; i++) add(`LEKKI-TRUCK-YARD-${String(i).padStart(2, '0')}`, 'warehouse-yard', 'Paved truck / container staging lot', 'Lekki city')
  add('LEKKI-WORLD-GROUND-01', 'lekki-world-ground', 'Shared land, terminal apron and shoreline terrain', 'Lekki city and port')
  // Exact generated placements in the port environment: 2×48×3 yard boxes,
  // 18 apron boxes, 2×120 ship stow units, and 3×6 barge loads.
  for (let i = 1; i <= 288; i++) add(`YARD-ISO40-${String(i).padStart(3, '0')}`, 'iso-40-container', 'Terminal stack · one of 3 tiers')
  for (let i = 1; i <= 18; i++) add(`APRON-ISO40-${String(i).padStart(3, '0')}`, 'iso-40-container', 'Quayside loading apron')
  for (let ship = 1; ship <= 2; ship++) for (let i = 1; i <= 120; i++) add(`POLA-CARGO-${String(ship).padStart(2, '0')}-ISO40-${String(i).padStart(3, '0')}`, 'iso-40-container', 'Container ship deck stow')
  for (let barge = 1; barge <= 3; barge++) for (let i = 1; i <= 6; i++) add(`POLA-BARGE-${String(barge).padStart(2, '0')}-ISO40-${String(i).padStart(2, '0')}`, 'iso-40-container', 'Barge deck cargo')
  add('LEKKI-QUAY-01', 'quay-and-fenders', 'Shared berth edge')
  // Los Angeles port console scene assets: match its generated warehouse row,
  // quay cranes, tugboats, and individually-instanced yard container stacks.
  for (let i = 1; i <= 13; i++) add(`LA-WAREHOUSE-${String(i).padStart(2, '0')}`, 'port-warehouse', 'Port warehouse', 'Los Angeles port')
  for (let i = 1; i <= 6; i++) add(`STS-CRANE-${String(i).padStart(2, '0')}`, 'sts-crane', 'Animated ship-to-shore crane', 'Los Angeles port')
  for (let i = 1; i <= 2; i++) add(`PORT-TUG-${String(i).padStart(2, '0')}`, 'harbor-tug', 'Harbor tugboat', 'Los Angeles port')
  let laContainer = 0
  for (let row = 0; row < 8; row++) for (let column = 0; column < 26; column++) {
    if (row === 2 || row === 5 || (row + column) % 5 === 0) continue
    const tiers = 1 + ((row * 3 + column * 7) % 3)
    for (let level = 0; level < tiers; level++) {
      laContainer++
      add(`LA-YARD-ISO40-${String(laContainer).padStart(3, '0')}`, 'iso-40-container', `Container stack · row ${String(row + 1).padStart(2, '0')} · tier ${level + 1}`, 'Los Angeles port')
    }
  }
  return items
}
const PORT_INSTANCES = makePortInstances()

const vesselAssetId = (type: string) => {
  const normalized = type.toUpperCase()
  if (normalized.includes('TANKER')) return 'liquid-bulk-tanker'
  if (normalized.includes('BULK')) return 'general-cargo'
  if (normalized.includes('REEFER') || normalized.includes('CONTAINER')) return 'container-ship'
  return 'general-cargo'
}

function AssetPreview({ asset, color }: { asset: CatalogAsset; color: string }) {
  const hull = color
  const line = '#d3e5dc'
  return <div className={`asset-art asset-art-${asset.preview}`}>
    <span className="asset-art-index">{asset.id.toUpperCase().replace(/-/g, '.')}</span>
    <svg viewBox="0 0 420 220" role="img" aria-label={`${asset.name} preview`}>
      <defs>
        <linearGradient id={`sea-${asset.id}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#17424c" stopOpacity=".12"/><stop offset="1" stopColor="#061922" stopOpacity=".82"/></linearGradient>
        <linearGradient id={`metal-${asset.id}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={hull}/><stop offset="1" stopColor="#132b36"/></linearGradient>
        <pattern id={`ribs-${asset.id}`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M2 0v9M6 0v9" stroke="#e9f3eb" strokeOpacity=".25" strokeWidth="1"/></pattern>
      </defs>
      <path d="M0 167c43-14 77 14 121 0s78-14 122 0 78 14 122 0 38-9 55-4v57H0z" fill={`url(#sea-${asset.id})`} />
      <path d="M0 174c42-12 75 12 119 0s76-12 119 0 76 12 119 0 45-8 63-3" fill="none" stroke="#59bfb4" strokeOpacity=".43" strokeWidth="2" />
      {asset.preview === 'container' && <g transform="translate(70 34)">
        <path d="M34 38 254 18l50 22-224 24z" fill="#e4e4d6" fillOpacity=".34" stroke={line} strokeOpacity=".65"/>
        <path d="m80 64 224-24v87L80 151z" fill={`url(#metal-${asset.id})`} stroke={line} strokeOpacity=".65"/>
        <path d="m80 64 224-24v87L80 151z" fill={`url(#ribs-${asset.id})`} />
        <path d="M80 151 34 126V38l46 26z" fill={hull} stroke={line} strokeOpacity=".65"/>
        <path d="M34 38 80 64v87l-46-25z" fill={`url(#ribs-${asset.id})`} />
        <path d="m35 126 45 25 224-24" fill="none" stroke="#f3c973" strokeWidth="3" strokeOpacity=".8"/>
      </g>}
      {['ship', 'barge', 'tug', 'tanker'].includes(asset.preview) && <g>
        <path d={asset.preview === 'tug' ? 'M100 147h217l-22 30H124z' : asset.preview === 'barge' ? 'M54 143h318l-32 34H83z' : 'M42 143h334l-42 35H75z'} fill={`url(#metal-${asset.id})`} stroke={line} strokeOpacity=".72" strokeWidth="2" />
        {asset.preview === 'tanker' ? <g fill="#9eaa9c" stroke="#dce5d8" strokeOpacity=".55">{[112, 167, 222, 277].map(x => <g key={x}><ellipse cx={x} cy="108" rx="21" ry="8"/><path d={`M${x-21} 108v31c0 12 42 12 42 0v-31`} /><ellipse cx={x} cy="139" rx="21" ry="8" fill="#708781"/></g>)}</g> : asset.preview === 'barge' ? <g fill="#778b8c"><path d="M82 129h262v12H82z"/><path d="M95 122h230v6H95z"/></g> : asset.preview === 'tug' ? <g><path d="M176 104h64v39h-64z" fill="#e1e8d9"/><path d="M188 88h48v17h-48z" fill="#d8e7d7"/><path d="M193 93h10v9h-10zm15 0h10v9h-10z" fill="#193944"/></g> : <g>
          <path d="M258 99h49v45h-49z" fill="#e4e9df"/><path d="M268 75h41v24h-41z" fill="#d5e2dc"/><path d="M275 81h11v12h-11zm15 0h11v12h-11z" fill="#173541"/>
          {Array.from({ length: asset.id === 'container-ship' ? 12 : 6 }, (_, i) => <g key={i}><path d={`M${79 + (i % 6) * 29} ${100 + Math.floor(i / 6) * 22}h27v21H${79 + (i % 6) * 29}z`} fill={['#b6503f', '#345d83', '#c09743', '#477a68'][i % 4]} stroke="#e3e9de" strokeOpacity=".5"/><path d={`M${83 + (i % 6) * 29} ${101 + Math.floor(i / 6) * 22}v19m5-19v19m5-19v19`} stroke="#f4f0dc" strokeOpacity=".24"/></g>)}
        </g>}
        <path d="M71 149h268" stroke="#e4c47f" strokeWidth="3" strokeOpacity=".85"/>
        <path d="M42 143h334" stroke="#f4f3dd" strokeOpacity=".85"/>
        <circle cx="95" cy="183" r="2" fill="#d9b66d"/><circle cx="330" cy="183" r="2" fill="#d9b66d"/>
      </g>}
      {asset.preview === 'crane' && <g fill="none" stroke={hull} strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 165V53h244v112M79 165h265M106 67h213M153 54v104m135-104v104" strokeWidth="9"/>
        <path d="M245 53V29h109v24M269 29V16h53v13M267 67v63m34-63v63m-52 0h70" strokeWidth="5"/>
        <path d="M76 166h281" stroke="#f0cb74" strokeWidth="3"/>
        {[103, 319].map(x => <g key={x}><circle cx={x} cy="170" r="12" fill="#102b35" stroke={hull} strokeWidth="5"/><circle cx={x} cy="170" r="3" fill="#e5c57e"/></g>)}
      </g>}
      {asset.preview === 'warehouse' && <g>
        <path d="m78 75 133-40 132 40v91H78z" fill="#47616c" stroke="#bed0c9" strokeWidth="2"/>
        <path d="m70 77 141-51 141 51" fill="none" stroke={hull} strokeWidth="12"/>
        <path d="M93 87h236v79H93z" fill={hull} fillOpacity=".68"/>
        {[112, 161, 210, 259, 308].map(x => <path key={x} d={`M${x} 102h27v64h-27z`} fill="#112e39" stroke="#acc5c2" strokeOpacity=".6"/>)}
        <path d="M78 166h265" stroke="#e9c77b" strokeWidth="3"/>
      </g>}
      {asset.preview === 'bridge' && <g>
        <path d="M75 151h273l-25 26H98z" fill="#344853" stroke="#c7d8d1" strokeWidth="2"/>
        <path d="M137 88h151v62H137z" fill="#142c37" stroke={hull} strokeWidth="3"/>
        <path d="M123 75h179v13H123z" fill="#c2ccc4"/>
        {[145, 185, 225, 265].map(x => <g key={x}><path d={`M${x} 96h31v41h-31z`} fill="#347c8c" stroke="#a8d7d7"/><path d={`M${x+3} 130h25`} stroke="#77e5d0" strokeWidth="2"/></g>)}
        <path d="M150 67h124v8H150z" fill="#d6e2d9"/>
      </g>}
      {asset.preview === 'vehicle' && <g>
        <path d="M64 151h288v19H64z" fill="#354a52" stroke="#c8d5cf" strokeOpacity=".7"/>
        <path d="M127 103h85v48h-85z" fill={hull} stroke="#e2e8df" strokeOpacity=".7"/>
        <path d="m139 103 17-25h38l17 25" fill="#526b70" stroke="#d6e3db" strokeWidth="2"/>
        <path d="M161 84h29v17h-29z" fill="#193945" stroke="#83bbb5"/>
        <path d="M216 123h100v9H216z" fill="#aebdb4"/><path d="M308 104v44m12-52v52m-18-43h30m-31 32h31" stroke="#dbdfd3" strokeWidth="4"/>
        <path d="M316 105h48v35h-48z" fill="#52737b" stroke="#d9e3dc"/><path d="M326 111h27v21h-27z" fill="#1a3943"/>
        {[105, 151, 268, 320].map(x => <g key={x}><circle cx={x} cy="165" r="13" fill="#0a1b21" stroke="#647c7b" strokeWidth="4"/><circle cx={x} cy="165" r="4" fill="#d1b779"/></g>)}
      </g>}
      {asset.preview === 'tankfarm' && <g>
        {[103, 167, 231, 295].map((x, i) => <g key={x}><ellipse cx={x} cy={i % 2 ? 107 : 118} rx="25" ry="9" fill="#c5cdc2"/><path d={`M${x-25} ${i % 2 ? 107 : 118}v42c0 12 50 12 50 0v-${i % 2 ? 42 : 53}`} fill={hull} stroke="#dce5dc" strokeOpacity=".65"/><ellipse cx={x} cy={i % 2 ? 149 : 149} rx="25" ry="8" fill="#738781" stroke="#dce5dc" strokeOpacity=".6"/><path d={`M${x-18} ${i % 2 ? 107 : 118}h36`} stroke="#eff2e7" strokeOpacity=".55"/></g>)}
        <path d="M71 160h259m-228-9v19m64-19v19m64-19v19m64-19v19" stroke="#c39b63" strokeWidth="4"/>
        <path d="M94 91h213m-184-8v21m62-21v21m62-21v21" fill="none" stroke="#849893" strokeWidth="4"/>
      </g>}
      {asset.preview === 'terminal' && <g>
        <path d="M32 153h356v22H32z" fill={hull} stroke="#d5ddd4" strokeOpacity=".55"/>
        <path d="M44 143h332v10H44z" fill="#a8b3a9"/>
        {[62, 98, 134, 170, 206, 242, 278, 314, 350].map((x, i) => <g key={x}><path d={`M${x} 143v-13`} stroke="#283d3d" strokeWidth="4"/><circle cx={x} cy="127" r="4" fill="#d2b77c"/><path d={`M${x-8} 151h16`} stroke={i % 2 ? '#364c4b' : '#596d68'} strokeWidth="7"/></g>)}
        <path d="M32 180h356" stroke="#4ebba9" strokeOpacity=".7" strokeWidth="2"/>
        {[45, 81, 117, 153, 189, 225, 261, 297, 333, 369].map(x => <path key={x} d={`M${x} 184h15`} stroke="#75cfc0" strokeOpacity=".38" strokeWidth="2"/>)}
      </g>}
      {asset.preview === 'light' && <g>
        <path d="M112 166h196" stroke="#e1c273" strokeWidth="4"/>
        <path d="M206 162 221 42h9l15 120" fill="none" stroke={hull} strokeWidth="8"/>
        <path d="M190 45h71l-8 10h-55z" fill="#c5d3ca" stroke="#e1e7dc"/>
        <path d="M204 55h45l-12 32h-22z" fill="#ffe6a8" fillOpacity=".76"/>
        <path d="M178 70 92 110m140-40 101 42" stroke="#f6d78d" strokeOpacity=".19" strokeWidth="15"/>
        <path d="M215 162h22" stroke="#f2b967" strokeWidth="4"/>
      </g>}
      {asset.preview === 'ocean' && <g fill="none" stroke={hull} strokeWidth="5" strokeLinecap="round">
        {[0, 1, 2, 3].map(row => <path key={row} d={`M25 ${92 + row * 20}c24-14 45 14 69 0s45-14 69 0 45 14 69 0 45-14 69 0 45 14 69 0`} strokeOpacity={.78 - row * .12}/>)}
        <path d="M28 47h364" stroke="#e4c37a" strokeOpacity=".7" strokeDasharray="2 10" strokeWidth="2"/>
      </g>}
    </svg>
    <span className="asset-art-scale">{asset.dimensions.length.toLocaleString()} m <i /> {asset.dimensions.beam.toLocaleString()} m</span>
  </div>
}

export default function AssetCatalogPage({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof categories)[number]>('All assets')
  const [selectedColors, setSelectedColors] = useState<Record<string, number>>({})
  const [sort, setSort] = useState<'featured' | 'name'>('featured')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [libraryView, setLibraryView] = useState<'models' | 'instances'>('models')
  const [inspecting, setInspecting] = useState<{ asset: CatalogAsset; color: string } | null>(null)
  const [fleetInstances, setFleetInstances] = useState<FleetInstance[]>([])
  const [fleetOnline, setFleetOnline] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch('/simulation/navigation')
        if (!response.ok) throw new Error('Fleet unavailable')
        const data = await response.json()
        if (active) { setFleetInstances(data.vessels ?? []); setFleetOnline(true) }
      } catch { if (active) setFleetOnline(false) }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const assets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = ASSET_CATALOG.filter(asset => {
      const matchesCategory = category === 'All assets' || asset.category === category
      const searchable = [asset.name, asset.id, asset.category, asset.finish, asset.description, asset.source, ...asset.tags, ...asset.colors.map(color => color.name)].join(' ').toLowerCase()
      return matchesCategory && (!normalized || searchable.includes(normalized))
    })
    return sort === 'name' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered
  }, [category, query, sort])

  const instances = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const port = PORT_INSTANCES
    const fleet = fleetInstances.flatMap(vessel => {
      const assetId = vesselAssetId(vessel.vesselType)
      const entries: SceneInstance[] = [{ id: vessel.vesselId, assetId, world: 'Live simulation fleet', detail: `${vessel.vesselType} · ${vessel.status} · ${vessel.locationName ?? 'position unavailable'}` }]
      if (vessel.vesselType.toUpperCase().includes('CONTAINER')) {
        for (let i = 1; i <= 660; i++) entries.push({ id: `${vessel.vesselId}-ISO40-${String(i).padStart(3, '0')}`, assetId: 'iso-40-container', world: `Captain simulator · ${vessel.vesselId}`, detail: 'Rendered onboard container stow' })
      }
      return entries
    })
    const all = [...port, ...fleet]
    return all.filter(instance => {
      const model = ASSET_CATALOG.find(asset => asset.id === instance.assetId)
      const categoryMatch = category === 'All assets' || model?.category === category
      return categoryMatch && (!normalized || `${instance.id} ${instance.assetId} ${instance.world} ${instance.detail}`.toLowerCase().includes(normalized))
    })
  }, [category, fleetInstances, query])

  return <main className="asset-catalog-page">
    <header className="asset-catalog-topline">
      <button className="page-back" onClick={onBack}><ArrowLeft size={16} /> Operations</button>
      <span className="asset-catalog-brand"><Boxes size={15} /> RYCORN / ASSET LIBRARY</span>
      <span className="asset-catalog-topline-meta">SHARED SCALE REGISTRY <i /></span>
    </header>
    <section className="asset-catalog-hero">
      <div className="asset-catalog-heading">
        <div><p className="eyebrow">FLEET · CARGO · TERMINAL · ENVIRONMENT</p><h1>Models, all in one place.</h1><p>Browse the scene assets, check their physical footprint and flip through the livery options used across Rycorn.</p></div>
        <div className="asset-catalog-total"><span>{ASSET_CATALOG.length.toString().padStart(2, '0')}</span><small>REGISTERED<br/>ASSETS</small></div>
      </div>
      <div className="asset-catalog-toolbar">
        <label className="asset-catalog-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ships, cargo, materials, colour…" aria-label="Search asset catalog" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}<kbd>/</kbd></label>
        <button className={`asset-filter-toggle ${filtersOpen ? 'is-active' : ''}`} onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}><SlidersHorizontal size={15}/> Filters <span>{category === 'All assets' ? 'ALL' : '01'}</span></button>
        <label className="asset-sort-control"><ArrowUpDown size={14}/><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="Sort assets"><option value="featured">Featured</option><option value="name">Name A–Z</option></select></label>
      </div>
      <nav className={`asset-category-tabs ${filtersOpen ? 'is-open' : ''}`} aria-label="Filter by asset category">
        {categories.map((item, index) => <button key={item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}<small>{index === 0 ? ASSET_CATALOG.length : ASSET_CATALOG.filter(asset => asset.category === item).length}</small></button>)}
      </nav>
      <div className="asset-library-views" role="tablist" aria-label="Asset library view">
        <button role="tab" aria-selected={libraryView === 'models'} className={libraryView === 'models' ? 'is-active' : ''} onClick={() => setLibraryView('models')}>MODEL LIBRARY <b>{ASSET_CATALOG.length}</b></button>
        <button role="tab" aria-selected={libraryView === 'instances'} className={libraryView === 'instances' ? 'is-active' : ''} onClick={() => setLibraryView('instances')}>SCENE INSTANCES <b>{(PORT_INSTANCES.length + fleetInstances.length + fleetInstances.filter(item => item.vesselType.toUpperCase().includes('CONTAINER')).length * 660).toLocaleString()}</b></button>
      </div>
    </section>

    <section className="asset-catalog-results">
      <header className="asset-results-heading"><div><span className="asset-results-marker"><Ship size={14}/></span><div><h2>{libraryView === 'models' ? category : 'Placed scene instances'}</h2><small>{libraryView === 'models' ? 'MODEL TYPES · SCALE IN METRES' : `LEKKI PORT + ${fleetOnline ? 'LIVE' : 'CACHED'} FLEET · INDIVIDUAL PLACEMENTS` } <i /> {libraryView === 'models' ? 'SOURCE FILES INCLUDED' : 'SEARCHABLE INSTANCE IDS'}</small></div></div><span>{(libraryView === 'models' ? assets.length : instances.length).toLocaleString()} RESULTS</span></header>
      {libraryView === 'models' ? assets.length === 0 ? <div className="asset-catalog-empty"><Search size={22}/><strong>No matching assets</strong><span>Try a different search term or category.</span><button onClick={() => { setQuery(''); setCategory('All assets') }}>Clear filters</button></div> : <div className="asset-product-grid">
        {assets.map((asset, index) => {
          const selected = Math.min(selectedColors[asset.id] ?? 0, asset.colors.length - 1)
          const variant = asset.colors[selected]
          return <article className="asset-product-card" key={asset.id} onDoubleClick={() => setInspecting({ asset, color: variant.hex })} title="Double-click to inspect this asset in 3D">
            <AssetPreview asset={asset} color={variant.hex}/>
            <div className="asset-card-content">
              <div className="asset-card-kicker"><span>{asset.category.toUpperCase()}</span><span>#{String(index + 1).padStart(2, '0')}</span></div>
              <div className="asset-card-title"><h3>{asset.name}</h3><small>{asset.source === 'OBJ source model' ? 'OBJ' : asset.source === 'FBX source model' ? 'FBX' : asset.source === 'Blender source model' ? 'BLEND' : 'SCENE'}</small></div>
              <p className="asset-card-description">{asset.description}</p>
              <div className="asset-card-specs"><span><small>LENGTH</small><b>{asset.dimensions.length.toLocaleString()} <i>m</i></b></span><span><small>BEAM</small><b>{asset.dimensions.beam.toLocaleString()} <i>m</i></b></span><span><small>HEIGHT</small><b>{asset.dimensions.height.toLocaleString()} <i>m</i></b></span></div>
              <div className="asset-finish"><span>FINISH</span><b>{asset.finish}</b></div>
              {asset.sourceUrl && <a className="asset-source-download" href={asset.sourceUrl} download>DOWNLOAD ORIGINAL {asset.source === 'Blender source model' ? 'BLENDER' : asset.source === 'FBX source model' ? 'FBX' : 'OBJ'} FILE ↗</a>}
              {asset.sourceMtlUrl && <a className="asset-source-download" href={asset.sourceMtlUrl} download>DOWNLOAD MATERIAL FILE (.MTL) ↗</a>}
              <div className="asset-card-colors"><div><span className="asset-color-current" style={{ '--swatch': variant.hex, background: variant.hex } as CSSProperties}/><b>{variant.name}</b></div><span className="asset-color-count">{asset.colors.length} LIVERIES</span></div>
              <button className="asset-inspect-button" onClick={() => setInspecting({ asset, color: variant.hex })}>INSPECT IN 3D <span>↗</span></button>
              <div className="asset-swatch-row" role="group" aria-label={`${asset.name} color options`}>
                {asset.colors.map((color, colorIndex) => <button key={color.name} className={`asset-swatch ${selected === colorIndex ? 'is-selected' : ''}`} style={{ '--swatch': color.hex } as CSSProperties} onClick={() => setSelectedColors(current => ({ ...current, [asset.id]: colorIndex }))} title={color.name} aria-label={`Use ${color.name}`} aria-pressed={selected === colorIndex}>{selected === colorIndex && <Check size={12}/>}</button>)}
              </div>
            </div>
          </article>
        })}
      </div> : instances.length === 0 ? <div className="asset-catalog-empty"><Search size={22}/><strong>No matching scene instances</strong><span>Try a different ID, vessel type, or location.</span><button onClick={() => { setQuery(''); setCategory('All assets') }}>Clear filters</button></div> : <div className="asset-instance-list">{instances.map(instance => {
        const model = ASSET_CATALOG.find(asset => asset.id === instance.assetId)
        if (!model) return null
        const colorIndex = selectedColors[model.id] ?? 0
        return <article className="asset-instance-row" key={`${instance.world}:${instance.id}`}>
          <span className="asset-instance-swatch" style={{ background: model.colors[colorIndex]?.hex ?? '#467c7b' }}/>
          <div className="asset-instance-identity"><b>{instance.id}</b><span>{model.name} · {instance.detail}</span></div>
          <span className="asset-instance-world">{instance.world}</span>
          <button onClick={() => setInspecting({ asset: model, color: model.colors[colorIndex]?.hex ?? '#467c7b' })}>VIEW 3D ↗</button>
        </article>
      })}</div>}
      <footer className="asset-catalog-foot"><span>SHARED ASSET REGISTRY</span><span>{libraryView === 'models' ? `${assets.length} OF ${ASSET_CATALOG.length} MODELS` : `${instances.length.toLocaleString()} INDIVIDUAL INSTANCES`} <i /></span></footer>
    </section>
    {inspecting && <div className="asset-inspect-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setInspecting(null) }}>
      <section className="asset-inspect-dialog" role="dialog" aria-modal="true" aria-label={`${inspecting.asset.name} 3D preview`}>
        <header><div><small>LIVE 3D PREVIEW</small><h2>{inspecting.asset.name}</h2><p>{inspecting.asset.dimensions.length} m × {inspecting.asset.dimensions.beam} m × {inspecting.asset.dimensions.height} m · drag to orbit · scroll to zoom</p></div><button onClick={() => setInspecting(null)} aria-label="Close 3D preview"><X size={20}/></button></header>
        <AssetModelPreview asset={inspecting.asset} color={inspecting.color}/>
      </section>
    </div>}
  </main>
}
