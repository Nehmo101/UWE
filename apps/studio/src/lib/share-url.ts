export function getShareLinkPublicUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return `${base}/share/${token}`;
}
