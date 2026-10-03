import { useEffect, useState } from 'react';

const API = 'http://127.0.0.1:3000';

interface ReportMilestone {
  eventId: string;
  eventType: string;
  simulationTimeHours: number;
  observedAtUtc?: string;
  vesselId: string;
  locationNodeId: string;
  metadata: Record<string, unknown>;
}

interface Shipment {
  requestId: string;
  originNodeId?: string;
  origin: string;
  destination: string;
  quantity: number;
  cargoType: string;
  status: string;
  vesselId?: string;
  routeNodeIds?: string[];
  distanceKm?: number;
  departedSimulationHours?: number;
  arrivedSimulationHours?: number;
  deliveredSimulationHours?: number;
  transitHours?: number;
  milestones: ReportMilestone[];
}

interface OperationalReportData {
  generatedAtUtc: string;
  simulationTimeHours: number;
  timeSources: Record<string, string>;
  systemStatus: { engineInitialized: boolean; engineRunning: boolean; totalEventsProcessed: number };
  shipments: Shipment[];
  demandSupply: { demands: unknown[]; vesselSupply: unknown[] };
  vessels: unknown[];
  cargoes: unknown[];
  events: unknown[];
  timeObservations: unknown[];
  errors: Array<{ message: string; timestamp: number }>;
}

function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(report: OperationalReportData): string {
  const columns = ['requestId', 'origin', 'destination', 'cargoType', 'quantity', 'status', 'vesselId', 'distanceKm', 'route', 'departedSimulationHours', 'arrivedSimulationHours', 'deliveredSimulationHours', 'transitHours'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = report.shipments.map(shipment => [
    shipment.requestId,
    shipment.origin,
    shipment.destination,
    shipment.cargoType,
    shipment.quantity,
    shipment.status,
    shipment.vesselId,
    shipment.distanceKm,
    shipment.routeNodeIds?.join(' > '),
    shipment.departedSimulationHours,
    shipment.arrivedSimulationHours,
    shipment.deliveredSimulationHours,
    shipment.transitHours,
  ]);
  return [columns, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
}

function formatUtc(value: string): string {
  return new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export default function OperationalReport({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<OperationalReportData | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${API}/simulation/report`);
        if (!response.ok) throw new Error('Unable to load operational report');
        const nextReport = await response.json() as OperationalReportData;
        if (mounted) {
          setReport(nextReport);
          setError('');
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load operational report');
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  return (
    <div className="report-backdrop" role="presentation">
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="report-header">
          <div>
            <p className="report-kicker">RYCON / OPERATIONS</p>
            <h1 id="report-title">Live operational report</h1>
            <p>{report ? `Updated ${formatUtc(report.generatedAtUtc)}` : 'Connecting to simulation report'}</p>
          </div>
          <div className="report-actions">
            <button onClick={() => setRefreshKey(value => value + 1)}>Refresh</button>
            <button disabled={!report} onClick={() => report && downloadFile('rycon-operational-report.json', JSON.stringify(report, null, 2), 'application/json')}>JSON</button>
            <button disabled={!report} onClick={() => report && downloadFile('rycon-shipments.csv', toCsv(report), 'text/csv;charset=utf-8')}>CSV</button>
            <button disabled={!report} onClick={() => window.print()}>Print / PDF</button>
            <button onClick={onClose} aria-label="Close operational report">Close</button>
          </div>
        </header>
        {error && <p className="report-error">{error}</p>}
        {report && <>
          <section className="report-metrics" aria-label="Simulation summary">
            <div><span>Modeled elapsed time</span><strong>T+{report.simulationTimeHours.toFixed(2)} h</strong></div>
            <div><span>Shipments</span><strong>{report.shipments.length}</strong></div>
            <div><span>Events</span><strong>{report.systemStatus.totalEventsProcessed}</strong></div>
            <div><span>System</span><strong>{report.systemStatus.engineRunning ? 'RUNNING' : report.systemStatus.engineInitialized ? 'PAUSED' : 'NOT INITIALIZED'}</strong></div>
          </section>
          <section className="report-section">
            <h2>Shipments</h2>
            <div className="report-table-wrap">
              <table>
                <thead><tr><th>Request</th><th>Route</th><th>Cargo</th><th>Vessel</th><th>Status</th><th>Distance</th><th>Transit</th></tr></thead>
                <tbody>{report.shipments.map(shipment => <tr key={shipment.requestId}>
                  <td>{shipment.requestId}</td>
                  <td>{shipment.origin} → {shipment.destination}<small>{shipment.routeNodeIds?.join(' → ')}</small></td>
                  <td>{shipment.quantity} {shipment.cargoType}</td>
                  <td>{shipment.vesselId ?? 'Unassigned'}</td>
                  <td>{shipment.status}</td>
                  <td>{shipment.distanceKm === undefined ? '—' : `${shipment.distanceKm.toFixed(1)} km`}</td>
                  <td>{shipment.transitHours === undefined ? '—' : `${shipment.transitHours.toFixed(2)} h`}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="report-section">
            <h2>Recent event history</h2>
            <ol className="report-events">{report.events.slice(-30).reverse().map((entry: any) => <li key={entry.eventId}>
              <strong>{entry.eventType}</strong><span>{entry.entityId}</span><span>{entry.locationNodeId}</span><time>T+{Number(entry.simulationTime).toFixed(2)} h</time>
            </li>)}</ol>
          </section>
          <details className="report-raw">
            <summary>Full audit payload</summary>
            <pre>{JSON.stringify({ demandSupply: report.demandSupply, vessels: report.vessels, cargoes: report.cargoes, events: report.events, timeObservations: report.timeObservations, errors: report.errors, timeSources: report.timeSources }, null, 2)}</pre>
          </details>
          <footer className="report-sources">
            <span>Simulation time: {report.timeSources.simulationTime}</span>
            <span>Observed UTC: {report.timeSources.observedAtUtc}</span>
            <span>Distance: {report.timeSources.distanceKm}</span>
          </footer>
        </>}
      </section>
    </div>
  );
}
