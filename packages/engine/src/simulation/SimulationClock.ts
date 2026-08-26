export class SimulationClock {
  private currentTime: number = 0;
  
  advance(hours: number): void {
    if (hours < 0) throw new Error("Cannot advance time negatively");
    this.currentTime += hours;
  }
  
  getTime(): number {
    return this.currentTime;
  }
  
  reset(): void {
    this.currentTime = 0;
  }
}
