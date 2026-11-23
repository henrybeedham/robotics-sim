<script lang="ts">
	/** One billet. Its glow follows its temperature as it cools from about 900 °C. */
	import { T, useTask } from '@threlte/core';
	import { Color, Matrix4, Mesh, MeshStandardMaterial } from 'three';
	import { onDestroy } from 'svelte';
	import { BILLET, type Billet, type Stack } from '#lib/sim/stack.svelte.js';

	let { sim, billet }: { sim: Stack; billet: Billet } = $props();

	const material = new MeshStandardMaterial({ color: '#4d4945', roughness: 0.75, metalness: 0.4 });
	const mesh = new Mesh(undefined, material);
	mesh.matrixAutoUpdate = false;
	mesh.castShadow = true;
	const m = new Matrix4();
	const hot = new Color();

	const temperature = (age: number) => {
		return 25 + 875 * Math.exp(-age / 240);
	};

	useTask(
		() => {
			mesh.matrix.copy(sim.poseOf(billet, m));
			mesh.matrixWorldNeedsUpdate = true;
			const t = temperature(sim.time - billet.born);
			// Visible glow from about 480 °C: dull red, then orange, then yellow-white.
			const k = Math.max(0, Math.min(1, (t - 480) / 420));
			hot.setRGB(0.9 * Math.min(1, k * 1.6), 0.28 * k * k, 0.02 * k * k * k);
			material.emissive.copy(hot);
			material.emissiveIntensity = 0.4 + 2.2 * k;
		},
		{ after: 'simulation' }
	);

	onDestroy(() => material.dispose());
</script>

<T is={mesh}>
	<T.BoxGeometry args={[BILLET.section, BILLET.length, BILLET.section]} />
</T>
