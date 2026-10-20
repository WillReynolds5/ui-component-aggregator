import "dotenv/config";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";
import { getDataApiMigratorDb, usesDataApi } from "@/db";

async function main() {
  if (!usesDataApi()) {
    throw new Error(
      "AURORA_CLUSTER_ARN, AURORA_SECRET_ARN, and AURORA_DATABASE are required (RDS Data API).",
    );
  }

  const folder = resolve(process.cwd(), "drizzle/migrations");
  console.log("Migrating via RDS Data API from %s ...", folder);
  await migrate(getDataApiMigratorDb(), { migrationsFolder: folder });
  console.log("Migrations applied (includes CREATE EXTENSION vector and pg_trgm).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
