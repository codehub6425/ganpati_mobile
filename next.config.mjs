/** @type {import('next').NextConfig} */

const rawBase = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath =
  rawBase !== undefined && rawBase !== ""
    ? rawBase.startsWith("/")
      ? rawBase.replace(/\/$/, "")
      : `/${rawBase.replace(/\/$/, "")}`
    : process.env.NODE_ENV === "production"
      ? "/ganpati-mobile"
      : "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
  },
  async headers() {
    return [
      {
        source: "/admin/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: basePath ? `${basePath}/admin/` : "/admin/",
          },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/admin/manifest",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
