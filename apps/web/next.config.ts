import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const estimatorUrl =
      process.env.ESTIMATOR_API_URL || "http://localhost:8001";
    const analyticsUrl =
      process.env.ANALYTICS_API_URL || "http://localhost:8002";
    return [
      {
        source: "/api/estimator/:path*",
        destination: `${estimatorUrl}/:path*`,
      },
      {
        source: "/api/analytics/:path*",
        destination: `${analyticsUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
