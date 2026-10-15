import Scene from './three/Scene'
import { TopBar, Kpis, CamToolbar, SidePanel, ShipmentTracking, FleetPanel } from './ui/Hud'

export default function App() {
  return (
    <div className="app">
      <div className="viewport">
        <Scene />
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
