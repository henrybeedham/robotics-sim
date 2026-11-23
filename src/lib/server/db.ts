import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config';
import { backupBeforeMigrating, backupOnNewVersion } from './backups';

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

type Params = Record<string, SQLInputValue> | SQLInputValue[];
// node:sqlite takes either positional values or one object of named values.
const bind = (p?: Params) => (p === undefined ? [] : Array.isArray(p) ? p : [p]) as SQLInputValue[];

export const run = (sql: string, p?: Params) => db.prepare(sql).run(...bind(p));
export const get = <T>(sql: string, p?: Params) => db.prepare(sql).get(...bind(p)) as T | undefined;
export const all = <T>(sql: string, p?: Params) => db.prepare(sql).all(...bind(p)) as T[];

const MIGRATIONS: (string | ((db: DatabaseSync) => void))[] = [
	`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
	 CREATE TABLE runs (
		id INTEGER PRIMARY KEY,
		created_at TEXT NOT NULL,
		mould TEXT NOT NULL,
		layers TEXT NOT NULL,
		stations INTEGER NOT NULL,
		vision INTEGER NOT NULL,
		repeatability REAL NOT NULL,
		tolerance REAL NOT NULL,
		override INTEGER NOT NULL,
		seed INTEGER NOT NULL,
		plies INTEGER NOT NULL,
		passed INTEGER NOT NULL,
		mean_cycle REAL NOT NULL,
		rate REAL NOT NULL,
		mean_deviation REAL NOT NULL,
		max_deviation REAL NOT NULL
	 );
	 CREATE INDEX runs_created ON runs (created_at DESC);`,
	`CREATE TABLE results (
		id INTEGER PRIMARY KEY,
		sim TEXT NOT NULL,
		created_at TEXT NOT NULL,
		summary TEXT NOT NULL
	 );
	 CREATE INDEX results_sim ON results (sim, id DESC);`
	// add new migrations here
];

function migrate() {
	const current = (db.prepare('PRAGMA user_version').get() as { user_version: number })
		.user_version;
	if (current > MIGRATIONS.length) throw new Error('Database is newer than this app version.');
	if (current < MIGRATIONS.length && current > 0) backupBeforeMigrating(db, current);
	for (let v = current; v < MIGRATIONS.length; v++) {
		const step = MIGRATIONS[v];
		db.exec('BEGIN IMMEDIATE');
		try {
			if (typeof step === 'string') db.exec(step);
			else step(db);
			db.exec(`PRAGMA user_version = ${v + 1}`);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
	}
}
migrate();
backupOnNewVersion(db);

process.on('sveltekit:shutdown', () => db.close());
