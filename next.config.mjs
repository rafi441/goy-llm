/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
