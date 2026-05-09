import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist({
  // Next.js config
  // output: 'export',
  images: { unoptimized: true },
  reactStrictMode: false, // Disabling strict mode in dev can speed up rendering
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'exceljs'],
  },
  turbopack: {},
  allowedDevOrigins: ['192.168.1.11', 'localhost', '192.168.1.7'],
});
