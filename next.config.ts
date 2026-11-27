import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ana adres (/) doğrudan public/index.html'deki arayüzü açar.
  // /api/* route'ları bundan etkilenmez.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
