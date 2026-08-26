export interface PortCapacityConfig {
  defaultBerths: number;      // default: 2
  portOverrides?: Map<string, number>; // per-port berth count
}

export class PortCapacityPolicy {
  private occupancy = new Map<string, number>();
  
  canEnterPort(portNodeId: string, config: PortCapacityConfig): boolean {
    const berths = config.portOverrides?.get(portNodeId) ?? config.defaultBerths;
    const currentOccupancy = this.occupancy.get(portNodeId) || 0;
    return currentOccupancy < berths;
  }
  
  vesselEntered(portNodeId: string): void {
    const current = this.occupancy.get(portNodeId) || 0;
    this.occupancy.set(portNodeId, current + 1);
  }
  
  vesselDeparted(portNodeId: string): void {
    const current = this.occupancy.get(portNodeId) || 0;
    if (current > 0) {
      this.occupancy.set(portNodeId, current - 1);
    }
  }
}
