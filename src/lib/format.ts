export const fixed = (v: number | null | undefined, digits = 1, empty = '—') =>
	v === null || v === undefined || !Number.isFinite(v) ? empty : v.toFixed(digits);

export const signed = (v: number, digits = 1) =>
	(v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(digits);

export const angleLabel = (a: number) =>
	(a > 0 && a !== 90 ? '+' : a < 0 ? '−' : '') + Math.abs(a) + '°';

export const clock = (seconds: number) => {
	const m = Math.floor(seconds / 60);
	const s = seconds - m * 60;
	return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});
export const when = (iso: string) => dateFmt.format(new Date(iso)).replace(',', '');

export function laminate(layers: number[]) {
	const plus = layers.filter((a) => a === 45).length;
	const minus = layers.filter((a) => a === -45).length;
	const symmetric = layers.every((a, i) => a === layers[layers.length - 1 - i]);
	return { balanced: plus === minus, symmetric };
}
