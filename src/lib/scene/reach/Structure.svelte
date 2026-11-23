<script lang="ts">
	/**
	 * Draws any snake-arm structure from its solids. Solids are merged into one
	 * mesh per part, with UVs in world units so textures keep a constant scale.
	 * The jig it sits on and the feed rail are drawn here too.
	 */
	import { T } from '@threlte/core';
	import { BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Material } from 'three';
	import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
	import { onDestroy } from 'svelte';
	import type { Level } from '#lib/sim/reach.svelte.js';
	import type { Part } from '#lib/sim/reach/geometry.js';
	import { aluminium, structureMaterials } from '../common/materials';
	import { rbox, worldUVs } from '../common/shapes';
	import Stand from '../common/Stand.svelte';

	let { level, seeThrough }: { level: Level; seeThrough: boolean } = $props();

	const PARTS: Part[] = ['floor', 'wall', 'plate', 'tube', 'shell', 'lid'];

	function build(lv: Level) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch map
		const byPart = new Map<Part, BufferGeometry[]>();
		for (const s of lv.solids) {
			let g: BufferGeometry;
			if (s.kind === 'box') {
				const size = [0, 1, 2].map((a) => s.max[a] - s.min[a]);
				g = new BoxGeometry(size[0], size[1], size[2]);
				g.translate(
					...([0, 1, 2].map((a) => (s.min[a] + s.max[a]) / 2) as [number, number, number])
				);
			} else {
				g = new CylinderGeometry(s.r, s.r, s.half * 2, 20, 1, true);
				if (s.axis === 0) g.rotateZ(Math.PI / 2);
				if (s.axis === 2) g.rotateX(Math.PI / 2);
				g.translate(...s.c);
			}
			worldUVs(g, 0.5);
			const list = byPart.get(s.part) ?? [];
			list.push(g.index ? g.toNonIndexed() : g);
			byPart.set(s.part, list);
		}
		return PARTS.filter((p) => byPart.has(p)).map((p) => {
			const merged = mergeGeometries(byPart.get(p)!, false);
			merged.computeVertexNormals();
			return { part: p, geometry: merged };
		});
	}

	const meshes = $derived(build(level));
	$effect(() => {
		const m = meshes;
		return () => m.forEach((x) => x.geometry.dispose());
	});

	const mats = $derived(structureMaterials(level.id));
	const glass = $derived.by(() => {
		const g = (mats.wall as Material).clone();
		g.transparent = true;
		g.opacity = 0.16;
		g.depthWrite = false;
		g.side = DoubleSide;
		return g;
	});
	// In the maze and the ducts the inner walls hide the arm too, so they thin out as well.
	const veil = $derived.by(() => {
		const g = (mats.wall as Material).clone();
		g.transparent = true;
		g.opacity = 0.42;
		g.depthWrite = false;
		return g;
	});
	onDestroy(() => {
		glass.dispose();
		veil.dispose();
	});
	const thinWalls = $derived(level.id === 'maze' || level.id === 'ducts');

	const see = (p: Part) => seeThrough && (p === 'lid' || p === 'shell');
	const matFor = (p: Part) =>
		see(p)
			? glass
			: p === 'tube'
				? mats.tube
				: p === 'plate'
					? mats.plate
					: p === 'wall' && seeThrough && thinWalls
						? veil
						: mats.wall;

	const x1 = $derived(level.max[0] - 0.05);
	const w = $derived(level.max[1] - level.min[1] - 0.1);
	const cy = $derived((level.max[1] + level.min[1]) / 2);
</script>

{#each meshes as m (m.part)}
	<T.Mesh geometry={m.geometry} material={matFor(m.part)} castShadow={!see(m.part)} receiveShadow />
{/each}

<!-- Assembly jig under the structure -->
<Stand
	x={x1 / 2}
	y={cy}
	length={x1 + 0.1}
	depth={Math.max(0.5, w - 0.1)}
	height={level.standTop - 0.03}
/>
<T.Mesh
	position={[x1 / 2, cy, level.standTop - 0.015]}
	geometry={rbox(x1 + 0.12, Math.max(0.5, w - 0.04), 0.03, 0.005)}
	material={aluminium}
	receiveShadow
/>
