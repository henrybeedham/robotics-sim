// Used by the Docker HEALTHCHECK and Coolify.
import { get } from '#lib/server/db.js';

export function GET() {
	try {
		get('SELECT 1');
		return new Response('ok', { headers: { 'cache-control': 'no-store' } });
	} catch {
		return new Response('database unavailable', { status: 503 });
	}
}
