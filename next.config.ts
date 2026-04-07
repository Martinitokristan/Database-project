import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mysql2', 'bcryptjs', 'jsonwebtoken'],
};

export default nextConfig;
