import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deadline counts, search, and Postgres reads are request-time. Cache
  // Components would prerender that data into a stale shell.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
