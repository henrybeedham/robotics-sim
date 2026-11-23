import { error, json } from '@sveltejs/kit';
import { cleanResult, isSim, recentResults, saveResult } from '#lib/server/results.js';
import { limiter } from '#lib/server/rate-limit.js';
import type { RequestHandler } from './$types';

const allow = limiter(20, 60_000);

export const GET: RequestHandler = ({ params }) => {
	if (!isSim(params.sim)) error(404, 'No such cell.');
	return json(recentResults(params.sim));
};

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	if (!isSim(params.sim)) error(404, 'No such cell.');
	if (!allow(getClientAddress()))
		error(429, 'Too many runs saved from this address. Try again in a minute.');
	const body: unknown = await request.json().catch(() => null);
	const result = cleanResult(params.sim, body);
	if (!result.ok) error(400, result.error);
	saveResult(params.sim, result.value);
	return json({ runs: recentResults(params.sim) }, { status: 201 });
};
