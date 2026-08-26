export interface MovementModifier {
  getSpeedMultiplier(
    fromNodeId: string,
    toNodeId: string,
    simulationTime: number,
  ): number;
}

export interface PortDelayModifier {
  getAdditionalDelay(
    portNodeId: string,
    operationType: 'LOAD' | 'UNLOAD',
    simulationTime: number,
  ): number;
}
