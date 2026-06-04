import { getApp } from '@ops/api/app';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

function injectMethod(m: string): (typeof METHODS)[number] {
  return (METHODS as readonly string[]).includes(m) ? (m as (typeof METHODS)[number]) : 'GET';
}

export async function proxyToFastify(request: Request): Promise<Response> {
  const app = await getApp();
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let payload: Buffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length > 0) payload = buf;
  }

  const res = await app.inject({
    method: injectMethod(request.method),
    url: url.pathname + url.search,
    headers,
    payload,
  });

  const outHeaders = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, v));
    else outHeaders.set(key, String(value));
  }

  return new Response(res.body, { status: res.statusCode, headers: outHeaders });
}
