import "server-only";

// Never derive email destinations from an untrusted Host/Origin header.
export function siteUrl(): string {
  const value = process.env.SITE_URL;
  if (!value)
    throw new Error("SITE_URL is required for authentication email links.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "SITE_URL must be a trusted HTTPS origin (HTTP allowed on localhost).",
    );
  }
  return url.origin;
}
