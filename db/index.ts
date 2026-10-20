import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle as drizzleDataApi } from "drizzle-orm/aws-data-api/pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Set DATABASE_URL for local Postgres, or AURORA_CLUSTER_ARN + AURORA_SECRET_ARN + AURORA_DATABASE for the RDS Data API.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
  rdsData?: RDSDataClient;
};

export function usesDataApi(): boolean {
  return Boolean(
    process.env.AURORA_CLUSTER_ARN &&
      process.env.AURORA_SECRET_ARN &&
      (process.env.AURORA_DATABASE || process.env.AURORA_DB_NAME),
  );
}

function auroraDatabase(): string {
  return process.env.AURORA_DATABASE || process.env.AURORA_DB_NAME || "component_library";
}

function getPostgresDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  if (!globalForDb.postgres) {
    globalForDb.postgres = postgres(url, {
      max: process.env.NODE_ENV === "production" ? 4 : 8,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return drizzlePostgres(globalForDb.postgres, { schema });
}

function getDataApiDb() {
  const resourceArn = process.env.AURORA_CLUSTER_ARN;
  const secretArn = process.env.AURORA_SECRET_ARN;
  if (!resourceArn || !secretArn) throw new DatabaseNotConfiguredError();
  if (!globalForDb.rdsData) {
    globalForDb.rdsData = new RDSDataClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-2",
    });
  }
  return drizzleDataApi(globalForDb.rdsData, {
    database: auroraDatabase(),
    resourceArn,
    secretArn,
    schema,
  });
}

type PostgresDb = ReturnType<typeof getPostgresDb>;

export function getDb(): PostgresDb {
  if (usesDataApi()) return getDataApiDb() as unknown as PostgresDb;
  return getPostgresDb();
}

export function getDataApiMigratorDb() {
  if (!usesDataApi()) throw new DatabaseNotConfiguredError();
  return getDataApiDb();
}

export type Database = PostgresDb;
