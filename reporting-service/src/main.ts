import "dotenv/config";
import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import cron from "node-cron";
import mysql from "mysql2/promise";

const PORT = Number(process.env.PORT || 3003);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(process.cwd(), "artifacts");
const CRON_DAILY = process.env.CRON_DAILY || "0 9 * * *"; // 09:00
const REPLICA_LAG_MAX_SECONDS = Number(process.env.REPLICA_LAG_MAX_SECONDS || 10);
const QUERY_TIMEOUT_MS = Number(process.env.QUERY_TIMEOUT_MS || 15000);

const REPORT_TYPE_DAILY = "DAILY_ORDERS";

type MenuCategory = "SOUP" | "MAIN" | "DESSERT" | "RESERVE";
type ReportStatus = "RUNNING" | "SUCCESS" | "FAILED";
type ReportSource = "REPLICA";

type SnapshotItem = { category: MenuCategory; optionId: string; optionName: string };

type DailyRow = {
  childId: string;
  childName: string;
  className: string;
  status: string;
  soup: string;
  main: string;
  dessert: string;
  reserve: string;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mustEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

function mkPool(prefix: "REPLICA" | "META") {
  return mysql.createPool({
    host: mustEnv(`${prefix}_HOST`),
    port: Number(mustEnv(`${prefix}_PORT`)),
    user: mustEnv(`${prefix}_USER`),
    password: mustEnv(`${prefix}_PASSWORD`),
    database: mustEnv(`${prefix}_DB`),
    waitForConnections: true,
    connectionLimit: prefix === "REPLICA" ? 10 : 5,
    enableKeepAlive: true,
    timezone: "local",
    dateStrings: true, // Forțează driverul să citească datele ca string-uri, evitând conversia în obiecte Date de JS
    // typeCast: function (field, next) {
    //   if (field.type === 'DATETIME') {
    //     return field.string(); // Returnează data exact cum e în DB
    //   }
    //   return next();
    // }
  });
}

const replicaPool = mkPool("REPLICA"); // heavy reads
const metaPool = mkPool("META"); // small writes

async function ensureDirs() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

async function applyMigrations() {
  // Supports running inside docker (/app) or locally (cwd)
  const candidates = [
    path.join("/app/migrations", "001_reports.sql"),
    path.join(process.cwd(), "migrations", "001_reports.sql"),
  ];

  let sql: string | null = null;
  for (const p of candidates) {
    try {
      sql = await fs.readFile(p, "utf-8");
      break;
    } catch {
      // ignore
    }
  }

  if (!sql) throw new Error("Cannot find migrations/001_reports.sql");
  await metaPool.query(sql);
}

async function getReplicaLagSeconds(): Promise<{ isReplica: boolean; lagSeconds: number | null }> {
  // MySQL 8: SHOW REPLICA STATUS (returns 0 rows if not a replica)
  // (older MySQL used SHOW SLAVE STATUS)
  const [rows] = await replicaPool.query<any[]>("SHOW REPLICA STATUS");
  if (!rows || rows.length === 0) return { isReplica: false, lagSeconds: null };

  const lag = rows[0]?.Seconds_Behind_Source ?? null;
  const lagNum = typeof lag === "number" ? lag : lag == null ? null : Number(lag);
  return { isReplica: true, lagSeconds: Number.isFinite(lagNum as number) ? (lagNum as number) : null };
}

async function createOrGetRunning(type: string, reportDate: string): Promise<{ id: string; status: ReportStatus; created: boolean }> {
  const id = crypto.randomUUID();
  try {
    await metaPool.execute(
      `INSERT INTO reports (id, type, report_date, as_of, source, status)
       VALUES (?, ?, ?, NOW(), 'REPLICA', 'RUNNING')`,
      [id, type, reportDate]
    );
    return { id, status: "RUNNING", created: true };
  } catch (e: any) {
    // likely duplicate on UNIQUE(type, report_date)
    const [rows] = await metaPool.execute<any[]>(
      `SELECT id, status FROM reports WHERE type=? AND report_date=? LIMIT 1`,
      [type, reportDate]
    );
    const r = rows?.[0];
    return { id: r?.id, status: (r?.status as ReportStatus) ?? "FAILED", created: false };
  }
}

async function markSuccess(id: string, csvPath: string, jsonPath: string, sha: string) {
  await metaPool.execute(
    `UPDATE reports
     SET status='SUCCESS',
         artifact_csv_path=?,
         artifact_json_path=?,
         checksum_sha256=?,
         as_of=NOW(),
         error_message=NULL
     WHERE id=?`,
    [csvPath, jsonPath, sha, id]
  );
}

async function markFailed(id: string, msg: string) {
  await metaPool.execute(
    `UPDATE reports SET status='FAILED', error_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [msg, id]
  );
}

function safeParseSnapshot(snapRaw: any): SnapshotItem[] {
  if (!snapRaw) return [];
  try {
    if (typeof snapRaw === "string") return JSON.parse(snapRaw);
    return snapRaw as SnapshotItem[];
  } catch {
    return [];
  }
}

function pick(items: SnapshotItem[], cat: MenuCategory): string {
  return items.find((x) => x.category === cat)?.optionName || "";
}

async function generateDaily(reportDate: string): Promise<{ rows: DailyRow[]; summary: any }> {
  // Prisma tables likely named exactly like models: `Order`, `OrderSelection`, `Child`
  // `Order` is reserved -> backticks required
  const sql = `
    SELECT
      o.childId AS childId,
      c.name AS childName,
      c.class AS className,
      o.status AS status,
      os.snapshot AS snapshot
    FROM \`Order\` o
    LEFT JOIN Child c ON c.id = o.childId
    LEFT JOIN OrderSelection os ON os.orderId = o.id
    WHERE DATE(o.orderDate) = ?
      AND o.status <> 'CANCELED'
    ORDER BY c.class, c.name
  `;

  const conn = await replicaPool.getConnection();
  try {
    // Query timeout (ms) in MySQL 8 via MAX_EXECUTION_TIME in optimizer hint or session variable.
    // This session var works for SELECT in many setups:
    await conn.query(`SET SESSION MAX_EXECUTION_TIME=${QUERY_TIMEOUT_MS}`);

    const [rows] = await conn.execute<any[]>(sql, [reportDate]);

    const out: DailyRow[] = [];
    const byStatus: Record<string, number> = {};

    const countsByCategory: Record<MenuCategory, Record<string, number>> = {
      SOUP: {},
      MAIN: {},
      DESSERT: {},
      RESERVE: {},
    };

    const bump = (cat: MenuCategory, val: string) => {
      if (!val) return;
      countsByCategory[cat][val] = (countsByCategory[cat][val] ?? 0) + 1;
    };

    for (const r of rows) {
      const items = safeParseSnapshot(r.snapshot);

      const row: DailyRow = {
        childId: r.childId || "",
        childName: r.childName || "",
        className: r.className || "",
        status: r.status || "",
        soup: pick(items, "SOUP"),
        main: pick(items, "MAIN"),
        dessert: pick(items, "DESSERT"),
        reserve: pick(items, "RESERVE"),
      };

      out.push(row);

      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      bump("SOUP", row.soup);
      bump("MAIN", row.main);
      bump("DESSERT", row.dessert);
      bump("RESERVE", row.reserve);
    }

    const summary = {
      date: reportDate,
      asOf: new Date().toLocaleString('sv-SE').replace(' ', 'T'),
      totalOrders: out.length,
      byStatus,
      countsByCategory,
    };

    return { rows: out, summary };
  } finally {
    conn.release();
  }
}

function toCSV(rows: DailyRow[]): string {
  const header = ["childId", "childName", "class", "status", "soup", "main", "dessert", "reserve"];

  const esc = (v: string) => {
    const s = v ?? "";
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.childId, r.childName, r.className, r.status, r.soup, r.main, r.dessert, r.reserve].map(esc).join(",")
    );
  }
  return lines.join("\n");
}

async function writeArtifact(rel: string, content: string | Buffer) {
  const abs = path.join(ARTIFACT_DIR, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  return abs;
}

function sha256Hex(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function runDaily(reportDate: string) {
  const { id, status, created } = await createOrGetRunning(REPORT_TYPE_DAILY, reportDate);

  if (!created && status === "SUCCESS") {
    return { reportId: id, skipped: true };
  }

  // Advanced gating: replica lag
  const lag = await getReplicaLagSeconds();
  if (lag.isReplica && lag.lagSeconds != null && lag.lagSeconds > REPLICA_LAG_MAX_SECONDS) {
    const msg = `Replica lag too high: ${lag.lagSeconds}s > ${REPLICA_LAG_MAX_SECONDS}s`;
    await markFailed(id, msg);
    throw new Error(msg);
  }

  try {
    const { rows, summary } = await generateDaily(reportDate);

    const csv = toCSV(rows);
    const json = JSON.stringify(summary, null, 2);

    const csvBuf = Buffer.from(csv, "utf-8");
    const sha = sha256Hex(csvBuf);

    const relCSV = path.join("daily", reportDate, `${id}.csv`);
    const relJSON = path.join("daily", reportDate, `${id}.json`);

    const absCSV = await writeArtifact(relCSV, csvBuf);
    const absJSON = await writeArtifact(relJSON, json);

    await markSuccess(id, absCSV, absJSON, sha);

    return { reportId: id, skipped: false };
  } catch (e: any) {
    await markFailed(id, e?.message || "generate failed");
    throw e;
  }
}

// ------------------- API -------------------
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).send("ok"));

// manual trigger: POST /jobs/daily?date=YYYY-MM-DD
app.post("/jobs/daily", async (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "missing or invalid date=YYYY-MM-DD" });
  }
  try {
    const r = await runDaily(date);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "job failed" });
  }
});

// list reports
app.get("/reports", async (req, res) => {
  const type = String(req.query.type || "");
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  const limit = parseInt(String(req.query.limit || "50"), 10);

  try {
    const [rows] = await metaPool.query<any[]>(
      `
      SELECT
        id,
        type,
        DATE_FORMAT(report_date,'%Y-%m-%d') AS reportDate,
        as_of AS asOf,
        source,
        status,
        artifact_csv_path AS artifactCsvPath,
        artifact_json_path AS artifactJsonPath,
        checksum_sha256 AS checksumSha256,
        error_message AS errorMessage,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM reports
      WHERE (? = '' OR type = ?)
        AND (? = '' OR report_date >= NULLIF(?, ''))
        AND (? = '' OR report_date <= NULLIF(?, ''))
      ORDER BY report_date DESC, created_at DESC
      LIMIT ?
      `,
      [type, type, from, from, to, to, limit]
    );

    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: error.message });
  }
});

// get report
app.get("/reports/:id", async (req, res) => {
  const id = req.params.id;
  const [rows] = await metaPool.execute<any[]>(
    `
    SELECT
      id,
      type,
      DATE_FORMAT(report_date,'%Y-%m-%d') AS reportDate,
      as_of AS asOf,
      source,
      status,
      artifact_csv_path AS artifactCsvPath,
      artifact_json_path AS artifactJsonPath,
      checksum_sha256 AS checksumSha256,
      error_message AS errorMessage,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM reports
    WHERE id=?
    LIMIT 1
    `,
    [id]
  );

  if (!rows?.[0]) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

// download
app.get("/reports/:id/download", async (req, res) => {
  const id = req.params.id;
  const format = String(req.query.format || "csv");

  const [rows] = await metaPool.execute<any[]>(
    `SELECT artifact_csv_path AS csvPath, artifact_json_path AS jsonPath, status FROM reports WHERE id=? LIMIT 1`,
    [id]
  );

  const r = rows?.[0];
  if (!r) return res.status(404).json({ error: "not found" });
  if (r.status !== "SUCCESS") return res.status(409).json({ error: "report not ready" });

  const filePath = format === "json" ? r.jsonPath : r.csvPath;
  if (!filePath) return res.status(404).json({ error: "artifact missing" });

  res.sendFile(filePath);
});

// boot
async function main() {
  await ensureDirs();
  await applyMigrations();

  cron.schedule(CRON_DAILY, async () => {
    const date = ymd(new Date());
    try {
      const r = await runDaily(date);
      console.log("[cron] daily", date, r);
    } catch (e: any) {
      console.error("[cron] daily failed", date, e?.message || e);
    }
  });

  app.listen(PORT, () => {
    console.log(`reporting-service listening on :${PORT}`);
  });
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
