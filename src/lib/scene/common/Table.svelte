<script lang="ts">
	/** A work table built from aluminium profile: top, legs, stretchers and levelling feet. Z-up. */
	import { T } from '@threlte/core';
	import type { Material } from 'three';
	import { aluminium, castBlack, tableTop } from './materials';
	import { cyl, rbox } from './shapes';

	let {
		x,
		y,
		top,
		length,
		depth,
		surface = tableTop
	}: {
		x: number;
		y: number;
		top: number;
		length: number;
		depth: number;
		surface?: Material;
	} = $props();

	const P = 0.045;
	const legs = $derived(
		[-1, 1].flatMap((sx) =>
			[-1, 1].map((sy) => [x + sx * (length / 2 - P), y + sy * (depth / 2 - P)] as const)
		)
	);
</script>

<T.Mesh
	position={[x, y, top - 0.012]}
	geometry={rbox(length, depth, 0.024, 0.006)}
	material={surface}
	receiveShadow
	castShadow
/>
<!-- Top frame -->
{#each [-1, 1] as s (s)}
	<T.Mesh
		position={[x, y + s * (depth / 2 - P), top - 0.024 - P / 2]}
		geometry={rbox(length, P, P, 0.004)}
		material={aluminium}
		castShadow
	/>
	<T.Mesh
		position={[x + s * (length / 2 - P), y, top - 0.024 - P / 2]}
		geometry={rbox(P, depth - 2 * P, P, 0.004)}
		material={aluminium}
		castShadow
	/>
{/each}
<!-- Lower stretchers -->
{#each [-1, 1] as s (s)}
	<T.Mesh
		position={[x, y + s * (depth / 2 - P), 0.16]}
		geometry={rbox(length - 2 * P, P, P, 0.004)}
		material={aluminium}
	/>
{/each}
{#each legs as [lx, ly], i (i)}
	<T.Mesh
		position={[lx, ly, (top - 0.024) / 2 + 0.02]}
		geometry={rbox(P, P, top - 0.064, 0.004)}
		material={aluminium}
		castShadow
	/>
	<T.Mesh
		position={[lx, ly, 0.012]}
		rotation.x={Math.PI / 2}
		geometry={cyl(0.028, 0.03, 0.024, 16)}
		material={castBlack}
	/>
{/each}
