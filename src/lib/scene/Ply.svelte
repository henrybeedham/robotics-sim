<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { DoubleSide, MeshStandardMaterial, Color, BufferAttribute } from 'three';
	import { onDestroy } from 'svelte';
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { fibreTexture } from './materials';
	import { plyGeometry } from './meshes';

	let { sim, index }: { sim: Simulation; index: number } = $props();

	const ply = $derived(sim.plies[index]);
	const geometry = $derived(plyGeometry(ply?.angle ?? 0));
	const material = new MeshStandardMaterial({
		map: fibreTexture(),
		roughness: 0.5,
		metalness: 0.25,
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});

	let visible = $state(false);

	function refresh() {
		const attr = geometry.getAttribute('position') as BufferAttribute;
		visible = sim.plyVertices(index, attr.array as Float32Array);
		if (visible) {
			attr.needsUpdate = true;
			geometry.computeVertexNormals();
			geometry.computeBoundingSphere();
		}
	}

	// Static plies only need rebuilding when the simulation says so.
	$effect(() => {
		void sim.geometryVersion;
		void ply?.status;
		void geometry;
		refresh();
	});

	// A failed ply is tinted so it stands out on the tool.
	$effect(() => {
		const failed = ply?.pass === false;
		material.color = new Color(failed ? '#ff8a7a' : '#ffffff');
		material.emissive = new Color(failed ? '#6a0d00' : '#000000');
	});

	useTask(
		() => {
			if (ply?.status === 'carried') refresh();
		},
		{ after: 'simulation' }
	);

	onDestroy(() => {
		geometry.dispose();
		material.dispose();
	});
</script>

{#if ply}
	<T.Mesh {geometry} {material} {visible} castShadow receiveShadow frustumCulled={false} />
{/if}
