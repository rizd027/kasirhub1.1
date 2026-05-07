import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist({
  // Next.js config
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.11', 'localhost'],
});
