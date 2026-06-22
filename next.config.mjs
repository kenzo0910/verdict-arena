/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the 0G SDKs out of the webpack bundle — they rely on Node
    // built-ins (fs, crypto) and only run inside API routes.
    serverComponentsExternalPackages: [
      "@0gfoundation/0g-compute-ts-sdk",
      "@0gfoundation/0g-storage-ts-sdk",
    ],
  },
};

export default nextConfig;
