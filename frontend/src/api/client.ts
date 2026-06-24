const BASE = import.meta.env.VITE_API_BASE_URL || '';

let token: string | null = localStorage.getItem('rl_token');

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('rl_token', t);
  else localStorage.removeItem('rl_token');
}

export function getToken() {
  return token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    if (!path.startsWith('/api/auth')) window.location.href = '/login';
  }
  if (!res.ok) {
    let msg = `エラー (${res.status})`;
    try {
      const data = await res.json();
      msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
  baseUrl: BASE,
};
