import { CanonicalPort } from '../../domain/ports/CanonicalPort';
import { generatePortId } from '../ids/generatePortId';
import { WorldPortIndexRecord } from '../validators/wpiValidator';

export function normalizePort(record: WorldPortIndexRecord): CanonicalPort {
  const sourceId = record['World Port Index Number'];
  return {
    portId: generatePortId(sourceId),
    sourceId: sourceId,
    name: record['Main Port Name'],
    country: record['Country Code'],
    latitude: record['Latitude'],
    longitude: record['Longitude'],
    harborType: record['Harbor Type'] || '',
    harborSize: record['Harbor Size'] || '',
    maximumVesselSize: record['Maximum Vessel Size'] || '',
    source: 'WPI',
    sourceVersion: 'NGA Pub 150, data through 2019-08-31',
  };
}
