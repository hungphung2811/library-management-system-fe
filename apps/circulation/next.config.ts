import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@mfe/ui", "@mfe/api"],
  // Mọi route của zone nằm dưới /circulation
  basePath: "/circulation",
  // Asset tách prefix riêng để không đụng /_next của shell
  assetPrefix: "/circulation-static",
  async rewrites() {
    return [{ source: "/circulation-static/_next/:path+", destination: "/_next/:path+" }];
  },
};
export default config;
