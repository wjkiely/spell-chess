import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Supabase image domains if you use avatars etc.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
