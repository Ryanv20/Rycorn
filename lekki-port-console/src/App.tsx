import Scene from './three/Scene'
import { TopBar, Kpis, CamToolbar, SidePanel, ShipmentTracking, FleetPanel } from './ui/Hud'
import { useEffect, useState } from 'react'
import { useUI } from './store'

export default function App() {
  const setActiveWh = useUI((state) => state.setActiveWh)
  const constructViewer = useUI((state) => state.constructViewer)
  const constructSelection = useUI((state) => state.constructSelection)
  const constructMarquee = useUI((state) => state.constructMarquee)
  const setConstructSelection = useUI((state) => state.setConstructSelection)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('city') === '4') setActiveWh('D-WH-01')
  }, [setActiveWh])
  useEffect(() => setCopyStatus('idle'), [constructSelection])

  const copyConstructSelection = async () => {
    const totalGridCells = constructSelection.reduce((total, region) => total + region.width * region.depth, 0)
    const payload = {
      source: 'Rycorn Universal Port Construct Viewer',
      schemaVersion: 1,
      gridCellSizeMeters: 10,
      coordinateFrame: 'local-port-grid; x east, z south; one scene unit equals one meter',
      totalGridCells,
      selections: constructSelection.map((region, index) => ({
        id: index + 1,
        label: region.label,
        columns: [region.columnMin + 1, region.columnMax + 1],
        rows: [region.rowMin + 1, region.rowMax + 1],
        centerSceneUnits: [Number(region.x.toFixed(1)), Number(region.z.toFixed(1))],
        sizeMeters: [region.width * 10, region.depth * 10],
        block: { type: 'rectangular-prism', sizeMeters: [region.width * 10, 0.2, region.depth * 10] },
        gridCells: region.width * region.depth,
      })),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div className="app">
      <div className="viewport">
        <Scene />
        {constructViewer && <aside className="construct-picks"><header><b>{constructSelection.reduce((total, region) => total + region.width * region.depth, 0)} GRID CELLS SELECTED</b><nav><button onClick={() => void copyConstructSelection()} disabled={!constructSelection.length}>{copyStatus === 'copied' ? 'COPIED' : copyStatus === 'failed' ? 'COPY FAILED' : 'COPY JSON'}</button><button onClick={() => setConstructSelection([])} disabled={!constructSelection.length}>CLEAR</button></nav></header><p>Drag across grid squares; Shift-drag adds another patch. JSON blocks use the shared 10 m port grid and can be moved to LA.</p>{constructSelection.length > 0 && <ol>{constructSelection.map((item, index) => <li key={item.key}><span>{index + 1}</span>{item.label}</li>)}</ol>}</aside>}
        {constructViewer && constructMarquee && <div className="construct-marquee" style={constructMarquee} />}
      </div>
      <TopBar />
      <div className="hud">
        <Kpis />
        <div className="right-col">
          <CamToolbar />
          <SidePanel />
        </div>
        <div className="bottom">
          <ShipmentTracking />
          <FleetPanel />
        </div>
      </div>
    </div>
  )
}
