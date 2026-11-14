import type { NextConfig } from "next";
import { ZONES } from "./lib-zone-proxy";

const config: NextConfig = {
  transpilePackages: ["@mfe/ui", "@mfe/api"],
  // Trang của zone đi qua route handler (app/<zone>/[[...path]]/route.ts) để có fallback khi zone chết.
  // Asset tĩnh của zone thì rewrite thẳng sang zone.
  async rewrites() {
    return Object.entries(ZONES).map(([name, url]) => ({
      source: `/${name}-static/:path+`,
      destination: `${url}/${name}-static/:path+`,
    }));
  },
};
export default config;
