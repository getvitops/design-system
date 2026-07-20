// Browser-side Better-Auth client (used in island <script> tags on the auth
// pages + the header). baseURL defaults to window.location.origin.
import { createAuthClient } from 'better-auth/client';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ plugins: [organizationClient()] });
