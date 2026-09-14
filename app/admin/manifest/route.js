import { getBasePath } from "@/lib/basePath";

export function GET() {
  const base = getBasePath();
  const manifest = {
    id: `${base}/admin`,
    name: "Ganpati Admin",
    short_name: "GMP Admin",
    description: "Ganpati Mobile Point admin and staff app",
    start_url: `${base}/admin/login`,
    scope: `${base}/admin`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1728",
    theme_color: "#0f1728",
    lang: "en",
    icons: [
      {
        src: `${base}/admin/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/admin/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/admin/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
