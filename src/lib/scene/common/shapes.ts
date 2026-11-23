/** Cached geometries for detail parts, so many small pieces share a few buffers. */
import { BufferGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const cache = new Map<string, BufferGeometry>();
const get = <T extends BufferGeometry>(key: string, make: () => T) => {
	let g = cache.get(key);
	if (!g) cache.set(key, (g = make()));
	return g as T;
};

/** A box with rounded edges, like a casting or a machined block. */
export const rbox = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.18) =>
	get(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));

/** A cylinder along local Y. */
export const cyl = (rt: number, rb: number, h: number, seg = 32) =>
	get(`cy:${rt}:${rb}:${h}:${seg}`, () => new CylinderGeometry(rt, rb, h, seg));

export const torus = (r: number, tube: number) =>
	get(`to:${r}:${tube}`, () => new TorusGeometry(r, tube, 8, 24));
