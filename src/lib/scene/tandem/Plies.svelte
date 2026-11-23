<script lang="ts">
	/** Every ply: waiting plies are hidden, kitted ones sit on a kit table, carried ones hang under a head. */
	import { T, useTask } from '@threlte/core';
	import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial } from 'three';
	import { onDestroy } from 'svelte';
	import { KITS, mouldHeight, type TPly, type Tandem } from '#lib/sim/tandem.svelte.js';
	import { fibreTexture, FIBRE_TILE } from '../common/materials';

	let { sim }: { sim: Tandem } = $props();

	const NU = 10;
	const NV = 8;
	const material = new MeshStandardMaterial({
		map: fibreTexture(),
		roughness: 0.5,
		metalness: 0.25,
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});

	function build(p: TPly) {
		const g = new BufferGeometry();
		const uv = new Float32Array(NU * NV * 2);
		const a = (-p.angle * Math.PI) / 180;
		let k = 0;
		for (let j = 0; j < NV; j++)
			for (let i = 0; i < NU; i++) {
				const u = (i / (NU - 1) - 0.5) * p.length;
				const v = (j / (NV - 1) - 0.5) * p.width;
				uv[k++] = (Math.cos(a) * u - Math.sin(a) * v) / FIBRE_TILE;
				uv[k++] = (Math.sin(a) * u + Math.cos(a) * v) / FIBRE_TILE;
			}
		const idx: number[] = [];
		for (let j = 0; j < NV - 1; j++)
			for (let i = 0; i < NU - 1; i++) {
				const q = j * NU + i;
				idx.push(q, q + 1, q + NU + 1, q, q + NU + 1, q + NU);
			}
		g.setAttribute('position', new BufferAttribute(new Float32Array(NU * NV * 3), 3));
		g.setAttribute('uv', new BufferAttribute(uv, 2));
		g.setIndex(idx);
		return g;
	}

	/** Write ply vertices centred at (cx, cy); `drape` lays them on the mould at layer height. */
	function fill(g: BufferGeometry, p: TPly, cx: number, cy: number, z: number | null) {
		const attr = g.getAttribute('position') as BufferAttribute;
		let k = 0;
		for (let j = 0; j < NV; j++)
			for (let i = 0; i < NU; i++) {
				const x = cx + (i / (NU - 1) - 0.5) * p.length;
				const y = cy + (j / (NV - 1) - 0.5) * p.width;
				attr.setXYZ(k++, x, y, z ?? mouldHeight(x, y) + 0.003 * (p.layer + 1));
			}
		attr.needsUpdate = true;
		g.computeVertexNormals();
		g.computeBoundingSphere();
	}

	// Plain collections on purpose: the renderer reads them, nothing in the markup does.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const cache = new Map<number, BufferGeometry>();
	let core: unknown = null;
	let shown = $state.raw<{ id: number; g: BufferGeometry }[]>([]);

	// Rebuild static plies (kitted, placed) whenever the simulation reports a change.
	$effect(() => {
		void sim.version;
		// A reset makes a new ply book with the same ids, so start the cache again.
		if (sim.core !== core) {
			core = sim.core;
			for (const g of cache.values()) g.dispose();
			cache.clear();
		}
		const next: { id: number; g: BufferGeometry }[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const keep = new Set<number>();
		for (const p of sim.plies) {
			if (p.state === 'waiting') continue;
			let g = cache.get(p.id);
			if (!g) cache.set(p.id, (g = build(p)));
			keep.add(p.id);
			next.push({ id: p.id, g });
			if (p.state === 'placed') fill(g, p, p.x, p.y, null);
			if (p.state === 'kitted') fill(g, p, KITS[p.by ?? 0], 0, 0.845);
		}
		for (const [id, g] of cache)
			if (!keep.has(id)) {
				g.dispose();
				cache.delete(id);
			}
		shown = next;
	});

	useTask(
		() => {
			for (const p of sim.plies) {
				if (p.state !== 'carried' || p.by === null) continue;
				const g = cache.get(p.id);
				const [x, y, z] = sim.gantries[p.by].pos;
				if (g) fill(g, p, x, y, z + 0.025);
			}
		},
		{ after: 'simulation' }
	);

	onDestroy(() => {
		for (const g of cache.values()) g.dispose();
		material.dispose();
	});
</script>

{#each shown as s (s.id)}
	<T.Mesh geometry={s.g} {material} castShadow receiveShadow frustumCulled={false} />
{/each}
