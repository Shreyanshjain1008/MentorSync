const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
const explicitWsBaseUrl = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_WS_BASE_URL;
const rawIceServers = process.env.NEXT_PUBLIC_ICE_SERVERS;

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required");
}

function toWebSocketUrl(url: string) {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }

  if (url.startsWith("https://")) {
    return url.replace("https://", "wss://");
  }

  if (url.startsWith("http://")) {
    return url.replace("http://", "ws://");
  }

  throw new Error("Unable to derive websocket URL from NEXT_PUBLIC_API_URL");
}

function isLocalhostUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost";
  } catch {
    return false;
  }
}

const wsBaseUrl = (() => {
  if (explicitWsBaseUrl) {
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(explicitWsBaseUrl)) {
      return toWebSocketUrl(apiBaseUrl);
    }
    return toWebSocketUrl(explicitWsBaseUrl);
  }

  return toWebSocketUrl(apiBaseUrl);
})();

export const env = {
  apiBaseUrl,
  wsBaseUrl,
  iceServers: (() => {
    if (!rawIceServers) {
      return [{ urls: "stun:stun.l.google.com:19302" }] as RTCIceServer[];
    }

    try {
      const parsed = JSON.parse(rawIceServers) as RTCIceServer[];
      return parsed.length ? parsed : [{ urls: "stun:stun.l.google.com:19302" }];
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  })(),
};
