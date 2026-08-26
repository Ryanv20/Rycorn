export default function Clock({ simulationTime }: { simulationTime: number }) {
  return (
    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
      Time: T+{simulationTime.toFixed(2)}h
    </div>
  );
}
