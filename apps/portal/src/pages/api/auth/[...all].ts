// Better-Auth catch-all: /api/auth/* → the auth handler (sign-up/in/out,
// session, organization plugin endpoints). The instance is on locals (middleware).
import type { APIRoute } from 'astro';

export const prerender = false;

export const ALL: APIRoute = ({ locals, request }) => locals.auth.handler(request);
