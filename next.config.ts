import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Import only the icons/helpers actually used instead of walking the whole
    // package graph on every compile and build.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  typedRoutes: false,
};

export default nextConfig;
