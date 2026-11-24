/**
 * `commitFile` never throws — the EmDash design-system-editor plugin route
 * that calls this must never let a sync failure fail the save (the immediate
 * override already applies); see the module's own docblock.
 */
import { describe, expect, it } from 'vite-plus/test';
import { commitFile } from './github.ts';

function fakeFetch(responses: Record<string, { ok: boolean; status?: number; body?: unknown }>): {
  fetchImpl: typeof fetch;
  calls: { url: string; init?: RequestInit | undefined }[];
} {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const method = init?.method ?? 'GET';
    const response = responses[method] ?? responses['*'];
    if (!response) throw new Error(`no fake response registered for ${method}`);
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body,
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const base = { owner: 'getvitops', repo: 'client-site', branch: 'dev', path: 'site.json' };

describe('commitFile', () => {
  it('creates a new file when the GET 404s — no sha in the PUT body', async () => {
    const { fetchImpl, calls } = fakeFetch({
      GET: { ok: false, status: 404 },
      PUT: { ok: true, body: { commit: { sha: 'abc123' } } },
    });
    const result = await commitFile({
      ...base,
      content: '{}',
      message: 'sync',
      token: 'tok',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, status: 200, commitSha: 'abc123' });
    const putBody = JSON.parse(calls[1]?.init?.body as string) as { sha?: string };
    expect(putBody.sha).toBeUndefined();
  });

  it('updates an existing file, carrying the sha from the GET into the PUT', async () => {
    const { fetchImpl, calls } = fakeFetch({
      GET: { ok: true, body: { sha: 'existing-sha' } },
      PUT: { ok: true, body: { commit: { sha: 'new-sha' } } },
    });
    const result = await commitFile({
      ...base,
      content: '{"a":1}',
      message: 'sync',
      token: 'tok',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, status: 200, commitSha: 'new-sha' });
    const putBody = JSON.parse(calls[1]?.init?.body as string) as { sha?: string };
    expect(putBody.sha).toBe('existing-sha');
  });

  it('base64-encodes UTF-8 content correctly', async () => {
    const { fetchImpl, calls } = fakeFetch({
      GET: { ok: false, status: 404 },
      PUT: { ok: true, body: { commit: { sha: 'x' } } },
    });
    await commitFile({
      ...base,
      content: '{"name":"café"}',
      message: 'sync',
      token: 'tok',
      fetchImpl,
    });
    const putBody = JSON.parse(calls[1]?.init?.body as string) as { content: string };
    const decoded = Buffer.from(putBody.content, 'base64').toString('utf8');
    expect(decoded).toBe('{"name":"café"}');
  });

  it('never throws on a non-404 GET failure — comes back as a result', async () => {
    const { fetchImpl } = fakeFetch({ GET: { ok: false, status: 403 } });
    const result = await commitFile({
      ...base,
      content: '{}',
      message: 'sync',
      token: 'bad-token',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('never throws on a PUT failure', async () => {
    const { fetchImpl } = fakeFetch({
      GET: { ok: false, status: 404 },
      PUT: { ok: false, status: 422, body: { message: 'sha mismatch' } },
    });
    const result = await commitFile({
      ...base,
      content: '{}',
      message: 'sync',
      token: 'tok',
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, status: 422, message: '422 sha mismatch' });
  });

  it('never throws when fetch itself rejects', async () => {
    const fetchImpl = (async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const result = await commitFile({
      ...base,
      content: '{}',
      message: 'sync',
      token: 'tok',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('network-error');
  });

  it('sends the branch on both the GET ref and the PUT body', async () => {
    const { fetchImpl, calls } = fakeFetch({
      GET: { ok: false, status: 404 },
      PUT: { ok: true, body: { commit: { sha: 'x' } } },
    });
    await commitFile({ ...base, content: '{}', message: 'sync', token: 'tok', fetchImpl });
    expect(calls[0]?.url).toContain('ref=dev');
    const putBody = JSON.parse(calls[1]?.init?.body as string) as { branch: string };
    expect(putBody.branch).toBe('dev');
  });
});
