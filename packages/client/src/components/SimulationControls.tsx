import { Database, Pause, Play, RotateCcw, StepForward } from 'lucide-react';

interface SimulationControlsProps {
  onReset: () => void;
  onInitialized: () => void;
  initialized: boolean;
  running: boolean;
}

export default function SimulationControls({ onReset, onInitialized, initialized, running }: SimulationControlsProps) {
  const post = (url: string, body?: object) =>
    fetch(`http://127.0.0.1:3000${url}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

  const init = async () => {
    const response = await post('/simulation/initialize');
    if (response.ok) onInitialized();
  };
  const run   = () => post('/simulation/run');
  const pause = () => post('/simulation/pause');
  const step  = () => post('/simulation/step');
  const reset = () => { void post('/simulation/reset'); onReset(); };
  return (
    <div className="simulation-controls">
      <button className="control-button control-initialize" onClick={() => void init()} title="Initialize from DSS demands and DS fleet" aria-label="Initialize simulation"><Database size={15} /><span>Initialize</span></button>
      <div className="playback-group" role="group" aria-label="Simulation playback">
        <button className="control-button control-play" onClick={() => void run()} disabled={!initialized || running} title="Run simulation" aria-label="Run simulation"><Play size={15} /><span>Run</span></button>
        <button className="control-button" onClick={() => void pause()} disabled={!initialized || !running} title="Pause simulation" aria-label="Pause simulation"><Pause size={15} /><span>Pause</span></button>
        <button className="control-button" onClick={() => void step()} disabled={!initialized || running} title="Process next event" aria-label="Step simulation"><StepForward size={15} /><span>Step</span></button>
      </div>
      <button className="control-button control-reset" onClick={reset} title="Reset simulation" aria-label="Reset simulation"><RotateCcw size={15} /><span>Reset</span></button>
    </div>
  );
}
