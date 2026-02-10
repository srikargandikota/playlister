const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export interface ApiOptions {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T = unknown>(options: ApiOptions): Promise<T> {
  const url = `${BASE_URL}${options.path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

