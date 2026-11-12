/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
    if (!/^https?:\/\/[^/]+(?:\/[^/]+)*$/.test(apiUrl)) {
      throw new Error("API_INTERNAL_URL must be an absolute HTTP(S) origin or base path.");
    }
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
