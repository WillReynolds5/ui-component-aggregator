import { sql, type SQL } from "drizzle-orm";
import type { PgEnum } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * `column = value` for a Postgres enum column. Use it instead of `eq` for every enum column.
 * The RDS Data API binds every string parameter as `text`, and Postgres has no
 * `enum = text` operator, so production needs the explicit cast. Local postgres-js infers
 * the type, which is why plain `eq` passes locally and fails only in production.
 * (Assignments in INSERT/UPDATE are fine without it.)
 */
export function enumEq<T extends [string, ...string[]]>(
  column: AnyPgColumn,
  value: T[number],
  pgEnum: PgEnum<T>,
): SQL {
  return sql`${column} = cast(${value} as ${sql.identifier(pgEnum.enumName)})`;
}
