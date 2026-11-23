/** Environment, read and checked once at startup (server only). */
const env = process.env;
import { resolve } from 'node:path';

function required(name: string, value: string | undefined, fallback: string) {
	const v = value?.trim() || fallback;
	if (!v) throw new Error(`${name} must be set`);
	return v;
}

export const DATA_DIR = resolve(required('DATA_DIR', env.DATA_DIR, './data'));

const keep = Number(env.RUN_HISTORY_LIMIT ?? 500);
if (!Number.isInteger(keep) || keep < 10)
	throw new Error('RUN_HISTORY_LIMIT must be a whole number of at least 10');
/** How many saved runs to keep; the oldest are pruned. */
export const RUN_HISTORY_LIMIT = keep;
