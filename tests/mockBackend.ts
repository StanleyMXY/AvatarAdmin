// Runs the fake backend of mock/ behind `fetch`, so a page test talks to the same handlers the dev
// server uses (no server, no network). Usage:
//   resetStore(); signInAs('root'); useMockBackend(configMock, statsMock);
import { vi } from 'vitest';
import type { MockReq, MockRes } from '../mock/_core/http';
import { issueToken } from '../mock/_core/store';
import { adminOf } from '../mock/_core/testing';
import { resetSessionState, setToken } from '../src/request/session';

type Handler = (req: MockReq, res: MockRes) => unknown;
type MockModule = Record<string, Handler>;

const compile = (pattern: string) => {
  const [method, path] = pattern.split(' ');
  const names: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { method, regex: new RegExp(`^${source}$`), names };
};

/** Signs the test in as one of the preset administrators (the token goes to the session layer). */
export function signInAs(username: string): void {
  resetSessionState();
  sessionStorage.clear();
  setToken(issueToken(adminOf(username)).token);
}

export type MockCall = { method: string; url: string; body: unknown };

/** Replaces `fetch` with the mock handlers (default exports of the given mock modules). Returns the calls made. */
export function useMockBackend(...modules: { default: unknown }[]): MockCall[] {
  const routes = modules.flatMap((m) =>
    Object.entries(m.default as MockModule).map(([pattern, handler]) => ({
      ...compile(pattern),
      handler,
    })),
  );
  const calls: MockCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const method = (init.method ?? 'GET').toUpperCase();
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: `${url.pathname}${url.search}`, body });
      for (const route of routes) {
        const match = route.regex.exec(url.pathname);
        if (route.method !== method || !match) continue;
        const params = Object.fromEntries(
          route.names.map((name, i) => [name, decodeURIComponent(match[i + 1])]),
        );
        const headers = Object.fromEntries(
          Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
            k.toLowerCase(),
            v,
          ]),
        );
        let status = 0;
        let payload: unknown;
        const res: MockRes = {
          status(code) {
            status = code;
            return res;
          },
          json(value) {
            payload = value;
            return undefined;
          },
        };
        await route.handler(
          {
            method,
            url: url.pathname,
            headers,
            query: Object.fromEntries(url.searchParams),
            params,
            body,
          },
          res,
        );
        return new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ code: 'RESOURCE_NOT_FOUND', message: 'no mock', data: null }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        },
      );
    }),
  );
  return calls;
}
