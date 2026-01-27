import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/quiz",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
