import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { parseWpiFile } from '../src/ingestion/parsers/wpiParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputFilePath = path.join(__dirname, '../../../data/raw/world-port-index/UpdatedPub150.csv');
  const outputDir = path.join(__dirname, '../../../data/processed');
  const outputFilePath = path.join(outputDir, 'canonical-ports.json');

  if (!fs.existsSync(inputFilePath)) {
    console.error(`Error: Source file not found at ${inputFilePath}`);
    console.error('Please refer to data/raw/world-port-index/PROVENANCE.md for instructions.');
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting WPI ingestion from ${inputFilePath}...`);
  const result = await parseWpiFile(inputFilePath);

  fs.writeFileSync(outputFilePath, JSON.stringify(result.ports, null, 2), 'utf8');

  console.log('\n--- Processing Summary ---');
  console.log(`Records read: ${result.recordsRead}`);
  console.log(`Valid:        ${result.valid}`);
  console.log(`Invalid:      ${result.invalid}`);
  console.log(`Duplicates:   ${result.duplicates}`);
  console.log(`Warnings:     ${result.warnings}`);
  
  console.log(`\nSuccessfully wrote ${result.ports.length} ports to ${outputFilePath}`);

  if (result.invalid > 0) process.exit(1);
}

main().catch(err => {
  console.error('Unhandled error during ingestion:', err);
  process.exit(1);
});
