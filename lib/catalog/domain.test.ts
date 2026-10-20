import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_APP_DOMAIN, appDomain, redirectDomains } from "@/lib/catalog/domain";

describe("domain config", () => {
  const keys = [
    "APP_DOMAIN",
    "APP_REDIRECT_DOMAIN",
    "APP_REDIRECT_DOMAINS",
    "APP_URL",
    "NEXT_PUBLIC_APP_DOMAIN",
  ];
  const previous: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("defaults to ui-component-aggregator.com and www only", () => {
    for (const key of keys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    expect(appDomain()).toBe(DEFAULT_APP_DOMAIN);
    expect(DEFAULT_APP_DOMAIN).toBe("ui-component-aggregator.com");
    expect(redirectDomains()).toEqual(["www.ui-component-aggregator.com"]);
  });

  it("reads APP_DOMAIN and APP_REDIRECT_DOMAINS", () => {
    for (const key of keys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    process.env.APP_DOMAIN = "example.test";
    process.env.APP_REDIRECT_DOMAINS = "www.example.test";
    expect(appDomain()).toBe("example.test");
    expect(redirectDomains()).toEqual(["www.example.test"]);
  });
});
