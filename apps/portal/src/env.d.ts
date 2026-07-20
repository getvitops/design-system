/// <reference types="astro/client" />

import type { Auth } from './lib/auth.ts';
import type { DbBundle } from './lib/db/client.ts';
import type { ScopedTx } from './lib/db/scope.ts';
import type { Plan } from './lib/capabilities.ts';
import type { Env } from './lib/env.ts';

declare global {
  namespace App {
    interface Locals {
      env: Env;
      db: DbBundle;
      auth: Auth;
      user?: { id: string; email: string; name: string };
      session?: { activeOrganizationId?: string | null } & Record<string, unknown>;
      activeOrgId?: string;
      plan: Plan;
      /** Run a tenant-scoped transaction bound to the active org (RLS enforced). */
      scoped?: <T>(fn: (tx: ScopedTx) => Promise<T>) => Promise<T>;
    }
  }
}

export {};
