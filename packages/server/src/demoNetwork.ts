import { NetworkBuilder } from '@rycon/engine';

const CAPABILITY_A = 0;
const CAPABILITY_B = 1;

export function buildDemoNetwork() {
  const builder = new NetworkBuilder();

  builder.addPorts([
    { id: 'PORT-ALPHA', name: 'Alpha Port', country: 'XX', position: { latitude: 51.5, longitude: 0 }, sourceId: '1' } as any,
    { id: 'PORT-BETA', name: 'Beta Port', country: 'YY', position: { latitude: 51.5, longitude: 5 }, sourceId: '2' } as any,
    { id: 'PORT-GAMMA', name: 'Gamma Port', country: 'ZZ', position: { latitude: 48, longitude: 2 }, sourceId: '3' } as any,
  ]);

  builder.addEdges([
    { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-BETA', minimumCapability: CAPABILITY_B },
    { fromPortId: 'PORT-BETA', toPortId: 'PORT-ALPHA', minimumCapability: CAPABILITY_B },
    { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-GAMMA', minimumCapability: CAPABILITY_A },
    { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-ALPHA', minimumCapability: CAPABILITY_A },
    { fromPortId: 'PORT-BETA', toPortId: 'PORT-GAMMA', minimumCapability: CAPABILITY_A },
    { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-BETA', minimumCapability: CAPABILITY_A },
  ]);

  return builder.build();
}