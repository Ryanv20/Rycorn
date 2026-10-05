import { useState } from 'react';
import { Database, LoaderCircle, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { API } from '../api';

interface SimulationControlsProps {
  onReset: () => void;
  onInitialized: () => void;
  initialized: boolean;
  running: boolean;
  connected: boolean;
}

type Operation = 'initialize' | 'run' | 'pause' | 'step' | 'reset' | null;

export default function SimulationControls({ onReset, onInitialized, initialized, running, connected }: SimulationControlsProps) {
  const [operation, setOperation] = useState<Operation>(null);
  const [error, setError] = useState('');

  const post = async (url: string) => {
    const response = await fetch(`${API}${url}`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message ?? result.error ?? `Request failed (${response.status})`);
    return result;
  };

  const perform = async (next: Exclude<Operation, null>, url: string, complete?: () => void) => {
    setOperation(next);
    setError('');
    try {
      await post(url);
      complete?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not contact the simulation server');
    } finally {
      setOperation(null);
    }
  };

  const status = operation === 'initialize'
    ? 'LOADING ENGINE'
    : operation === 'run'
      ? 'STARTING ENGINE'
      : operation === 'pause'
        ? 'PAUSING ENGINE'
        : operation === 'step'
          ? 'PROCESSING EVENT'
          : !connected
            ? 'SERVER OFFLINE'
            : !initialized
              ? 'ENGINE NOT INITIALIZED'
              : running
                ? 'ENGINE RUNNING'
                : 'ENGINE PAUSED';
  const statusTone = operation || running ? 'is-active' : error || !connected ? 'is-error' : initialized ? 'is-paused' : '';
  const busy = operation !== null;

  return (
    <div className="simulation-control-wrap">
      <div className="simulation-controls">
        <span className={`engine-status ${statusTone}`} role="status" aria-live="polite">
          {busy ? <LoaderCircle className="status-spinner" size={14} /> : <i />}
          <span>{status}</span>
        </span>
        <button className="control-button control-initialize" onClick={() => void perform('initialize', '/simulation/initialize', onInitialized)} disabled={busy || !connected} title="Initialize from DS demands and fleet" aria-label="Initialize simulation">
          {operation === 'initialize' ? <LoaderCircle className="status-spinner" size={15} /> : <Database size={15} />}<span>{operation === 'initialize' ? 'Loading…' : 'Initialize'}</span>
        </button>
        <div className="playback-group" role="group" aria-label="Simulation playback">
          <button className="control-button control-play" onClick={() => void perform('run', '/simulation/run')} disabled={busy || !initialized || running} title="Run simulation" aria-label="Run simulation"><Play size={15} /><span>Run</span></button>
          <button className="control-button" onClick={() => void perform('pause', '/simulation/pause')} disabled={busy || !initialized || !running} title="Pause simulation" aria-label="Pause simulation"><Pause size={15} /><span>Pause</span></button>
          <button className="control-button" onClick={() => void perform('step', '/simulation/step')} disabled={busy || !initialized || running} title="Process next event" aria-label="Step simulation"><StepForward size={15} /><span>Step</span></button>
        </div>
        <button className="control-button control-reset" onClick={() => void perform('reset', '/simulation/reset', onReset)} disabled={busy || !connected} title="Reset simulation" aria-label="Reset simulation"><RotateCcw size={15} /><span>Reset</span></button>
      </div>
      {busy && <div className="engine-progress" role="progressbar" aria-label={status}><span /></div>}
      {error && <div className="engine-error" role="alert">{error}</div>}
    </div>
  );
}
