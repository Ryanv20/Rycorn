import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { sim, whById, truckById, forkliftById, slotById, dispatchIntercityTransfer } from '../sim/sim'
import type { Truck, Forklift, Warehouse } from '../sim/sim'
import type { ItemIcon } from '../sim/world'
import { useUI } from '../store'
import {
  IconSearch, IconBell, IconBox, IconTruck, IconClock, IconPlus, IconMinus, IconRotL, IconRotR, IconHome,
  IconChevron, IconChevronDown, IconCheck, IconX, IconTarget, IconDoc, IconPackage, IconForklift, IconDock,
  IconGrid, IconPause, IconPlay, IconLayers, IconSun, Logo,
} from './icons'

// ───────────── helpers

const fmt = (n: number) => n.toLocaleString('en-US')
const clock = (min: number) => {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function whStats(w: Warehouse) {
  const trucks = sim.trucks.filter((t) => t.whId === w.id)
  const docked = trucks.filter((t) => t.state === 'loading' || t.state === 'unloading' || t.state === 'ready').length
  const arriving = trucks.filter((t) => t.state === 'enroute' || (t.state === 'transit' && t.transferPhase === 'road')).length
  const staged = sim.slots.filter((s) => s.whId === w.id && s.filled).length
  const onSite = trucks.filter((t) => t.state === 'loading' || t.state === 'unloading' || t.state === 'ready').length
  const inbound = trucks.filter((t) => (t.state === 'enroute' || (t.state === 'transit' && t.transferPhase === 'road')) && t.mode === 'unload').length
  const fl = sim.forklifts.filter((f) => f.whId === w.id)
  const working = fl.filter((f) => f.phase === 'working').length
  return { docked, arriving, staged, onSite, inbound, fl, working, fill: w.stock / w.capacity }
}

type Tone = 'green' | 'amber' | 'blue' | 'grey' | 'red'
const Chip = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`chip chip-${tone}`}>{children}</span>

export function truckStatus(t: Truck): { label: string; tone: Tone } {
  if (t.transferPhase === 'road') return { label: 'Between cities', tone: 'blue' }
  if (t.transferPhase === 'pickup') return { label: 'Transfer pickup', tone: 'amber' }
  if (t.transferPhase === 'delivery') return { label: 'Transfer delivery', tone: 'green' }
  switch (t.state) {
    case 'enroute':
      return t.pos.z < -6 ? { label: 'Docking', tone: 'grey' } : { label: 'En route', tone: 'blue' }
    case 'loading':
      return { label: 'Loading', tone: 'green' }
    case 'unloading':
      return { label: 'Unloading', tone: 'green' }
    case 'ready':
      return { label: 'Ready', tone: 'green' }
    case 'departing':
      return { label: 'Departing', tone: 'blue' }
    default:
      return { label: 'In transit', tone: 'grey' }
  }
}

function forkStatus(f: Forklift): { label: string; tone: Tone } {
  if (f.phase === 'charging') return { label: 'Charging', tone: 'amber' }
  if (f.phase === 'waiting') return { label: 'Waiting', tone: 'amber' }
  if (f.phase === 'idle') return { label: 'Idle', tone: 'grey' }
  if (f.status.startsWith('Loading')) return { label: 'Loading', tone: 'green' }
  if (f.status.startsWith('Unloading')) return { label: 'Unloading', tone: 'green' }
  return { label: 'Moving', tone: 'blue' }
}

const Bar = ({ value, tone = 'blue' }: { value: number; tone?: Tone }) => (
  <div className="bar">
    <div className={`bar-fill bar-${tone}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
  </div>
)

const remainingMin = (t: Truck) => {
  if (t.state === 'enroute' || (t.state === 'transit' && t.transferPhase === 'road')) return Math.max(1, Math.round(((t.path.length * 0.4) / 12) * 0.5 + 0.5))
  if (t.state === 'loading') return (t.cap - t.cargo) * 2 + 1
  if (t.state === 'unloading') return t.cargo * 2 + 1
  return 0
}

const ITEM_COLORS: Record<ItemIcon, string> = {
  box: '#e2b47a', blue: '#2f6bed', helmet: '#f6b40e', tape: '#d9b48a', chair: '#3d4458', panel: '#cfd8ea',
  gloves: '#5b8def', peas: '#5fbf6a', water: '#62b6ec',
}
const ItemGlyph = ({ icon }: { icon: ItemIcon }) => (
  <span className="item-glyph" style={{ background: `${ITEM_COLORS[icon]}22` }}>
    <span style={{ background: ITEM_COLORS[icon] }} className={`item-dot item-${icon}`} />
  </span>
)

// ───────────── top bar

export function TopBar() {
  useUI((s) => s.tick)
  const paused = useUI((s) => s.paused)
  const setPaused = useUI((s) => s.setPaused)
  const dayNightEnabled = useUI((s) => s.dayNightEnabled)
  const setDayNightEnabled = useUI((s) => s.setDayNightEnabled)
  const layers = useUI((s) => s.layers)
  const setLayer = useUI((s) => s.setLayer)
  const setAllLayers = useUI((s) => s.setAllLayers)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const select = useUI((s) => s.select)
  const setActive = useUI((s) => s.setActiveWh)
  const results = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return []
    const out: { key: string; label: string; sub: string; go: () => void }[] = []
    for (const w of sim.warehouses)
      if (`${w.name} ${w.code}`.toLowerCase().includes(k)) out.push({ key: w.id, label: w.name, sub: `Site · ${w.code}`, go: () => setActive(w.id) })
    for (const t of sim.trucks)
      if (`${t.id} ${t.carrier.name} ${t.shipment}`.toLowerCase().includes(k))
        out.push({ key: t.id, label: t.id, sub: `${t.carrier.name} · ${truckStatus(t).label}`, go: () => select({ type: 'truck', id: t.id }) })
    for (const f of sim.forklifts)
      if (f.id.toLowerCase().includes(k)) out.push({ key: f.id, label: f.id, sub: `Forklift · ${f.whId}`, go: () => select({ type: 'forklift', id: f.id }) })
    for (const x of sim.intercityTransfers) {
      const from = whById(x.fromWhId)
      const to = whById(x.toWhId)
      if (`${x.id} ${from.code} ${to.code} ${from.name} ${to.name}`.toLowerCase().includes(k)) {
        out.push({
          key: x.id,
          label: x.id,
          sub: `${from.code} → ${to.code} · City transfer`,
          go: () => {
            const t = truckById(x.truckId)
            if (t) select({ type: 'truck', id: t.id })
            else setActive(to.id)
          },
        })
      }
    }
    return out.slice(0, 7)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sim.version])

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span>AnyMile</span>
      </div>
      <div className="search">
        <IconSearch className="muted" />
        <input
          placeholder="Search sites, trucks, forklifts, pallets, shipments…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <kbd>/</kbd>
        {open && results.length > 0 && (
          <div className="search-results card">
            {results.map((r) => (
              <button key={r.key} onMouseDown={() => { r.go(); setQ('') }}>
                <b>{r.label}</b>
                <span>{r.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <SiteSelect />
      <div className="topbar-popover-wrap">
        <button className={`icon-btn layer-toggle ${layersOpen ? 'on' : ''}`} onClick={() => setLayersOpen((value) => !value)} aria-label="Layers" aria-expanded={layersOpen} title="Layers">
          <IconLayers /><span>Layers</span>
        </button>
        {layersOpen && <div className="layers-menu card">
          <div className="layers-menu-head"><b>Scene layers</b><button onClick={() => setAllLayers(false)}>Clear all</button></div>
          <div className="layers-section-label">3D scene</div>
          {([
            ['city', 'Cities and roads'],
            ['port', 'Port'],
            ['warehouses', 'Warehouses'],
            ['vehicles', 'Trucks and forklifts'],
          ] as const).map(([key, label]) => <label className="layer-row" key={key}>
            <input type="checkbox" checked={layers[key]} onChange={(event) => setLayer(key, event.target.checked)} />
            <span>{label}</span>
          </label>)}
          <div className="layers-section-label">On-screen panels</div>
          {([
            ['kpis', 'Summary cards'],
            ['infoPanel', 'Network / details panel'],
            ['shipmentTracking', 'Shipment tracking'],
            ['fleetPanel', 'Docks and fleet panel'],
            ['cameraControls', 'Camera controls'],
          ] as const).map(([key, label]) => <label className="layer-row" key={key}>
            <input type="checkbox" checked={layers[key]} onChange={(event) => setLayer(key, event.target.checked)} />
            <span>{label}</span>
          </label>)}
          <button className="layers-show-all" onClick={() => setAllLayers(true)}>Show all layers</button>
        </div>}
      </div>
      <button className={`icon-btn day-night-toggle ${dayNightEnabled ? 'on' : ''}`} onClick={() => setDayNightEnabled(!dayNightEnabled)} title={dayNightEnabled ? 'Pause day/night cycle' : 'Resume day/night cycle'} aria-label={dayNightEnabled ? 'Pause day and night cycle' : 'Resume day and night cycle'}>
        <IconSun /><span>Day/night</span>
      </button>
      <div className={`live ${paused ? 'is-paused' : ''}`}>
        <span className="live-dot" /> {paused ? 'Paused' : 'Live'} <b>{clock(sim.time)}</b>
      </div>
      <button
        className={`icon-btn engine-toggle ${paused ? 'paused' : ''}`}
        onClick={() => setPaused(!paused)}
        title={paused ? 'Resume simulation' : 'Pause simulation'}
        aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
      >
        {paused ? <IconPlay /> : <IconPause />}
      </button>
      <button className="icon-btn bell">
        <IconBell />
        <span className="badge-dot" />
      </button>
      <div className="user">
        <div className="avatar">CB</div>
        <div>
          <b>Cahit Berkay</b>
          <span>Operations Manager</span>
        </div>
        <IconChevronDown className="muted" />
      </div>
    </header>
  )
}

function SiteSelect() {
  const active = useUI((s) => s.activeWh)
  const setActive = useUI((s) => s.setActiveWh)
  const [open, setOpen] = useState(false)
  const w = active === 'all' ? null : whById(active)
  const idx = sim.warehouses.findIndex((x) => x.id === active)
  const st = w ? whStats(w) : null
  const step = (d: number) => {
    const n = sim.warehouses.length
    const i = idx < 0 ? 0 : (idx + d + n) % n
    setActive(sim.warehouses[i].id)
  }
  return (
    <div className="site-select">
      <button className="site-main" onClick={() => setOpen((o) => !o)}>
        <span className="code">{w ? w.code : 'ALL'}</span>
        <span className="site-text">
          <b>{w ? w.name : 'Network overview'}</b>
          <span>{w && st ? `${Math.round(st.fill * 100)}% full · ${st.docked}/${w.docks} docked` : `${sim.warehouses.length} sites`}</span>
        </span>
      </button>
      <button className="site-step" onClick={() => step(1)} title="Next site">
        <IconChevron />
      </button>
      <button className="site-step" onClick={() => setOpen((o) => !o)}>
        <IconChevronDown />
      </button>
      {open && (
        <div className="site-menu card" onMouseLeave={() => setOpen(false)}>
          <div className="menu-label">Network overview</div>
          <button
            className={`site-row ${active === 'all' ? 'on' : ''}`}
            onClick={() => {
              setActive('all')
              setOpen(false)
            }}
          >
            <span className="code code-dark">
              <IconGrid width={14} height={14} />
            </span>
            <span className="site-text">
              <b>All sites</b>
              <span>Zoom out to all {sim.warehouses.length} sites</span>
            </span>
          </button>
          {sim.warehouses.map((x) => {
            const s = whStats(x)
            return (
              <button
                key={x.id}
                className={`site-row ${active === x.id ? 'on' : ''}`}
                onClick={() => {
                  setActive(x.id)
                  setOpen(false)
                }}
              >
                <span className="code">{x.code}</span>
                <span className="site-text">
                  <b>{x.name}</b>
                  <span>
                    {s.docked}/{x.docks} docked · {s.arriving} inbound
                  </span>
                </span>
                <span className="site-fill">
                  <b>{Math.round(s.fill * 100)}%</b>
                  <Bar value={s.fill} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ───────────── KPIs

export function Kpis() {
  useUI((s) => s.tick)
  const visible = useUI((s) => s.layers.kpis)
  const active = useUI((s) => s.activeWh)
  const list = active === 'all' ? sim.warehouses : [whById(active)]
  const stock = list.reduce((a, w) => a + w.stock, 0)
  const onSite = list.reduce((a, w) => a + whStats(w).onSite, 0)
  const inbound = list.reduce((a, w) => a + whStats(w).arriving, 0)
  const onTime = list.reduce((a, w) => a + w.onTime, 0) / list.length
  const tag = active === 'all' ? 'all sites' : active
  if (!visible) return null
  return (
    <div className="kpis">
      <Kpi icon={<IconBox />} label="Stock on hand" value={fmt(stock)} delta="+15" sub={`pallets · ${tag}`} />
      <Kpi icon={<IconTruck />} label="Trucks on site" value={String(onSite)} delta={`+${inbound}`} sub={`${inbound} inbound · ${tag}`} />
      <Kpi icon={<IconClock />} label="On-time delivery" value={`${onTime.toFixed(1)}%`} delta="+0.4%" sub={`last 30 days · ${tag}`} />
    </div>
  )
}

const Kpi = ({ icon, label, value, delta, sub }: { icon: ReactNode; label: string; value: string; delta: string; sub: string }) => (
  <div className="card kpi">
    <div className="kpi-icon">{icon}</div>
    <div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value} <span className="delta">↑ {delta}</span>
      </div>
      <div className="kpi-sub">{sub}</div>
    </div>
  </div>
)

// ───────────── camera toolbar

export function CamToolbar() {
  const cam = useUI((s) => s.cam)
  const visible = useUI((s) => s.layers.cameraControls)
  if (!visible) return null
  return (
    <div className="card cam-toolbar">
      <button title="Zoom in" onClick={() => cam({ kind: 'zoom', dir: 1 })}><IconPlus /></button>
      <button title="Zoom out" onClick={() => cam({ kind: 'zoom', dir: -1 })}><IconMinus /></button>
      <span className="sep" />
      <button title="Rotate left" onClick={() => cam({ kind: 'rotate', dir: 1 })}><IconRotL /></button>
      <button title="Rotate right" onClick={() => cam({ kind: 'rotate', dir: -1 })}><IconRotR /></button>
      <button title="Reset view" onClick={() => cam({ kind: 'home' })}><IconHome /></button>
    </div>
  )
}

// ───────────── right panel

export function SidePanel() {
  useUI((s) => s.tick)
  const visible = useUI((s) => s.layers.infoPanel)
  const sel = useUI((s) => s.selected)
  const active = useUI((s) => s.activeWh)
  if (!visible) return null
  if (sel?.type === 'truck' && truckById(sel.id)) return <TruckDetail t={truckById(sel.id)!} />
  if (sel?.type === 'forklift' && forkliftById(sel.id)) return <ForkliftDetail f={forkliftById(sel.id)!} />
  if (sel?.type === 'slot' && slotById(sel.id)) return <SlotDetail id={sel.id} />
  if (active === 'all') return <NetworkDetail />
  return <WarehouseDetail w={whById(active)} />
}

function PanelHead({ kicker, title, sub, icon, actions }: { kicker: string; title: string; sub: string; icon: ReactNode; actions?: ReactNode }) {
  return (
    <div className="panel-head">
      <div className="panel-icon">{icon}</div>
      <div className="panel-titles">
        <div className="kicker">{kicker}</div>
        <div className="panel-title">{title}</div>
        <div className="panel-sub">{sub}</div>
      </div>
      <div className="panel-actions">{actions}</div>
    </div>
  )
}

function CloseBtn() {
  const select = useUI((s) => s.select)
  return (
    <button className="icon-btn sm" onClick={() => select(null)} title="Close">
      <IconX />
    </button>
  )
}

function WarehouseDetail({ w }: { w: Warehouse }) {
  const s = whStats(w)
  const select = useUI((st) => st.select)
  return (
    <aside className="card side">
      <PanelHead
        kicker={`${w.kind} · ${w.code}`}
        title={w.name}
        sub={w.address}
        icon={<IconDock />}
        actions={<button className="icon-btn sm"><IconPlus /></button>}
      />
      <div className="row gap">
        <Chip tone="green">Operational</Chip>
        <span className="muted small">
          {s.docked} docked · {s.arriving} arriving · {s.staged} staged
        </span>
      </div>
      <div className="tiles">
        <div className="tile">
          <span>Stock on hand</span>
          <b>
            {fmt(w.stock)} <small>/ {fmt(w.capacity)}</small>
          </b>
          <Bar value={s.fill} />
        </div>
        <div className="tile">
          <span>Truck bays</span>
          <b>
            {s.docked} <small>/ {w.docks} busy</small>
          </b>
          <Bar value={s.docked / w.docks} tone="green" />
        </div>
        <div className="tile">
          <span>Outbound today</span>
          <b>
            {w.outbound} <small>trucks</small>
          </b>
        </div>
        <div className="tile">
          <span>Put-aways today</span>
          <b>
            {w.putaways} <small>pallets</small>
          </b>
        </div>
      </div>
      <div className="section-head">
        <b>Inventory</b>
        <span>units</span>
      </div>
      <div className="list">
        {w.inventory.map((i) => (
          <div className="list-row" key={i.name}>
            <ItemGlyph icon={i.icon} />
            <span className="grow">{i.name}</span>
            <b className="num">{fmt(i.qty)}</b>
            {i.qty < i.low ? <Chip tone="amber">Low Stock</Chip> : <Chip tone="green">In Stock</Chip>}
          </div>
        ))}
      </div>
      <div className="section-head">
        <b>Forklift fleet</b>
        <span>
          {s.working}/{s.fl.length} working
        </span>
      </div>
      <div className="list">
        {s.fl.map((f) => (
          <button className="list-row link" key={f.id} onClick={() => select({ type: 'forklift', id: f.id })}>
            <b className="mono">{f.id}</b>
            <span className="grow ellipsis">{f.status}</span>
            <span className="mini-bar">
              <Bar value={f.battery / 100} tone={f.battery < 25 ? 'amber' : 'green'} />
            </span>
            <span className="num small">{Math.round(f.battery)}%</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function NetworkDetail() {
  const setActive = useUI((s) => s.setActiveWh)
  const total = sim.warehouses.reduce((a, w) => a + w.stock, 0)
  const cap = sim.warehouses.reduce((a, w) => a + w.capacity, 0)
  return (
    <aside className="card side">
      <PanelHead kicker="Network" title="All sites" sub={`Port network · ${sim.warehouses.length} sites`} icon={<IconGrid />} />
      <div className="tiles">
        <div className="tile">
          <span>Network stock</span>
          <b>
            {fmt(total)} <small>/ {fmt(cap)}</small>
          </b>
          <Bar value={total / cap} />
        </div>
        <div className="tile">
          <span>Trucks on road</span>
          <b>{sim.trucks.filter((t) => t.state === 'transit' || t.state === 'enroute').length}</b>
        </div>
      </div>
      <div className="section-head">
        <b>Sites</b>
        <span>fill</span>
      </div>
      <div className="list">
        {sim.warehouses.map((w) => {
          const s = whStats(w)
          return (
            <button className="list-row link" key={w.id} onClick={() => setActive(w.id)}>
              <span className="code">{w.code}</span>
              <span className="grow">
                <b>{w.name}</b>
                <span className="muted small block">
                  {s.docked}/{w.docks} docked · {s.arriving} inbound
                </span>
              </span>
              <span className="mini-bar">
                <Bar value={s.fill} />
              </span>
              <span className="num small">{Math.round(s.fill * 100)}%</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function TruckDetail({ t }: { t: Truck }) {
  const st = truckStatus(t)
  const follow = useUI((s) => s.follow)
  const setFollow = useUI((s) => s.setFollow)
  const w = t.whId ? whById(t.whId) : null
  const progress = t.mode === 'load' ? t.cargo / t.cap : (t.cap - t.cargo) / t.cap
  const rows: [string, ReactNode][] = [
    ['Shipment', <span className="link-text">{t.shipment}</span>],
    ['Customer', t.customer],
    ['Destination', w && t.mode === 'unload' ? `${w.code} ${w.name}` : t.city],
    ['ETA', t.state === 'transit' ? '—' : `${t.state === 'enroute' ? 'Dock' : 'Done'} in ${remainingMin(t)} min`],
    ['Speed', `${Math.round(t.speed * 6)} km/h`],
    ['Bay', w && t.dock !== undefined ? `In ${t.dock + 1} · ${w.code}` : '—'],
    ['Cargo', `${t.cargo}/${t.cap} pallets · ${(t.cargo * 0.21).toFixed(2)} t`],
    ['Plate', t.plate],
  ]
  return (
    <aside className="card side">
      <PanelHead
        kicker={t.carrier.fullName}
        title={t.id}
        sub={`${t.driver} · ${t.plate}`}
        icon={<IconTruck />}
        actions={
          <>
            <button className={`icon-btn sm ${follow ? 'on' : ''}`} title="Follow" onClick={() => setFollow(!follow)}>
              <IconTarget />
            </button>
            <CloseBtn />
          </>
        }
      />
      <div className="row gap">
        <Chip tone={st.tone}>{st.label}</Chip>
        <span className="muted small">
          {w ? `${w.code} · ${t.dock !== undefined ? `In ${t.dock + 1}` : ''} · ` : ''}
          {t.cargo}/{t.cap} pallets
        </span>
      </div>
      {w && (
        <div className="progress-line">
          <Bar value={progress} tone="green" />
          <span className="small muted">
            {t.mode === 'load' ? t.cargo : t.cap - t.cargo}/{t.cap}
          </span>
        </div>
      )}
      <div className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ForkliftDetail({ f }: { f: Forklift }) {
  const st = forkStatus(f)
  const w = whById(f.whId)
  const select = useUI((s) => s.select)
  const t = truckById(f.truckId)
  return (
    <aside className="card side">
      <PanelHead kicker={`Forklift · ${w.code}`} title={f.id} sub={`Operator ${f.operator} · Electric 2.5 t`} icon={<IconForklift />} actions={<CloseBtn />} />
      <div className="row gap">
        <Chip tone={st.tone}>{st.label}</Chip>
        <span className="muted small ellipsis">{f.status}</span>
      </div>
      <div className="tiles">
        <div className="tile">
          <span>Battery</span>
          <b>{Math.round(f.battery)}%</b>
          <Bar value={f.battery / 100} tone={f.battery < 25 ? 'amber' : 'green'} />
        </div>
        <div className="tile">
          <span>Fork height</span>
          <b>
            {(f.lift * 1.2).toFixed(1)} <small>m</small>
          </b>
        </div>
      </div>
      <div className="kv">
        <div>
          <span>Site</span>
          <b>{w.name}</b>
        </div>
        <div>
          <span>Load</span>
          <b>{f.carrying ? '1 pallet' : 'Empty'}</b>
        </div>
        <div>
          <span>Assigned truck</span>
          <b>
            {t ? (
              <button className="link-text" onClick={() => select({ type: 'truck', id: t.id })}>
                {t.id}
              </button>
            ) : (
              '—'
            )}
          </b>
        </div>
        <div>
          <span>Speed</span>
          <b>{(f.speed * 3.6).toFixed(1)} km/h</b>
        </div>
      </div>
    </aside>
  )
}

function SlotDetail({ id }: { id: string }) {
  const s = slotById(id)!
  const w = whById(s.whId)
  const item = w.inventory[s.item % w.inventory.length]
  const category = s.kind === 'blue' ? 'Wrapped' : 'Cartons'
  return (
    <aside className="card side">
      <PanelHead
        kicker={`Pallet · ${category}`}
        title={item.name}
        sub={`PAL-${id.replace(/\W/g, '').slice(-6)} · ${w.code}`}
        icon={<IconPackage />}
        actions={<CloseBtn />}
      />
      <div className="row gap">
        <Chip tone={s.filled ? 'green' : 'grey'}>{s.filled ? 'Staged' : 'Moved'}</Chip>
        <span className="muted small">
          {w.code} · Yard slot {id.slice(-3)}
        </span>
      </div>
      <div className="kv">
        <div>
          <span>Quantity</span>
          <b>{s.qty} units</b>
        </div>
        <div>
          <span>Gross weight</span>
          <b>{s.weight} kg</b>
        </div>
        <div>
          <span>Location</span>
          <b>
            {w.code} · Yard slot {id.slice(-3)}
          </b>
        </div>
        <div>
          <span>Lot</span>
          <b>{s.lot}</b>
        </div>
        <div>
          <span>Received</span>
          <b>{s.received}</b>
        </div>
        <div>
          <span>Site</span>
          <b>{w.name}</b>
        </div>
      </div>
    </aside>
  )
}

// ───────────── shipment tracking

function focusTruck(active: string, selId?: string): Truck | undefined {
  const sel = truckById(selId)
  if (sel) return sel
  const list = sim.trucks.filter((t) => t.whId === active)
  return (
    list.find((t) => t.state === 'loading' || t.state === 'unloading') ??
    list.find((t) => t.state === 'enroute') ??
    list[0] ??
    sim.trucks.find((t) => t.whId)
  )
}

export function ShipmentTracking() {
  useUI((s) => s.tick)
  const visible = useUI((s) => s.layers.shipmentTracking)
  const active = useUI((s) => s.activeWh)
  const sel = useUI((s) => s.selected)
  const select = useUI((s) => s.select)
  const t = focusTruck(active, sel?.type === 'truck' ? sel.id : undefined)
  if (!visible || !t) return null
  const w = t.whId ? whById(t.whId) : null
  const load = t.mode === 'load'
  const n = load ? t.cargo : t.cap - t.cargo
  const labels = load
    ? ['Order Confirmed', 'Picked', `Loading ${n}/${t.cap}`, 'In Transit', 'Delivered']
    : ['Order Confirmed', 'Picked', 'Loaded', 'In Transit', `Unloading ${n}/${t.cap}`]
  let current: number
  if (load) current = t.state === 'enroute' || t.state === 'loading' ? 2 : t.state === 'ready' || t.state === 'departing' ? 3 : 3
  else current = t.state === 'enroute' || t.state === 'transit' ? 3 : t.state === 'unloading' ? 4 : 5
  const st = truckStatus(t)
  const bay = w && t.dock !== undefined ? `${w.code} · Bay ${t.dock + 1}` : 'Highway'
  return (
    <div className="card tracking">
      <div className="tracking-head">
        <span className="row gap">
          <IconTruck className="accent" />
          <b>Shipment Tracking</b>
        </span>
        <span className="muted small">
          {t.id} · {t.carrier.name}
        </span>
      </div>
      <div className="tracking-body">
        <div className="steps">
          {labels.map((l, i) => {
            const done = i < current
            const cur = i === current
            const icons = [IconDoc, IconBox, IconPackage, IconTruck, IconCheck]
            const Ico = icons[i]
            return (
              <div key={i} className={`step ${done ? 'done' : ''} ${cur ? 'cur' : ''}`}>
                <div className="step-dot">
                  <Ico width={13} height={13} />
                </div>
                <div className="step-label">{l}</div>
                <div className="step-time">
                  {cur ? 'ETA ' : ''}
                  {clock(t.times[i])}
                </div>
              </div>
            )
          })}
        </div>
        <button className="ship-card" onClick={() => select({ type: 'truck', id: t.id })}>
          <div className="ship-icon">
            <IconTruck />
          </div>
          <div className="grow">
            <b>{t.shipment}</b>
            <div className="small muted">
              {t.transferId
                ? `Transfer: ${whById(t.transferFromWhId!).code} → ${whById(t.transferToWhId!).code}`
                : `To: ${load ? t.city : w?.name}`}
            </div>
            <Chip tone={st.tone}>{st.label}</Chip>
            <div className="small muted">
              {bay} · {remainingMin(t)} min left
            </div>
          </div>
          <IconChevron className="muted" />
        </button>
      </div>
    </div>
  )
}

// ───────────── fleet panel

export function FleetPanel() {
  useUI((s) => s.tick)
  const visible = useUI((s) => s.layers.fleetPanel)
  const active = useUI((s) => s.activeWh)
  const tab = useUI((s) => s.fleetTab)
  const setTab = useUI((s) => s.setFleetTab)
  const select = useUI((s) => s.select)
  const setActive = useUI((s) => s.setActiveWh)
  const sel = useUI((s) => s.selected)
  const [transferNotice, setTransferNotice] = useState('')
  const whs = active === 'all' ? sim.warehouses : [whById(active)]
  const trucks = sim.trucks.filter((t) => t.whId && whs.some((w) => w.id === t.whId))
  const fls = sim.forklifts.filter((f) => whs.some((w) => w.id === f.whId))
  const docks = whs.flatMap((w) => w.dockState.map((d, i) => {
    const candidate = truckById(d.truckId)
    const atDock = !!candidate && candidate.whId === w.id && candidate.dock === i &&
      (candidate.state === 'loading' || candidate.state === 'unloading' || candidate.state === 'ready')
    return { w, d, i, t: atDock ? candidate : undefined }
  }))
  const busy = docks.filter(({ d }) => d.reserved).length
  const working = fls.filter((f) => f.phase === 'working').length

  if (!visible) return null
  return (
    <div className="card fleet">
      <div className="fleet-head">
        <div className="tabs">
          <IconDock className="accent" />
          <button className={tab === 'docks' ? 'on' : ''} onClick={() => setTab('docks')}>
            Docks <span>{busy}/{docks.length}</span>
          </button>
          <button className={tab === 'forklifts' ? 'on' : ''} onClick={() => setTab('forklifts')}>
            Forklifts <span>{working}/{fls.length}</span>
          </button>
          <button className={tab === 'trucks' ? 'on' : ''} onClick={() => setTab('trucks')}>
            Trucks <span>{trucks.length}</span>
          </button>
          <button className={tab === 'transfers' ? 'on' : ''} onClick={() => setTab('transfers')}>
            Transfers <span>{sim.intercityTransfers.filter((x) => x.status !== 'complete').length}</span>
          </button>
        </div>
        <span className="small muted">{tab === 'transfers' ? 'Across the port network' : active === 'all' ? 'All sites' : whById(active).name}</span>
      </div>
      <div className="fleet-list">
        {tab === 'transfers' && (
          <button
            className="fleet-row"
            onClick={() => {
              const started = dispatchIntercityTransfer()
              setTransferNotice(started ? 'Cross-city load dispatched' : 'No free dock or transfer slot')
              useUI.getState().bump()
            }}
          >
            <span className="fr-key"><b>Dispatch freight</b><span>Across all sites</span></span>
            <span className="fr-main">Move stock between sites</span>
            <Chip tone={transferNotice.startsWith('Cross') ? 'green' : 'blue'}>{transferNotice || 'Dispatch'}</Chip>
            <span className="fr-extra" />
            <IconChevron className="muted" />
          </button>
        )}
        {tab === 'docks' &&
          docks.map(({ w, d, i, t }) => {
            const docked = t && t.state !== 'enroute'
            const st = t ? truckStatus(t) : null
            const n = t ? (t.mode === 'load' ? t.cargo : t.cap - t.cargo) : 0
            return (
              <button key={`${w.id}${i}`} className={`fleet-row ${t && sel?.type === 'truck' && sel.id === t.id ? 'on' : ''}`} onClick={() => t && select({ type: 'truck', id: t.id })}>
                <span className="fr-key">
                  <b>Bay {i + 1}</b>
                  <span>{w.code}</span>
                </span>
                {t ? (
                  <span className="fr-main">
                    <span className={`dot ${docked ? 'dot-blue' : 'dot-grey'}`} />
                    {t.id} · {t.carrier.name}
                  </span>
                ) : d.reserved ? (
                  <span className="fr-main muted">Reserved for city transfer</span>
                ) : (
                  <span className="fr-main muted">No truck assigned</span>
                )}
                {st ? <Chip tone={st.tone}>{st.label}</Chip> : d.reserved ? <Chip tone="amber">Reserved</Chip> : <Chip tone="grey">Available</Chip>}
                <span className="fr-extra">
                  {t && docked ? (
                    <>
                      <Bar value={n / t.cap} tone="green" />
                      <small>
                        {n}/{t.cap}
                      </small>
                    </>
                  ) : t ? (
                    <small>{remainingMin(t)} min</small>
                  ) : null}
                </span>
                <IconChevron className="muted" />
              </button>
            )
          })}
        {tab === 'forklifts' &&
          fls.map((f) => {
            const st = forkStatus(f)
            return (
              <button key={f.id} className={`fleet-row ${sel?.type === 'forklift' && sel.id === f.id ? 'on' : ''}`} onClick={() => select({ type: 'forklift', id: f.id })}>
                <span className="fr-key">
                  <b>{f.id}</b>
                  <span>{f.whId}</span>
                </span>
                <span className="fr-main ellipsis">{f.status}</span>
                <Chip tone={st.tone}>{st.label}</Chip>
                <span className="fr-extra">
                  <Bar value={f.battery / 100} tone={f.battery < 25 ? 'amber' : 'green'} />
                  <small>{Math.round(f.battery)}%</small>
                </span>
                <IconChevron className="muted" />
              </button>
            )
          })}
        {tab === 'trucks' &&
          trucks.map((t) => {
            const st = truckStatus(t)
            const w = whById(t.whId!)
            return (
              <button key={t.id} className={`fleet-row ${sel?.type === 'truck' && sel.id === t.id ? 'on' : ''}`} onClick={() => select({ type: 'truck', id: t.id })}>
                <span className="fr-key">
                  <b>{t.id}</b>
                  <span>{t.carrier.name}</span>
                </span>
                <span className="fr-main">
                  <span className="dot dot-blue" />
                  {t.transferPhase === 'road' ? 'Port network transfer' : t.state === 'enroute' ? `To ${w.code}` : `${w.code} · Bay ${(t.dock ?? 0) + 1}`}
                </span>
                <Chip tone={st.tone}>{st.label}</Chip>
                <span className="fr-extra">
                  {t.state === 'loading' || t.state === 'unloading' ? (
                    <>
                      <Bar value={(t.mode === 'load' ? t.cargo : t.cap - t.cargo) / t.cap} tone="green" />
                      <small>
                        {t.mode === 'load' ? t.cargo : t.cap - t.cargo}/{t.cap}
                      </small>
                    </>
                  ) : (
                    <small>{remainingMin(t) ? `${remainingMin(t)} min` : '—'}</small>
                  )}
                </span>
                <IconChevron className="muted" />
              </button>
            )
          })}
        {tab === 'transfers' &&
          sim.intercityTransfers.map((x) => {
            const truck = truckById(x.truckId)
            const from = whById(x.fromWhId)
            const to = whById(x.toWhId)
            const itemName = x.itemName
            const tone: Tone = x.status === 'complete' ? 'green' : x.status === 'on-road' ? 'blue' : 'amber'
            const label = x.status === 'on-road' ? 'Between cities' : x.status === 'complete' ? 'Delivered' : x.status === 'loading' ? 'Loading' : 'Unloading'
            return (
              <button
                key={x.id}
                className={`fleet-row ${truck && sel?.type === 'truck' && sel.id === truck.id ? 'on' : ''}`}
                onClick={() => (truck ? select({ type: 'truck', id: truck.id }) : setActive(to.id))}
              >
                <span className="fr-key">
                  <b>{x.id}</b>
                  <span>{itemName}</span>
                </span>
                <span className="fr-main">{from.code} → {to.code}</span>
                <Chip tone={tone}>{label}</Chip>
                <span className="fr-extra"><small>{x.quantity} pallets</small></span>
                <IconChevron className="muted" />
              </button>
            )
          })}
        {tab === 'transfers' && sim.intercityTransfers.length === 0 && (
          <div className="fleet-row muted">No port network transfers yet</div>
        )}
      </div>
    </div>
  )
}
