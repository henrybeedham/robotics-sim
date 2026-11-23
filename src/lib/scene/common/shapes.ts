/** Cached geometries for detail parts, so many small pieces share a few buffers. */
import { BufferAttribute, BufferGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Replace a geometry's UVs with world-unit coordinates: each vertex takes the
 * two axes perpendicular to its dominant normal, divided by `tile` metres.
 * Textures then keep one scale whatever the part's size.
 */
export function worldUVs(g: BufferGeometry, tile = 0.5) {
	const pos = g.getAttribute('position');
	let nrm = g.getAttribute('normal');
	if (!nrm) {
		g.computeVertexNormals();
		nrm = g.getAttribute('normal');
	}
	const uv = new Float32Array(pos.count * 2);
	for (let i = 0; i < pos.count; i++) {
		const ax = Math.abs(nrm.getX(i));
		const ay = Math.abs(nrm.getY(i));
		const az = Math.abs(nrm.getZ(i));
		const [u, v] =
			ax >= ay && ax >= az
				? [pos.getY(i), pos.getZ(i)]
				: ay >= az
					? [pos.getX(i), pos.getZ(i)]
					: [pos.getX(i), pos.getY(i)];
		uv[i * 2] = u / tile;
		uv[i * 2 + 1] = v / tile;
	}
	g.setAttribute('uv', new BufferAttribute(uv, 2));
	return g;
}

const cache = new Map<string, BufferGeometry>();
const get = <T extends BufferGeometry>(key: string, make: () => T) => {
	let g = cache.get(key);
	if (!g) cache.set(key, (g = make()));
	return g as T;
};

/** A box with rounded edges, like a casting or a machined block. */
export const rbox = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.18) =>
	get(`rb:${w}:${h}:${d}:${r}`, () => worldUVs(new RoundedBoxGeometry(w, h, d, 3, r), 0.4));

/** A cylinder along local Y. */
export const cyl = (rt: number, rb: number, h: number, seg = 32) =>
	get(`cy:${rt}:${rb}:${h}:${seg}`, () => worldUVs(new CylinderGeometry(rt, rb, h, seg), 0.4));

export const torus = (r: number, tube: number) =>
	get(`to:${r}:${tube}`, () => new TorusGeometry(r, tube, 8, 24));
