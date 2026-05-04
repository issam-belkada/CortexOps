const BACKEND_PORT = Number(process.env.NEXT_PUBLIC_BACKEND_PORT ?? 8000);
const DEFAULT_BACKEND_HOST = process.env.NEXT_PUBLIC_BACKEND_HOST ?? "127.0.0.1";

function getBackendHost() {
  if (typeof globalThis !== "undefined" && globalThis.location?.hostname) {
    return globalThis.location.hostname;
  }
  return DEFAULT_BACKEND_HOST;
}

function getApiProtocol() {
  if (typeof globalThis !== "undefined" && globalThis.location?.protocol === "https:") {
    return "https:";
  }
  return "http:";
}

function getWsProtocol() {
  if (typeof globalThis !== "undefined" && globalThis.location?.protocol === "https:") {
    return "wss:";
  }
  return "ws:";
}

export function getApiUrl(path: string) {
  return `${getApiProtocol()}//${getBackendHost()}:${BACKEND_PORT}${path}`;
}

export function getWsUrl(path: string) {
  return `${getWsProtocol()}//${getBackendHost()}:${BACKEND_PORT}${path}`;
}