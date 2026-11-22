import type { MetadataRoute } from "next";

// Tracking pages are private links and the panel is for staff: neither
// belongs in a search index.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/r/", "/api/"] }] };
}
