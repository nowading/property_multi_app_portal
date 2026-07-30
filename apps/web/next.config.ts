import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/estimator/:path*",
        destination: "http://estimator-api:8001/:path*",
      },
      {
        source: "/api/analytics/:path*",
        destination: "http://analytics-api:8002/:path*",
      },
    ];
  },
};

export default nextConfig;
