import { useState } from 'react'
import { Anchor, ArrowDownRight, ArrowUpRight, Bell, Boxes, ChevronDown, CircleHelp, Clock3, Container, Gauge, LayoutDashboard, Map, MoreHorizontal, Search, Ship, SlidersHorizontal, Sparkles, Truck, Waves } from 'lucide-react'
import PortYard from './PortYard'

const tabs = ['Overview', 'Yard', 'Vessels', 'Gate']
const shipments = [
  { id: 'RC-2048', cargo: 'Consumer electronics', vessel: 'MV Pacific Dawn', bay: 'Berth 02', status: 'Unloading', amount: '128 TEU', tone: 'blue', time: '08:42' },
  { id: 'RC-2047', cargo: 'Grain · bulk', vessel: 'Nordic Carrier', bay: 'Berth 01', status: 'On schedule', amount: '4,200 t', tone: 'green', time: '08:16' },
  { id: 'RC-2046', cargo: 'Automotive parts', vessel: 'Ocean Meridian', bay: 'Berth 03', status: 'Awaiting berth', amount: '64 TEU', tone: 'amber', time: '07:58' },
]

function YardScene() {
  return <div className="yard-scene" aria-label="Animated 3D port yard">
    <PortYard />
    <div className="scene-label"><span className="live-dot"/> PORT LIVE <strong>08:42:16</strong></div>
    <div className="scene-caption"><span>01 / 04</span><b>North quay · yard view</b><button aria-label="More view options"><MoreHorizontal size={19}/></button></div>
  </div>
}

export default function App() {
  const [tab, setTab] = useState('Overview')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('Today')
  const [notice, setNotice] = useState(false)
  const visibleShipments = shipments.filter(s => `${s.id} ${s.cargo} ${s.vessel}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark"><Waves size={20}/></span><span>rycorn<span className="brand-dot">.</span><small>PORT SYSTEM</small></span></a>
      <div className="port-switch"><span className="port-icon"><Anchor size={16}/></span><span><small>ACTIVE PORT</small><b>Riverside Terminal</b></span><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className="nav-item active"><LayoutDashboard size={17}/> Overview <span className="nav-active-dot"/></button>
        <button className="nav-item" onClick={() => setTab('Yard')}><Boxes size={17}/> Yard operations</button>
        <button className="nav-item" onClick={() => setTab('Vessels')}><Ship size={17}/> Vessel schedule <span className="nav-count">6</span></button>
        <button className="nav-item" onClick={() => setTab('Gate')}><Truck size={17}/> Gate &amp; trucking</button>
        <button className="nav-item"><Map size={17}/> Port map</button>
      </nav>
      <div className="nav-label tools-label">MANAGE</div>
      <button className="nav-item"><SlidersHorizontal size={17}/> Port settings</button>
      <div className="sidebar-bottom"><div className="weather-card"><span className="weather-sun">☼</span><div><small>PORT CONDITIONS</small><b>Clear skies <em>24°</em></b><span>Wind NW · 8 kn</span></div><ArrowUpRight size={14}/></div><button className="help-link"><CircleHelp size={16}/> Help &amp; support <span>↗</span></button><div className="profile"><div className="avatar">AM</div><div><b>Alex Morgan</b><small>Port administrator</small></div><MoreHorizontal size={18}/></div></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar"><div className="breadcrumbs">Riverside Terminal <span>/</span> <b>{tab}</b></div><div className="top-actions"><div className="system-status"><i/> All systems operational</div><button className="icon-button notification" aria-label="Notifications" onClick={() => setNotice(!notice)}><Bell size={18}/><i/></button>{notice && <div className="notice-pop"><b>You're all caught up</b><span>No new port alerts.</span></div>}<div className="top-avatar">AM</div></div></header>
      <div className="page-wrap">
        <section className="page-heading"><div><div className="eyebrow"><span/> MONDAY, OCTOBER 12, 2026 <span className="eyebrow-line"/> SHIFT A · 06:00—14:00</div><h1>Good morning, Alex<span>.</span></h1><p>Here’s what’s happening at your port today.</p></div><button className="date-select" onClick={() => setSelected(selected === 'Today' ? 'Last 7 days' : 'Today')}><Clock3 size={15}/>{selected}<ChevronDown size={14}/></button></section>
        <div className="tab-row">{tabs.map(t => <button key={t} className={tab === t ? 'tab selected' : 'tab'} onClick={() => setTab(t)}>{t}{t === 'Vessels' && <i>6</i>}</button>)}<div className="tab-rule"/><button className="refresh-label"><span className="live-dot"/> LIVE UPDATES</button></div>
        <section className="metrics-grid">
          <article className="metric-card"><div className="metric-top"><span>VESSELS IN PORT</span><span className="metric-icon blue"><Ship size={16}/></span></div><div className="metric-value">06 <small>/ 08</small></div><div className="metric-foot"><span className="delta positive"><ArrowUpRight size={13}/> 2</span> vs. yesterday <span className="mini-bars"><i/><i/><i/><i/><i/><i/><i/></span></div></article>
          <article className="metric-card"><div className="metric-top"><span>YARD CAPACITY</span><span className="metric-icon orange"><Container size={16}/></span></div><div className="metric-value">78<span className="unit">%</span></div><div className="capacity-line"><i/></div><div className="metric-foot">1,412 of 1,800 slots occupied</div></article>
          <article className="metric-card"><div className="metric-top"><span>CARGO MOVED</span><span className="metric-icon green"><Boxes size={16}/></span></div><div className="metric-value">2,840 <small>TEU</small></div><div className="metric-foot"><span className="delta positive"><ArrowUpRight size={13}/> 12.4%</span> vs. last shift</div></article>
          <article className="metric-card"><div className="metric-top"><span>GATE TURNAROUND</span><span className="metric-icon violet"><Gauge size={16}/></span></div><div className="metric-value">28 <small>min</small></div><div className="metric-foot"><span className="delta positive"><ArrowDownRight size={13}/> 4 min</span> vs. weekly average</div></article>
        </section>

        <section className="visual-section"><div className="section-heading"><div><span className="section-kicker">YOUR PORT, AT A GLANCE</span><h2>A port in motion<span>.</span></h2></div><button className="text-action">Open port map <ArrowUpRight size={15}/></button></div><YardScene/></section>

        <section className="lower-grid"><div className="shipments-panel"><div className="panel-heading"><div><span className="section-kicker">LIVE OPERATIONS</span><h3>Recent cargo activity</h3></div><button className="view-all">View all <ArrowUpRight size={14}/></button></div><div className="table-toolbar"><span>Latest movements across your terminal</span><label className="search-field"><Search size={14}/><input aria-label="Search cargo activity" placeholder="Search activity" value={search} onChange={e => setSearch(e.target.value)}/></label></div><div className="shipment-table"><div className="table-head"><span>SHIPMENT</span><span>VESSEL / CARGO</span><span>LOCATION</span><span>STATUS</span><span>TIME</span></div>{visibleShipments.map(s => <div className="shipment-row" key={s.id}><div><b>{s.id}</b><small>{s.amount}</small></div><div><b>{s.vessel}</b><small>{s.cargo}</small></div><div><span className="location-dot"/>{s.bay}</div><div><span className={`status-pill ${s.tone}`}>{s.status}</span></div><div className="time-cell">{s.time}</div></div>)}{visibleShipments.length === 0 && <div className="empty-state">No activity matches “{search}”.</div>}</div></div>
          <aside className="schedule-panel"><div className="panel-heading"><div><span className="section-kicker">ON THE WATER</span><h3>Next arrivals</h3></div><button className="icon-button small"><MoreHorizontal size={18}/></button></div><div className="arrival"><div className="arrival-time"><b>09:30</b><span>IN 48 MIN</span></div><div className="arrival-line"><i/></div><div className="arrival-copy"><div><Ship size={15}/><b>MV Coral Bay</b><span className="eta-badge">ON TIME</span></div><p>From Singapore <span>·</span> Berth 04</p><div className="arrival-progress"><i/></div><small>ETA 09:30 <span>·</span> 1,840 nm remaining</small></div></div><div className="arrival"><div className="arrival-time"><b>11:15</b><span>IN 2H 03M</span></div><div className="arrival-line muted"><i/></div><div className="arrival-copy"><div><Ship size={15}/><b>Atlantic Venture</b></div><p>From Rotterdam <span>·</span> Berth 02</p><small>ETA 11:15 <span>·</span> 620 nm remaining</small></div></div><button className="schedule-footer">See full vessel schedule <ArrowUpRight size={14}/></button></aside></section>
        <footer className="page-footer"><span>© 2026 Rycorn Port System</span><span><span className="live-dot"/> Data refreshed just now</span><span>Built for better port days <Sparkles size={13}/></span></footer>
      </div>
    </main>
  </div>
}
