export const DEFAULT_APP_DOMAIN = "ui-component-aggregator.com";

export function appDomain(): string {
  return (
    process.env.APP_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_DOMAIN ??
    DEFAULT_APP_DOMAIN
  );
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const domain = appDomain();
  if (
    process.env.NODE_ENV !== "production" ||
    domain === "localhost" ||
    domain.startsWith("127.")
  ) {
    return process.env.NODE_ENV === "production"
      ? `https://${domain}`
      : "http://127.0.0.1:4321";
  }
  return `https://${domain}`;
}

/** Hosts that 301 to the apex. Default is www only — no secondary domain. */
export function redirectDomains(): string[] {
  const raw = process.env.APP_REDIRECT_DOMAINS;
  if (raw?.trim()) {
    return raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [`www.${appDomain()}`];
}

export function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".local")
  );
}
