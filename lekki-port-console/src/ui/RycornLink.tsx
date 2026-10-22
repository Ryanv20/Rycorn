import { useCallback, useEffect, useState } from 'react'

const LEKKI_ID = '19WPI-46135-LEKKI-6-42320-4-00824'
const LOS_ANGELES_ID = '19WPI-16080'
const apiOrigin = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_RYCORN_API_PORT || '3000'}`

type LinkSnapshot = {
  connected: boolean
  portName?: string
  country?: string
  demands?: number
  vessels?: number
  city4Handoffs?: number
  initialized?: boolean
  time?: number
  clockProfileId?: string
  error?: string
}

async function getJson(path: string) {
  const response = await fetch(`${apiOrigin}${path}`)
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

export function RycornLink() {
  const [snapshot, setSnapshot] = useState<LinkSnapshot>({ connected: false })
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [ports, demands, supply, admin] = await Promise.all([
        getJson('/network/ports'), getJson('/ds/demands'), getJson('/ds/supply'), getJson('/admin/status'),
      ])
      const lekki = ports.find((port: { portId: string }) => port.portId === LEKKI_ID)
      if (!lekki) throw new Error('Lekki is missing from Rycorn port data')
      const initialized = Boolean(admin.engineInitialized)
      const time = Number(admin.simulationTimeHours ?? 0)
      const lekkiDemands = demands.demands?.filter((d: { status: string; origin: string; destination: string }) =>
        d.status === 'PENDING' && `${d.origin} ${d.destination}`.includes(LEKKI_ID),
      ) ?? []
      const lekkiVessels = supply.vessels?.filter((v: { startNodeId: string }) => v.startNodeId.includes(LEKKI_ID)) ?? []
      const city4Handoffs = demands.demands?.filter((d: { status: string; destination: string }) =>
        d.destination.includes(LOS_ANGELES_ID) && !['CANCELLED', 'FAILED'].includes(d.status),
      ) ?? []
      setSnapshot({
        connected: true,
        portName: lekki.name,
        country: lekki.country,
        demands: lekkiDemands.length,
        vessels: lekkiVessels.length,
        city4Handoffs: city4Handoffs.length,
        initialized,
        time,
        clockProfileId: admin.clockProfileId,
      })
    } catch (error) {
      setSnapshot({ connected: false, error: error instanceof Error ? error.message : 'Rycorn API unavailable' })
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const command = async (action: 'initialize' | 'run' | 'pause') => {
    setBusy(true)
    try {
      const response = await fetch(`${apiOrigin}/simulation/${action === 'initialize' ? 'initialize' : action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      })
      if (!response.ok) throw new Error(`Rycorn ${action} failed (${response.status})`)
      await refresh()
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: error instanceof Error ? error.message : 'Command failed' }))
    } finally {
      setBusy(false)
    }
  }

  const setClockProfile = async (profileId: string) => {
    setBusy(true)
    try {
      const response = await fetch(`${apiOrigin}/simulation/clock-profile`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profileId }),
      })
      if (!response.ok) throw new Error(`Rycorn clock change failed (${response.status})`)
      await refresh()
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: error instanceof Error ? error.message : 'Clock change failed' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rycorn-link-wrap">
      <select className="rycorn-speed" aria-label="Rycorn simulation speed" value={snapshot.clockProfileId ?? 'HOUR_PER_SECOND'} disabled={!snapshot.connected || busy} onChange={(event) => void setClockProfile(event.target.value)}>
        <option value="HOUR_PER_SECOND">1h / s</option>
        <option value="SIX_HOURS_PER_SECOND">6h / s</option>
        <option value="FAST_REVIEW">1d / s</option>
        <option value="WEEK_PER_SECOND">1 week / s</option>
      </select>
      <button className={`icon-btn rycorn-link-toggle ${snapshot.connected ? 'connected' : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className={`rycorn-link-dot ${snapshot.connected ? 'connected' : ''}`} /> Rycorn link
      </button>
      {open && <section className="card rycorn-link" aria-label="Rycorn connection">
      <div className="rycorn-link-head">
        <span className={`rycorn-link-dot ${snapshot.connected ? 'connected' : ''}`} />
        <b>RYCORN · LEKKI</b>
        <span className="rycorn-link-country">{snapshot.connected ? `${snapshot.portName}, ${snapshot.country}` : 'API disconnected'}</span>
      </div>
      <div className="rycorn-link-stats">
        <span><b>{snapshot.demands ?? '—'}</b> pending Lekki requests</span>
        <span><b>{snapshot.vessels ?? '—'}</b> Lekki-based vessels</span>
        <span><b>{snapshot.city4Handoffs ?? '—'}</b> LA-bound City 4 DS requests</span>
        <span><b>{snapshot.initialized ? `T+${(snapshot.time ?? 0).toFixed(1)}h` : 'Not initialized'}</b> engine</span>
      </div>
      <div className="rycorn-link-actions">
        <button disabled={!snapshot.connected || busy} onClick={() => void command('initialize')}>Initialize</button>
        <button disabled={!snapshot.connected || busy || !snapshot.initialized} onClick={() => void command('run')}>Run</button>
        <button disabled={!snapshot.connected || busy || !snapshot.initialized} onClick={() => void command('pause')}>Pause</button>
      </div>
      {snapshot.error && <div className="rycorn-link-error" title={snapshot.error}>{snapshot.error}</div>}
      </section>}
    </div>
  )
}
