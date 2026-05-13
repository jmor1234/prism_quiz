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
      {
        source: "/quiz/best-life-care",
        destination: "/quiz/best-life-harbor",
        permanent: true,
      },
      {
        source: "/admin/best-life-care",
        destination: "/admin/best-life-harbor",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
