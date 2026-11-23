import { toast } from 'svelte-sonner';

/** Post a finished run and return the refreshed list, or null if it could not be saved. */
export async function saveRun<T>(url: string, body: object): Promise<T | null> {
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const problem = (await res.json().catch(() => null)) as { message?: string } | null;
			throw new Error(problem?.message ?? res.statusText);
		}
		toast.success('Run complete and saved.');
		return ((await res.json()) as { runs: T }).runs;
	} catch (e) {
		toast.error(`Run complete, but it could not be saved: ${(e as Error).message}`);
		return null;
	}
}
