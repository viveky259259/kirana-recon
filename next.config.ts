import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't get confused by a stray lockfile in
  // the home directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
