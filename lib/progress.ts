import { Pool } from "pg";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.WORKFLOW_POSTGRES_URL });
  return pool;
}

function ensureTable() {
  if (!ready) {
    ready = getPool()
      .query(`
        CREATE TABLE IF NOT EXISTS run_progress (
          run_id text NOT NULL,
          step_id text NOT NULL,
          state text NOT NULL,
          detail text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (run_id, step_id)
        );
        ALTER TABLE run_progress ADD COLUMN IF NOT EXISTS detail text;
      `)
      .then(() => undefined);
  }
  return ready;
}

export async function setStepState(runId: string, stepId: string, state: string, detail?: string) {
  await ensureTable();
  await getPool().query(
    `INSERT INTO run_progress (run_id, step_id, state, detail)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (run_id, step_id)
     DO UPDATE SET state = EXCLUDED.state,
                   detail = COALESCE(EXCLUDED.detail, run_progress.detail),
                   updated_at = now()`,
    [runId, stepId, state, detail ?? null]
  );
}

export async function getRunProgress(runId: string) {
  await ensureTable();
  const res = await getPool().query(
    `SELECT step_id, state, detail FROM run_progress
     WHERE run_id = $1
     ORDER BY created_at, step_id`,
    [runId]
  );
  const steps = Object.fromEntries(res.rows.map((row) => [row.step_id, row.state]));
  const output = res.rows.find((row) => row.step_id === "answer")?.detail ?? null;
  return { steps, output };
}