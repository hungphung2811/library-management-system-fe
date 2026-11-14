import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@mfe/ui", "@mfe/api"],
  // Mọi route của zone nằm dưới /catalog
  basePath: "/catalog",
  // Asset tách prefix riêng để không đụng /_next của shell
  assetPrefix: "/catalog-static",
  async rewrites() {
    return [{ source: "/catalog-static/_next/:path+", destination: "/_next/:path+" }];
  },
};
export default config;
