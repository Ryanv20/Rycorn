const apiOrigin = new URL(window.location.href);
apiOrigin.port = '3000';
apiOrigin.pathname = '';
apiOrigin.search = '';
apiOrigin.hash = '';
export const API = apiOrigin.origin;
export const WS = `${apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiOrigin.host}/ws`;
