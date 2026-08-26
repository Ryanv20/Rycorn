import { PortId } from '../shared/PortId';
import { GeoPosition } from '../shared/GeoPosition';
import { HarborType, HarborSize } from '../shared/enums';
import { Provenance } from '../shared/Provenance';

export interface Port {
  id: PortId;
  name: string;
  country: string;
  position: GeoPosition;
  harborType: HarborType;
  harborSize: HarborSize;
  maximumVesselSize: string;
  provenance: Provenance;
}
