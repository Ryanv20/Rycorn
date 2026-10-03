# World Port Index Data

`UpdatedPub150.csv` is the official NGA World Port Index export retrieved on
2026-10-03 from the [NGA WPI publication page](https://msi.nga.mil/Publications/WPI),
which states that the CSV is the official version and is updated monthly.

- Source file: `UpdatedPub150.csv`
- Source URL: `https://msi.nga.mil/api/publications/download?type=view&key=16920959/SFH00000/UpdatedPub150.csv`
- Downloaded: 2026-10-03
- SHA-256: `315644f1e77966291633145fd351c2762b37702d115926b9ed074b39e8e21667`
- Parser result: 3,807 records read; 3,806 canonical ports; one same-location duplicate skipped; one reused source ID qualified as two distinct ports; no invalid records.

The downloaded CSV is the immutable raw source. Do not edit it in place. The
canonical output is generated at `data/processed/canonical-ports.json` by
`pnpm tsx packages/engine/scripts/ingest-wpi.ts`.

WPI is a reference port index, not live vessel/AIS data or a substitute for
current nautical charts and operational navigation information.
