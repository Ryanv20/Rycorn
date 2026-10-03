import { CanonicalPort } from '../../domain/ports/CanonicalPort';
import { generatePortId, normalizePortSourceId } from '../ids/generatePortId';
import { WorldPortIndexRecord } from '../validators/wpiValidator';

export function normalizePort(record: WorldPortIndexRecord, qualifier?: string): CanonicalPort {
  const sourceId = record['World Port Index Number'];
  return {
    portId: generatePortId(sourceId, qualifier),
    sourceId: normalizePortSourceId(sourceId),
    name: record['Main Port Name'],
    country: record['Country Code'],
    latitude: record['Latitude'],
    longitude: record['Longitude'],
    harborType: record['Harbor Type'] || '',
    harborSize: record['Harbor Size'] || '',
    maximumVesselSize: record['Maximum Vessel Size'] || '',
    source: 'WPI',
    sourceVersion: 'NGA Pub 150, UpdatedPub150.csv retrieved 2026-10-03',
  };
}
