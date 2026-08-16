const TTL_SECONDS = 24 * 60 * 60;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export default async function handler(request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const token = process.env.TURNTOKEN;
  const keyId = process.env.TURNKEYID;
  if (!token || !keyId) {
    return json({ error: "TURN is not configured", missing: [!token ? "TURNTOKEN" : null, !keyId ? "TURNKEYID" : null].filter(Boolean) }, 503);
  }

  try {
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: TTL_SECONDS })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.iceServers) return json({ error: "TURN credential service unavailable" }, 502);

    const iceServers = payload.iceServers.map((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return { ...server, urls: urls.filter((url) => typeof url === "string" && !/:53(?:\?|$)/.test(url)) };
    }).filter((server) => server.urls.length);

    if (!iceServers.some((server) => server.urls.some((url) => /^turns?:/i.test(url)))) {
      return json({ error: "TURN credential service returned no relay" }, 502);
    }

    return json({ iceServers, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  } catch (error) {
    console.error("TURN credential error", error);
    return json({ error: "TURN credential service unavailable" }, 502);
  }
}

export const config = { path: "/api/turn-credentials" };
