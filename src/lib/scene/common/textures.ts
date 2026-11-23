/**
 * Procedural surface textures, drawn once on canvases in the browser. No image
 * files: every texture is generated from seeded, tileable noise, so the whole
 * site stays small and works offline.
 *
 * Colour maps are near-white and multiply the material's colour; roughness and
 * bump maps carry the actual surface detail.
 */
import {
	CanvasTexture,
	NoColorSpace,
	RepeatWrapping,
	SRGBColorSpace,
	type MeshStandardMaterial
} from 'three';
import { rng } from '#lib/sim/random.js';

/** Tileable value noise with `octaves` layers, values 0–1. */
function fbm(size: number, period: number, octaves: number, seed: number) {
	const out = new Float32Array(size * size);
	const r = rng(seed);
	let amp = 1;
	let total = 0;
	for (let o = 0; o < octaves; o++) {
		const p = period << o;
		const grid = Array.from({ length: p * p }, () => r.next());
		const at = (x: number, y: number) => grid[(((y % p) + p) % p) * p + (((x % p) + p) % p)];
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const fx = (x / size) * p;
				const fy = (y / size) * p;
				const ix = Math.floor(fx);
				const iy = Math.floor(fy);
				const tx = fx - ix;
				const ty = fy - iy;
				const sx = tx * tx * (3 - 2 * tx);
				const sy = ty * ty * (3 - 2 * ty);
				const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
				const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
				out[y * size + x] += (a + (b - a) * sy) * amp;
			}
		}
		total += amp;
		amp *= 0.5;
	}
	for (let i = 0; i < out.length; i++) out[i] /= total;
	return out;
}

type Pixel = (x: number, y: number, i: number) => [number, number, number];

function paint(size: number, pixel: Pixel, colour: boolean) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const img = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = y * size + x;
			const [r, g, b] = pixel(x, y, i);
			img.data[i * 4] = Math.max(0, Math.min(255, r * 255));
			img.data[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
			img.data[i * 4 + 2] = Math.max(0, Math.min(255, b * 255));
			img.data[i * 4 + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	const t = new CanvasTexture(canvas);
	t.wrapS = t.wrapT = RepeatWrapping;
	t.anisotropy = 8;
	t.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
	return t;
}

const grey = (v: number): [number, number, number] => [v, v, v];
const cache = new Map<string, CanvasTexture>();
function once(key: string, make: () => CanvasTexture) {
	let t = cache.get(key);
	if (!t) cache.set(key, (t = make()));
	return t;
}

/** Orange-peel clear coat: fine, soft bumps. */
export const peel = () =>
	once('peel', () => {
		const n = fbm(256, 16, 3, 11);
		return paint(256, (_x, _y, i) => grey(n[i]), false);
	});

/** Sand-cast or powder-coated metal: coarse grain. */
export const cast = () =>
	once('cast', () => {
		const n = fbm(256, 8, 4, 12);
		const f = fbm(256, 64, 2, 13);
		return paint(256, (_x, _y, i) => grey(0.55 * n[i] + 0.45 * f[i]), false);
	});

/** Brushed metal: long streaks along U. Used as both colour and roughness. */
export const brushed = (as: 'colour' | 'rough') =>
	once(`brushed:${as}`, () => {
		const size = 256;
		const r = rng(14);
		const rows = Array.from({ length: size }, () => r.next());
		const n = fbm(size, 4, 3, 15);
		return paint(
			size,
			(x, y, i) => {
				const streak = 0.65 * rows[y] + 0.35 * rows[(y + 1) % size];
				const v = 0.5 * streak + 0.5 * n[i];
				return grey(as === 'colour' ? 0.86 + 0.14 * v : 0.25 + 0.5 * v);
			},
			as === 'colour'
		);
	});

/** Polished tool face with faint sanding swirls (roughness). */
export const polished = () =>
	once('polished', () => {
		const n = fbm(256, 4, 4, 16);
		const size = 256;
		return paint(
			size,
			(x, y, i) => {
				const swirl = Math.sin(Math.hypot(x - size / 2, y - size / 2) / 3 + n[i] * 12) * 0.5 + 0.5;
				return grey(0.18 + 0.18 * n[i] + 0.06 * swirl);
			},
			false
		);
	});

/** Concrete floor: mottled, speckled, with saw-cut joints on the tile edges. */
export const concrete = (as: 'colour' | 'rough' | 'bump') =>
	once(`concrete:${as}`, () => {
		const size = 512;
		const n = fbm(size, 4, 5, 21);
		const s = fbm(size, 128, 1, 22);
		return paint(
			size,
			(x, y, i) => {
				const joint = x < 2 || y < 2 ? 1 : 0;
				const speck = s[i] > 0.82 ? 0.12 : 0;
				if (as === 'colour') return grey(0.8 + 0.2 * n[i] - speck - joint * 0.35);
				if (as === 'rough') return grey(0.75 + 0.2 * n[i] - joint * 0.1);
				return grey(0.5 + 0.3 * s[i] - joint * 0.5);
			},
			as === 'colour'
		);
	});

/** Pallet timber: stretched grain along U. */
export const wood = () =>
	once('wood', () => {
		const size = 256;
		const n = fbm(size, 4, 4, 31);
		return paint(
			size,
			(x, y, i) => {
				const ring = Math.sin((y / size) * 60 + n[i] * 14) * 0.5 + 0.5;
				const v = 0.78 + 0.16 * ring + 0.08 * n[i];
				return [v, v * 0.97, v * 0.92];
			},
			true
		);
	});

/** Mill scale on hot steel: patchy oxide. */
export const scale = (as: 'colour' | 'bump') =>
	once(`scale:${as}`, () => {
		const n = fbm(256, 6, 5, 41);
		const f = fbm(256, 32, 2, 42);
		return paint(
			256,
			(_x, _y, i) => {
				const flake = f[i] > 0.6 ? 0.25 : 0;
				return as === 'colour' ? grey(0.7 + 0.3 * n[i] - flake) : grey(n[i] * 0.6 + flake);
			},
			as === 'colour'
		);
	});

/** Hot-dip galvanising: crystal spangle, as a colour map. */
export const spangle = () =>
	once('spangle', () => {
		const size = 256;
		const r = rng(51);
		const seeds = Array.from({ length: 70 }, () => [r.next() * size, r.next() * size, r.next()]);
		const n = fbm(size, 16, 2, 52);
		return paint(
			size,
			(x, y, i) => {
				let best = Infinity;
				let shade = 0;
				for (const [sx, sy, v] of seeds) {
					// Wrap distances so the tile repeats seamlessly.
					const dx = Math.min(Math.abs(x - sx), size - Math.abs(x - sx));
					const dy = Math.min(Math.abs(y - sy), size - Math.abs(y - sy));
					const d = dx * dx + dy * dy;
					if (d < best) {
						best = d;
						shade = v;
					}
				}
				return grey(0.8 + 0.16 * shade + 0.04 * n[i]);
			},
			true
		);
	});

/** Painted or primed sheet: gentle mottling and a few fastener rows. */
export const primer = (as: 'colour' | 'bump') =>
	once(`primer:${as}`, () => {
		const size = 256;
		const n = fbm(size, 8, 3, 61);
		return paint(
			size,
			(x, y, i) => {
				const rivet =
					(x % 32 < 3 && x % 32 > 0 && y % 128 < 3) || (y % 32 < 3 && y % 32 > 0 && x % 128 < 3);
				if (as === 'colour') return grey(0.88 + 0.12 * n[i] - (rivet ? 0.12 : 0));
				return grey(0.5 + 0.1 * n[i] + (rivet ? 0.4 : 0));
			},
			as === 'colour'
		);
	});

/** Worn safety paint: scuffs that show darker. */
export const worn = () =>
	once('worn', () => {
		const n = fbm(256, 8, 5, 71);
		return paint(
			256,
			(_x, _y, i) => grey(n[i] > 0.68 ? 0.55 + 0.3 * (1 - n[i]) : 0.95 + 0.05 * n[i]),
			true
		);
	});

/** Fine noise for rubber, laminate and other quiet surfaces. */
export const fine = () =>
	once('fine', () => {
		const n = fbm(256, 64, 2, 81);
		return paint(256, (_x, _y, i) => grey(n[i]), false);
	});

/** Attach a set of maps to a material, once. */
export function dress(
	m: MeshStandardMaterial,
	maps: {
		map?: CanvasTexture;
		roughnessMap?: CanvasTexture;
		bumpMap?: CanvasTexture;
		bumpScale?: number;
	}
) {
	if (m.userData.dressed) return m;
	if (maps.map) m.map = maps.map;
	if (maps.roughnessMap) m.roughnessMap = maps.roughnessMap;
	if (maps.bumpMap) {
		m.bumpMap = maps.bumpMap;
		m.bumpScale = maps.bumpScale ?? 1;
	}
	m.userData.dressed = true;
	m.needsUpdate = true;
	return m;
}
