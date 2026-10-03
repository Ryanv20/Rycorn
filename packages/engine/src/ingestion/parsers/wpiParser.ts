import * as fs from 'fs';
import { parse } from 'csv-parse';
import { wpiRecordSchema, WorldPortIndexRecord } from '../validators/wpiValidator';
import { normalizePort } from '../normalizers/portNormalizer';
import { normalizePortSourceId } from '../ids/generatePortId';
import { CanonicalPort } from '../../domain/ports/CanonicalPort';

export interface ProcessResult {
  recordsRead: number;
  valid: number;
  invalid: number;
  duplicates: number;
  warnings: number;
  ports: CanonicalPort[];
}

export async function parseWpiFile(filePath: string): Promise<ProcessResult> {
  const result: ProcessResult = {
    recordsRead: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    warnings: 0,
    ports: [],
  };

  const seenIds = new Map<string, Array<{ record: WorldPortIndexRecord; portIndex: number }>>();
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    })
  );

  for await (const row of parser) {
    result.recordsRead++;
    const validationResult = wpiRecordSchema.safeParse(row);
    
    if (!validationResult.success) {
      result.invalid++;
      const issue = validationResult.error.issues[0];
      console.error(`World Port Index record ${result.recordsRead}: invalid ${issue.path.join('.')} '${row[issue.path[0] as string]}' - ${issue.message}`);
      continue;
    }

    const validRecord = validationResult.data;
    const sourceId = normalizePortSourceId(validRecord['World Port Index Number']);
    const previousPorts = seenIds.get(sourceId) ?? [];
    const sameLocation = previousPorts.find(({ record }) =>
      Math.abs(record.Latitude - validRecord.Latitude) < 0.00001 &&
      Math.abs(record.Longitude - validRecord.Longitude) < 0.00001
    );

    if (sameLocation) {
      result.duplicates++;
      result.warnings++;
      console.warn(`World Port Index record ${result.recordsRead}: repeated source ID '${sourceId}' at the same coordinates; duplicate entry skipped`);
      continue;
    }

    if (previousPorts.length > 0) {
      result.warnings++;
      console.warn(`World Port Index record ${result.recordsRead}: source ID '${sourceId}' is reused at a distinct location; assigning qualified canonical IDs`);
      for (const previous of previousPorts) {
        result.ports[previous.portIndex] = normalizePort(previous.record, `${previous.record['Main Port Name']}-${previous.record.Latitude.toFixed(5)}-${previous.record.Longitude.toFixed(5)}`);
      }
    }
    
    try {
      const qualifier = previousPorts.length > 0
        ? `${validRecord['Main Port Name']}-${validRecord.Latitude.toFixed(5)}-${validRecord.Longitude.toFixed(5)}`
        : undefined;
      const canonicalPort = normalizePort(validRecord, qualifier);
      const portIndex = result.ports.length;
      result.ports.push(canonicalPort);
      previousPorts.push({ record: validRecord, portIndex });
      seenIds.set(sourceId, previousPorts);
      result.valid++;
    } catch (e: any) {
      result.invalid++;
      console.error(`World Port Index record ${result.recordsRead}: normalization failed - ${e.message}`);
    }
  }

  return result;
}
