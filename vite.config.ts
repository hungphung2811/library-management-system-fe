import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// lms-api (BFF) mặc định ở 8085; đổi bằng VITE_API_TARGET. Trình duyệt chỉ gọi /api/** cùng origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxy = {
    "/api": { target: env.VITE_API_TARGET || "http://localhost:8085", changeOrigin: true },
  };
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: {
      rollupOptions: {
        output: {
          // Mỗi nhóm nghiệp vụ một chunk: tải khi vào nhóm đó (router.tsx dùng React.lazy theo từng trang).
          manualChunks(id) {
            // Thư viện dùng chung (react, antd...) một chunk riêng, nếu không Rollup nhét chúng vào chunk nhóm đầu tiên.
            if (id.includes("node_modules")) return "vendor";
            const m =/\/src\/pages\/(catalog|circulation|admin|platform|sales)\//.exec(id.replaceAll("\\", "/"));
            if (m) return m[1];
            // Phần còn lại của src (ui, auth, api, trang nền) vào chunk chính để các chunk nhóm không kéo chúng theo.
            return "app";
          },
        },
      },
    },
    server: { port: 3000, proxy },
    preview: { port: 3000, proxy },
  };
});
