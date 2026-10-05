const apiOrigin = new URL(window.location.href);
apiOrigin.port = import.meta.env.VITE_RYCORN_API_PORT || '3000';
apiOrigin.pathname = '';
apiOrigin.search = '';
apiOrigin.hash = '';
export const API = apiOrigin.origin;
export const WS = `${apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiOrigin.host}/ws`;
