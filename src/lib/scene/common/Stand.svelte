<script lang="ts">
	/** A welded steel stand for a mould: legs, perimeter beams and diagonal braces. Z-up. */
	import { T } from '@threlte/core';
	import { darkPaint } from './materials';
	import { rbox } from './shapes';

	let {
		x,
		y,
		length,
		depth,
		height
	}: { x: number; y: number; length: number; depth: number; height: number } = $props();

	const B = 0.08;
	const bays = $derived(Math.max(1, Math.round(length / 1.2)));
	const legXs = $derived(
		Array.from({ length: bays + 1 }, (_, i) => x - length / 2 + B / 2 + (i * (length - B)) / bays)
	);
	const braceLen = $derived(Math.hypot((length - B) / bays, height * 0.6));
	const braceAngle = $derived(Math.atan2(height * 0.6, (length - B) / bays));
</script>

{#each legXs as lx (lx)}
	{#each [-1, 1] as s (s)}
		<T.Mesh
			position={[lx, y + s * (depth / 2 - B / 2), height / 2]}
			geometry={rbox(B, B, height, 0.008)}
			material={darkPaint}
			castShadow
		/>
	{/each}
{/each}
{#each [-1, 1] as s (s)}
	<T.Mesh
		position={[x, y + s * (depth / 2 - B / 2), height - B / 2]}
		geometry={rbox(length, B, B, 0.008)}
		material={darkPaint}
		castShadow
	/>
	<T.Mesh
		position={[x, y + s * (depth / 2 - B / 2), 0.15]}
		geometry={rbox(length, B * 0.7, B * 0.7, 0.006)}
		material={darkPaint}
	/>
	{#each legXs.slice(0, -1) as lx, i (i)}
		<T.Mesh
			position={[lx + (length - B) / bays / 2, y + s * (depth / 2 - B / 2), 0.15 + height * 0.3]}
			rotation.y={-braceAngle * (i % 2 ? -1 : 1)}
			geometry={rbox(braceLen, 0.04, 0.04, 0.005)}
			material={darkPaint}
		/>
	{/each}
{/each}
{#each legXs as lx (lx)}
	<T.Mesh
		position={[lx, y, height - B / 2]}
		geometry={rbox(B, depth - B, B, 0.008)}
		material={darkPaint}
	/>
{/each}
