import { CanonicalPort } from '../../domain/ports/CanonicalPort';
import { Port } from '../../domain/ports/Port';
import { HarborType, HarborSize } from '../../domain/shared/enums';
import { PortId } from '../../domain/shared/PortId';
import { generatePortId } from '../ids/generatePortId';

export function mapHarborType(raw: string): HarborType {
  const map: Record<string, HarborType> = {
    'Coastal (Natural)': HarborType.CoastalNatural,
    'Coastal (Breakwater)': HarborType.CoastalBreakwater,
    'Coastal (Tide Gate)': HarborType.CoastalTideGate,
    'River (Natural)': HarborType.RiverNatural,
    'River (Basin)': HarborType.RiverBasin,
    'River (Tide Gate)': HarborType.RiverTideGate,
    'Lake': HarborType.Lake,
    'Open Roadstead': HarborType.OpenRoadstead,
    'Canal': HarborType.Canal,
    'Lagoon': HarborType.Lagoon,
  };
  return map[raw] || HarborType.Unknown;
}

export function mapHarborSize(raw: string): HarborSize {
  const map: Record<string, HarborSize> = {
    'S': HarborSize.Small,
    'M': HarborSize.Medium,
    'L': HarborSize.Large,
    'V': HarborSize.VeryLarge,
  };
  return map[raw] || HarborSize.Unknown;
}

export function transformPort(canonical: CanonicalPort): Port {
  const id = generatePortId(canonical.sourceId) as PortId;
  return {
    id,
    name: canonical.name,
    country: canonical.country,
    position: {
      latitude: canonical.latitude,
      longitude: canonical.longitude,
    },
    harborType: mapHarborType(canonical.harborType),
    harborSize: mapHarborSize(canonical.harborSize),
    maximumVesselSize: canonical.maximumVesselSize,
    provenance: {
      source: canonical.source,
      sourceId: canonical.sourceId,
      sourceVersion: canonical.sourceVersion,
    },
  };
}
