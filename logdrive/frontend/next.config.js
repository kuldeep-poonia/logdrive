/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // PixiJS expects a single canvas; strict mode double-mounts
};
module.exports = nextConfig;