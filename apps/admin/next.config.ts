import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@mfe/ui", "@mfe/api"],
  // Mọi route của zone nằm dưới /admin
  basePath: "/admin",
  // Asset tách prefix riêng để không đụng /_next của shell
  assetPrefix: "/admin-static",
  async rewrites() {
    return [{ source: "/admin-static/_next/:path+", destination: "/_next/:path+" }];
  },
};
export default config;
