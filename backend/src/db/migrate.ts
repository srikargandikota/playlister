import fs from "fs";
import path from "path";
import { pool } from "./pool";

async function runMigrations() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    // eslint-disable-next-line no-console
    console.log("Database schema applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    // eslint-disable-next-line no-console
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration script error:", err);
  process.exitCode = 1;
});

