export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  retryAfter: number | null;
  constructor(message: string, status: number, errors: Record<string, string[]> = {}, retryAfter: number | null = null) {
    super(message); this.status = status; this.errors = errors; this.retryAfter = retryAfter;
  }
}

type Transport = (url: string, options: RequestInit) => Promise<Pick<Response, "status" | "ok" | "headers" | "text">>;
export function createApiClient(baseUrl: string, getToken: () => string | null = () => null, onUnauthorized: () => void = () => {}, now: () => number = Date.now, send: Transport = (url, options) => fetch(url, options)) {
  const root = baseUrl.replace(/\/+$/, "");
  let blockedUntil = 0;
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!/^https?:\/\//.test(root)) throw new Error("Set EXPO_PUBLIC_API_URL to the Laravel server URL including /api/v1.");
    const remaining = Math.ceil((blockedUntil - now()) / 1000);
    if (remaining > 0) throw new ApiError(`Battlefront is receiving too many requests. Try again in ${remaining} seconds.`, 429, {}, remaining);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const token = getToken();
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      const response = await send(`${root}/${path.replace(/^\//, "")}`, { ...options, headers, signal: controller.signal });
      if (response.status === 204) return undefined as T;
      let payload: { message?: string; errors?: Record<string, string[]> } = {};
      let validJson = false;
      try {
        const parsed = JSON.parse(await response.text());
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) { payload = parsed; validJson = true; }
      } catch { /* Keep HTTP failures distinct from connection failures. */ }
      if (!response.ok) {
        if (response.status === 429) {
          const header = response.headers.get("Retry-After");
          const seconds = header === null ? 60 : Number(header);
          const cooldown = Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : 60;
          blockedUntil = Math.max(blockedUntil, now() + cooldown * 1000);
          throw new ApiError(`Battlefront is receiving too many requests. Try again in ${Math.ceil((blockedUntil - now()) / 1000)} seconds.`, 429, {}, cooldown);
        }
        if (response.status === 401 && token && getToken() === token) onUnauthorized();
        const errors = payload.errors ?? {};
        const fallback = response.status === 413 ? "Payment proof is too large for the server. Choose a smaller image."
          : `Battlefront could not complete the request (HTTP ${response.status}). Please try again or contact the store.`;
        const message = Object.values(errors).flat().join("\n") || payload.message || fallback;
        throw new ApiError(String(message), response.status, errors, response.headers.has("Retry-After") ? Number(response.headers.get("Retry-After")) : null);
      }
      if (!validJson) throw new ApiError("Battlefront returned an unexpected response. If you submitted an order, check My orders before trying again.", response.status);
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(error instanceof Error && error.name === "AbortError" ? "The server took too long to respond. Please try again." : "Cannot reach Battlefront. Check the API address and Wi-Fi connection.");
    } finally { clearTimeout(timeout); }
  };
}

export type Page<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } };

export function createPacedRead(request: <T>(path: string) => Promise<T>, intervalMs = 2500, now: () => number = Date.now, wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
  let tail = Promise.resolve();
  let nextRequestAt = 0;
  return function read<T>(path: string): Promise<T> {
    const result = tail.then(async () => {
      const delay = nextRequestAt - now();
      if (delay > 0) await wait(delay);
      nextRequestAt = now() + intervalMs;
      return request<T>(path);
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

export function createCachedRead<T>(load: () => Promise<T>, maxAgeMs: number, now: () => number = Date.now) {
  let cached: Promise<T> | null = null;
  let pending = false;
  let expiresAt = 0;
  let invalidated = false;
  return {
    read() {
      if (cached && (pending || now() < expiresAt)) return cached;
      pending = true;
      invalidated = false;
      const current = Promise.resolve().then(load).then((value) => {
        if (cached === current) { pending = false; expiresAt = invalidated ? 0 : now() + maxAgeMs; }
        return value;
      }, (error) => {
        if (cached === current) { cached = null; pending = false; }
        throw error;
      });
      cached = current;
      return current;
    },
    invalidate() {
      // Finish an active load before another read can start a duplicate pagination run.
      if (pending) { invalidated = true; return; }
      cached = null;
      expiresAt = 0;
    },
  };
}

export function retryRateLimitedRead(request: <T>(path: string) => Promise<T>, wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
  return async function read<T>(path: string): Promise<T> {
    try { return await request<T>(path); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 429) throw error;
      const seconds = error.retryAfter !== null && Number.isFinite(error.retryAfter) && error.retryAfter >= 0 ? error.retryAfter : 60;
      await wait(seconds * 1000);
      return request<T>(path);
    }
  };
}

export async function collectPages<T>(request: <R>(path: string) => Promise<R>, path: string): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  while (true) {
    const result = await request<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}`);
    rows.push(...result.data);
    if (page >= result.meta.last_page) return rows;
    page++;
  }
}
