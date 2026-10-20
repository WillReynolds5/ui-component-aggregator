import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unhealthy",
      },
      { status: 503 },
    );
  }
}
