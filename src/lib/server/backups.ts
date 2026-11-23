/** Automatic SQLite backups: before each migration and once per new app version. */
import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config';
import { version } from '$app/env';

const DIR = join(DATA_DIR, 'backups');
const KEEP = 10;

function snapshot(db: DatabaseSync, label: string) {
	mkdirSync(DIR, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const file = join(DIR, `auto-${stamp}-${label}.db`);
	db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
	const autos = readdirSync(DIR)
		.filter((f) => f.startsWith('auto-'))
		.sort();
	for (const old of autos.slice(0, Math.max(0, autos.length - KEEP))) rmSync(join(DIR, old));
}

export function backupBeforeMigrating(db: DatabaseSync, schema: number) {
	snapshot(db, `v${schema}`);
}

export function backupOnNewVersion(db: DatabaseSync) {
	const row = db.prepare(`SELECT value FROM settings WHERE key = 'app_version'`).get() as
		{ value: string } | undefined;
	if (row?.value === version) return;
	if (row) snapshot(db, 'deploy');
	db.prepare(
		`INSERT INTO settings (key, value) VALUES ('app_version', ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`
	).run(version);
}
