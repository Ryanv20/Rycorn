const apiOrigin = new URL(window.location.href);
// In Vite development, keep API and WebSocket requests on the page origin.
// vite.config.ts proxies them to the local API so VS Code only needs to forward
// the client port for a complete remote preview.
if (!import.meta.env.DEV) apiOrigin.port = import.meta.env.VITE_RYCORN_API_PORT || '3000';
apiOrigin.pathname = '';
apiOrigin.search = '';
apiOrigin.hash = '';
export const API = apiOrigin.origin;
export const WS = `${apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiOrigin.host}/ws`;
const portConsolePort = import.meta.env.VITE_RYCORN_PORT_CONSOLE_PORT || '5176';
export const LOS_ANGELES_PORT_CONSOLE = `${window.location.protocol}//${window.location.hostname}:${portConsolePort}`;
const lekkiConsolePort = import.meta.env.VITE_RYCORN_LEKKI_CONSOLE_PORT || '5174';
export const LEKKI_PORT_CONSOLE = `${window.location.protocol}//${window.location.hostname}:${lekkiConsolePort}`;
const shipSimulatorPort = import.meta.env.VITE_RYCORN_SHIP_SIM_PORT || '5178';
export const SHIP_SIMULATOR = `${window.location.protocol}//${window.location.hostname}:${shipSimulatorPort}`;
