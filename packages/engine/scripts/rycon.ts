/**
 * Rycon CLI dispatcher.
 * Usage: pnpm run rycon <command>
 * Example: pnpm run rycon ingest:wpi
 */

const command = process.argv[2];

const commands: Record<string, string> = {
  "ingest:wpi": "./ingest-wpi.ts",
};

if (!command || !commands[command]) {
  console.error(`Unknown command: ${command ?? "(none)"}`);
  console.error(`Available commands: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

await import(commands[command]);
