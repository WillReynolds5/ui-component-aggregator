import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { enumEq } from "@/db/enum";
import { media, mediaSourceEnum } from "@/drizzle/schema";

describe("enumEq", () => {
  it("casts the parameter to the enum type, which the RDS Data API needs", () => {
    const query = new PgDialect().sqlToQuery(enumEq(media.source, "capture", mediaSourceEnum));
    expect(query.sql).toBe('"media"."source" = cast($1 as "media_source")');
    expect(query.params).toEqual(["capture"]);
  });
});
