export const CSP_NONCE_HEADER = "x-csp-nonce";

export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Everything is same-origin: no third-party script, font, frame or API.
 * Scripts need the per-request nonce, which Next reads from the request's
 * own Content-Security-Policy header and stamps on what it emits.
 */
export function buildCsp(nonce: string): string {
  // React's dev build uses eval() to rebuild server stack frames. Never shipped.
  const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join("; ");
}
