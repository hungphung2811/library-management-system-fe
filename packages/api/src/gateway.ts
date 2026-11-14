import { GATEWAY_URL, type ApiError } from "./config";
import { getSession } from "./session";

export class GatewayError extends Error {
  constructor(public status: number, public body?: ApiError) {
    super(body?.message ?? `Gateway trả về ${status}`);
  }
}

/** Gọi API Gateway từ server component kèm Bearer token lấy từ cookie. */
export async function gatewayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new GatewayError(res.status, await res.json().catch(() => undefined));
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
