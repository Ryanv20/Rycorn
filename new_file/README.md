# Rycon Port Console · Los Angeles

Standalone Next.js port console built from the Waretrack interaction pattern.
The pilot represents the Port of Los Angeles (`19WPI-16080`) and reads
canonical port facts, cargo demand, fleet supply, simulation state, and events
from the Rycon API. It does not create a separate simulation engine.

From `Rycorn/`, run the API and console in separate terminals:

```bash
pnpm dev:server
pnpm dev:new-file
```

The console is served at `http://localhost:5176`. It reads the API at
`http://localhost:3000`; set `NEXT_PUBLIC_RYCORN_API_ORIGIN` to override that
origin. The **Run engine** control initializes Rycon's selected DS scenario if
needed, then starts the existing engine. **Pause** pauses that same engine.

The 3D yard is a stylized interaction surface, not a measured port layout.
World Port Index facts are labeled as static reference data. Rycon demand
quantities remain model units, and only vessel, cargo, and event state returned
by the API is presented as live simulation state.
