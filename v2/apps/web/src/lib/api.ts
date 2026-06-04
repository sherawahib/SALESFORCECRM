/** Same-origin proxy via next.config rewrites — avoids CORS issues */
const API = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  department?: { slug: string; name: string };
  designation?: { slug: string; name: string };
  permissions: string[];
};

function token() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = (await res.json()) as { error?: string; message?: string };
      message = err.error || err.message || message;
    } catch {
      try {
        message = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  return api<{
    accessToken: string;
    refreshToken: string;
    permissions: string[];
    user: {
      id: number;
      name: string;
      email: string;
      department: { slug: string; name: string };
      designation: { slug: string; name: string };
    };
  }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function saveSession(access: string, refresh: string, user: AuthUser) {
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
  localStorage.setItem('user', JSON.stringify(user));
}

export function loadUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function can(perms: string[] | undefined, slug: string) {
  if (!perms) return false;
  return perms.includes('*.*.*') || perms.includes(slug);
}
