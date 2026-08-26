import * as fs from 'fs';
import { parse } from 'csv-parse';
import { wpiRecordSchema, WorldPortIndexRecord } from '../validators/wpiValidator';
import { normalizePort } from '../normalizers/portNormalizer';
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

  const seenIds = new Set<string>();
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
    const sourceId = validRecord['World Port Index Number'];

    if (seenIds.has(sourceId)) {
      result.duplicates++;
      console.error(`World Port Index record ${result.recordsRead}: duplicate source ID '${sourceId}'`);
      continue;
    }

    seenIds.add(sourceId);
    
    try {
      const canonicalPort = normalizePort(validRecord);
      result.ports.push(canonicalPort);
      result.valid++;
    } catch (e: any) {
      result.invalid++;
      console.error(`World Port Index record ${result.recordsRead}: normalization failed - ${e.message}`);
    }
  }

  return result;
}
