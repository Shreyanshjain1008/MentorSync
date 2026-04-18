const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
const explicitWsBaseUrl = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_WS_BASE_URL;

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

export const env = {
  apiBaseUrl,
  wsBaseUrl: explicitWsBaseUrl ? toWebSocketUrl(explicitWsBaseUrl) : toWebSocketUrl(apiBaseUrl),
};
