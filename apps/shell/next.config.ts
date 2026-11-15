import type { NextConfig } from "next";
import { ZONES } from "./lib-zone-proxy";

const config: NextConfig = {
  transpilePackages: ["@mfe/ui", "@mfe/api"],
  // Chỉ còn zone admin là app riêng: trang của nó đi qua route handler (app/admin/[[...path]]/route.ts) để có fallback khi zone chết.
  // Asset tĩnh của zone thì rewrite thẳng sang zone. Rewrite này được tính LÚC BUILD, nên ADMIN_URL phải đặt cả khi build.
  async rewrites() {
    return Object.entries(ZONES).map(([name, url]) => ({
      source: `/${name}-static/:path+`,
      destination: `${url}/${name}-static/:path+`,
    }));
  },
};
export default config;
