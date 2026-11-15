/**
 * Cổng của bộ server E2E. Mặc định 3000-3003, 3100, 8090; đặt E2E_PORT_BASE (ví dụ 4000) để chạy song song
 * với dev server đang chiếm 3000-3003. Cổng gateway = base + 5090 (3000 -> 8090), shell "zone chết" = base + 100.
 */
const base = Number(process.env.E2E_PORT_BASE ?? 3000);

export const PORTS = {
  shell: base,
  catalog: base + 1,
  circulation: base + 2,
  admin: base + 3,
  shellDown: base + 100,
  /** Cổng không có ai nghe, để làm zone chết. */
  dead: base + 999,
  gateway: base + 5090,
};

export const url = (port: number) => `http://localhost:${port}`;
