/** A small in-memory limiter: at most `max` hits per key in any `windowMs`. */
export function limiter(max: number, windowMs: number) {
	const hits = new Map<string, number[]>();
	return (key: string) => {
		const now = Date.now();
		const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
		if (recent.length >= max) {
			hits.set(key, recent);
			return false;
		}
		recent.push(now);
		hits.set(key, recent);
		if (hits.size > 5000) hits.clear();
		return true;
	};
}
