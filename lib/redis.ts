// Minimal Upstash Redis client over the REST API (no extra dependency).
// Accepts either the Upstash variable names or the Vercel KV names.

type Command = (string | number)[];

function getConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function isRedisConfigured(): boolean {
  return getConfig() !== null;
}

export async function redisPipeline(commands: Command[]): Promise<unknown[]> {
  const config = getConfig();
  if (!config) throw new Error("Redis is not configured");

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis request failed with status ${response.status}`);
  }

  const results = (await response.json()) as {
    result?: unknown;
    error?: string;
  }[];
  const failed = results.find((item) => item.error);
  if (failed) throw new Error(`Redis error: ${failed.error}`);

  return results.map((item) => item.result);
}
