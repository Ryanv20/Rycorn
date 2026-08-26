import React, { useState } from 'react';

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  sidebar: (open: boolean): React.CSSProperties => ({
    width: open ? 300 : 36,
    minWidth: open ? 300 : 36,
    background: '#0f1117',
    color: '#e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #2a2d3a',
    transition: 'width 0.2s ease',
    overflow: 'hidden',
    fontFamily: 'monospace',
    fontSize: 12,
    position: 'relative',
    zIndex: 10,
  }),
  toggle: (): React.CSSProperties => ({
    width: 36,
    minWidth: 36,
    padding: '12px 0',
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 16,
    textAlign: 'center',
    flexShrink: 0,
  }),
  header: (): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0 10px 8px',
    borderBottom: '1px solid #2a2d3a',
    flexShrink: 0,
  }),
  section: (): React.CSSProperties => ({
    borderBottom: '1px solid #1e2130',
    flexShrink: 0,
  }),
  sectionHeader: (): React.CSSProperties => ({
    padding: '8px 12px',
    background: '#161a24',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#9ba3b2',
    userSelect: 'none',
    letterSpacing: '0.05em',
    fontSize: 10,
    textTransform: 'uppercase',
  }),
  sectionBody: (): React.CSSProperties => ({
    padding: '10px 12px',
    maxHeight: 200,
    overflowY: 'auto',
  }),
  row: (): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  }),
  label: (): React.CSSProperties => ({ color: '#6b7280' }),
  value: (ok?: boolean): React.CSSProperties => ({
    color: ok === false ? '#ef4444' : ok === true ? '#22c55e' : '#e0e0e0',
    fontWeight: 600,
  }),
  dot: (on: boolean): React.CSSProperties => ({
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: on ? '#22c55e' : '#ef4444',
    marginRight: 6,
    boxShadow: on ? '0 0 6px #22c55e' : 'none',
  }),
  errorRow: (): React.CSSProperties => ({
    padding: '3px 0',
    borderBottom: '1px solid #1e2130',
    color: '#f87171',
    wordBreak: 'break-word',
  }),
  errorTime: (): React.CSSProperties => ({
    color: '#4b5563',
    marginRight: 6,
  }),
  noErrors: (): React.CSSProperties => ({ color: '#22c55e' }),
  scrollFull: (): React.CSSProperties => ({
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
  }),
};

// ── Collapsible section ─────────────────────────────────────────────────────
function Section({ title, badge, children }: { title: string; badge?: string | number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={S.section()}>
      <div style={S.sectionHeader()} onClick={() => setOpen(o => !o)}>
        <span>{title}{badge !== undefined ? <span style={{ marginLeft: 6, background: '#2a2d3a', padding: '1px 5px', borderRadius: 4 }}>{badge}</span> : null}</span>
        <span>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={S.sectionBody()}>{children}</div>}
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────
export interface SystemStatus {
  engineInitialized: boolean;
  engineRunning: boolean;
  connectionCount: number;
  totalEventsProcessed: number;
  startedAt: number | null;
  uptime: number;
}

export interface AdminSidebarProps {
  connected: boolean;
  systemStatus: SystemStatus | null;
  errors: Array<{ message: string; timestamp: number }>;
  vessels: any[];
  cargoes: any[];
  simulationTime: number;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── Main component ──────────────────────────────────────────────────────────
export default function AdminSidebar({ connected, systemStatus, errors, vessels, cargoes, simulationTime }: AdminSidebarProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={S.sidebar(open)}>
      {/* Toggle button */}
      <div style={S.header()}>
        <button style={S.toggle()} onClick={() => setOpen(o => !o)} title={open ? 'Collapse sidebar' : 'Expand sidebar'}>
          {open ? '◀' : '▶'}
        </button>
        {open && <span style={{ color: '#9ba3b2', letterSpacing: '0.1em', fontSize: 11, textTransform: 'uppercase' }}>Admin</span>}
      </div>

      {open && (
        <>
          {/* ── Connection status ── */}
          <Section title="Connection">
            <div style={S.row()}>
              <span style={S.label()}>WebSocket</span>
              <span style={S.value(connected)}>
                <span style={S.dot(connected)} />
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Server clients</span>
              <span style={S.value()}>{systemStatus?.connectionCount ?? '—'}</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>API</span>
              <span style={S.value()}>localhost:3000</span>
            </div>
          </Section>

          {/* ── Current simulation status ── */}
          <Section title="Simulation">
            <div style={S.row()}>
              <span style={S.label()}>Engine</span>
              <span style={S.value(systemStatus?.engineInitialized)}>{systemStatus?.engineInitialized ? 'Initialized' : 'Not ready'}</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Running</span>
              <span style={S.value(systemStatus?.engineRunning)}>
                <span style={S.dot(!!systemStatus?.engineRunning)} />
                {systemStatus?.engineRunning ? 'Running' : 'Paused'}
              </span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Sim time</span>
              <span style={S.value()}>T+{simulationTime.toFixed(2)}h</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Events processed</span>
              <span style={S.value()}>{systemStatus?.totalEventsProcessed ?? 0}</span>
            </div>
            {systemStatus?.startedAt && (
              <div style={S.row()}>
                <span style={S.label()}>Uptime</span>
                <span style={S.value()}>{fmt(systemStatus.uptime)}</span>
              </div>
            )}
          </Section>

          {/* ── Vessels ── */}
          <Section title="Vessels" badge={vessels.length}>
            {vessels.length === 0
              ? <span style={S.label()}>No vessels loaded</span>
              : vessels.map(v => (
                <div key={v.vesselId} style={S.row()}>
                  <span style={{ color: '#93c5fd' }}>{v.vesselId}</span>
                  <span style={S.value(v.status === 'IDLE')}>{v.status}</span>
                </div>
              ))}
          </Section>

          {/* ── Cargo ── */}
          <Section title="Cargo" badge={cargoes.length}>
            {cargoes.length === 0
              ? <span style={S.label()}>No cargo loaded</span>
              : cargoes.map(c => (
                <div key={c.cargoId} style={S.row()}>
                  <span style={{ color: '#fcd34d' }}>{c.cargoId}</span>
                  <span style={S.value(c.status === 'DELIVERED')}>{c.status}</span>
                </div>
              ))}
          </Section>

          {/* ── Error log ── */}
          <Section title="Error Log" badge={errors.length}>
            {errors.length === 0
              ? <span style={S.noErrors()}>✓ No errors</span>
              : errors.map((e, i) => (
                <div key={i} style={S.errorRow()}>
                  <span style={S.errorTime()}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                  {e.message}
                </div>
              ))}
          </Section>

          {/* ── System info ── */}
          <Section title="System">
            <div style={S.row()}>
              <span style={S.label()}>Engine</span>
              <span style={S.value()}>@rycon/engine</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Server</span>
              <span style={S.value()}>Fastify 5 + WS</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Client</span>
              <span style={S.value()}>React 18 + Leaflet</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Network nodes</span>
              <span style={S.value()}>1,084</span>
            </div>
            <div style={S.row()}>
              <span style={S.label()}>Ports</span>
              <span style={S.value()}>Alpha · Beta · Gamma · Delta</span>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
