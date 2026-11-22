/**
 * An order photo from /api/photos. A plain <img> on purpose: that route
 * authorizes each request by session cookie or tracking token, and the
 * image optimizer would fetch it server-side with neither.
 */
export function Photo({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />;
}
