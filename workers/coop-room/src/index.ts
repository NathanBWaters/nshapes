import {
  generateRoomCode,
  normalizeRoomCode,
  type CoopCreateRoomResponse,
} from '../../../src/coop/protocol';
import { CoopRoom, type Env } from './coopRoom';

export { CoopRoom };
export type { Env };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function withCors(response: Response): Response {
  // Never wrap a 101 WebSocket upgrade response; browsers & workerd require the original upgrade Response.
  if (response.status === 101) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return withCors(Response.json(body, { status }));
}

async function handleCreateRoom(env: Env): Promise<Response> {
  // Retry up to 8 times in the rare event a randomly generated 4-char code is already active.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    const stub = env.COOP_ROOM.getByName(code);
    const result = await stub.initRoom(code);
    if (result.initialized) {
      const payload: CoopCreateRoomResponse = {
        code: result.code,
        wsPath: `/room/${result.code}/ws`,
      };
      return jsonResponse(payload, 201);
    }
  }
  return jsonResponse({ error: 'Unable to allocate unique room code.' }, 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && path === '/health') {
        return jsonResponse({ ok: true });
      }

      if (request.method === 'POST' && path === '/room') {
        return await handleCreateRoom(env);
      }

      const wsMatch = /^\/room\/([^/]+)\/ws$/i.exec(path);
      if (request.method === 'GET' && wsMatch) {
        const code = normalizeRoomCode(decodeURIComponent(wsMatch[1]));
        if (!code) {
          return jsonResponse({ error: 'Invalid 4-character room code.' }, 400);
        }
        const stub = env.COOP_ROOM.getByName(code);
        return await stub.fetch(request);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      console.error({ message: 'coop-room worker error', error: message });
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
