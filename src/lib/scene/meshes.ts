import { BufferAttribute, BufferGeometry } from 'three';
import { MOULD, PLY, PLY_GRID, mouldHeight, type MouldId } from '#lib/sim/cell.js';
import { FIBRE_TILE } from './materials';

/** A solid mould block: the curved tool face plus skirts down to its base. */
export function mouldGeometry(id: MouldId) {
	const nx = 60;
	const ny = 24;
	const x0 = MOULD.x - MOULD.length / 2;
	const y0 = MOULD.y - MOULD.depth / 2;
	const positions: number[] = [];
	const indices: number[] = [];

	const at = (i: number, j: number) => {
		const x = x0 + (MOULD.length * i) / nx;
		const y = y0 + (MOULD.depth * j) / ny;
		return [x, y, mouldHeight(id, x, y)];
	};

	for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) positions.push(...at(i, j));
	for (let j = 0; j < ny; j++) {
		for (let i = 0; i < nx; i++) {
			const a = j * (nx + 1) + i;
			const b = a + 1;
			const c = a + nx + 1;
			const d = c + 1;
			indices.push(a, b, d, a, d, c);
		}
	}

	// Skirts: walk the rim and drop each edge to the base.
	const rim: [number, number][] = [];
	for (let i = 0; i <= nx; i++) rim.push([i, 0]);
	for (let j = 1; j <= ny; j++) rim.push([nx, j]);
	for (let i = nx - 1; i >= 0; i--) rim.push([i, ny]);
	for (let j = ny - 1; j >= 0; j--) rim.push([0, j]);
	for (let k = 0; k < rim.length - 1; k++) {
		const [ax, ay, az] = at(...rim[k]);
		const [bx, by, bz] = at(...rim[k + 1]);
		const base = positions.length / 3;
		positions.push(ax, ay, az, bx, by, bz, ax, ay, MOULD.base, bx, by, MOULD.base);
		indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
	}

	const g = new BufferGeometry();
	g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
	g.setIndex(indices);
	g.computeVertexNormals();
	return g;
}

/** A ply sheet. Positions are filled each frame; UVs carry the fibre angle. */
export function plyGeometry(angleDeg: number) {
	const { nu, nv } = PLY_GRID;
	const positions = new Float32Array(nu * nv * 3);
	const uvs = new Float32Array(nu * nv * 2);
	const a = (-angleDeg * Math.PI) / 180;
	const c = Math.cos(a);
	const s = Math.sin(a);
	let k = 0;
	for (let j = 0; j < nv; j++) {
		for (let i = 0; i < nu; i++) {
			const u = -PLY.length / 2 + (PLY.length * i) / (nu - 1);
			const v = -PLY.width / 2 + (PLY.width * j) / (nv - 1);
			// Texture stripes run along U, so rotate into the fibre direction.
			uvs[k++] = (c * u - s * v) / FIBRE_TILE;
			uvs[k++] = (s * u + c * v) / FIBRE_TILE;
		}
	}
	const indices: number[] = [];
	for (let j = 0; j < nv - 1; j++) {
		for (let i = 0; i < nu - 1; i++) {
			const p = j * nu + i;
			indices.push(p, p + 1, p + nu + 1, p, p + nu + 1, p + nu);
		}
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new BufferAttribute(positions, 3));
	g.setAttribute('uv', new BufferAttribute(uvs, 2));
	g.setIndex(indices);
	return g;
}
