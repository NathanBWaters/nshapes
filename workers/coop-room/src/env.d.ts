import type { CoopRoom } from './coopRoom';

declare global {
  namespace Cloudflare {
    interface Env {
      COOP_ROOM: DurableObjectNamespace<CoopRoom>;
    }
  }
}

export {};
