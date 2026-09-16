import { getBasePath } from "@/lib/basePath";
import { getSiteOrigin } from "@/lib/siteUrl";

export function GET(request) {
  const base = getBasePath();
  const origin = getSiteOrigin(new URL(request.url).origin);
  const root = `${origin}${base}`;

  const manifest = {
    id: `${root}/admin/`,
    name: "Ganpati Admin",
    short_name: "GMP Admin",
    description: "Ganpati Mobile Point admin and staff app",
    start_url: `${root}/admin/?source=pwa`,
    scope: `${root}/admin/`,
    display: "standalone",
    display_override: ["standalone", "fullscreen", "minimal-ui"],
    background_color: "#0f1728",
    theme_color: "#0f1728",
    lang: "en",
    prefer_related_applications: false,
    launch_handler: {
      client_mode: ["navigate-existing", "auto"],
    },
    icons: [
      {
        src: `${root}/admin/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${root}/admin/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${root}/admin/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
