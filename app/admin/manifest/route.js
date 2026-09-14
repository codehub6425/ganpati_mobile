import { getBasePath } from "@/lib/basePath";

function getOrigin(request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function GET(request) {
  const base = getBasePath();
  const origin = getOrigin(request);
  const startUrl = `${base}/admin/login`;
  const scope = `${base}/admin/`;
  const manifestUrl = `${origin}${base}/admin/manifest`;

  const manifest = {
    id: `${base}/admin`,
    name: "Ganpati Admin",
    short_name: "GMP Admin",
    description: "Ganpati Mobile Point admin and staff app",
    start_url: startUrl,
    scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0f1728",
    theme_color: "#0f1728",
    lang: "en",
    prefer_related_applications: false,
    related_applications: [
      {
        platform: "webapp",
        url: manifestUrl,
      },
    ],
    launch_handler: {
      client_mode: ["navigate-existing", "auto"],
    },
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
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
