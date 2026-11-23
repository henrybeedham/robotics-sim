<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import DemoTile from '#lib/components/site/DemoTile.svelte';
	import { CELLS } from '#lib/components/site/cells.js';
	import DrapeView from '#lib/scene/drape/View.svelte';
	import ReachView from '#lib/scene/reach/View.svelte';
	import StackView from '#lib/scene/stack/View.svelte';
	import TandemView from '#lib/scene/tandem/View.svelte';
	import { Simulation } from '#lib/sim/engine.svelte.js';
	import { LEVELS, Reach } from '#lib/sim/reach.svelte.js';
	import { Stack } from '#lib/sim/stack.svelte.js';
	import { Tandem } from '#lib/sim/tandem.svelte.js';
	import { fixed } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Demo instances: they loop forever and never save.
	const drape = new Simulation();
	drape.warp = 4;
	drape.onComplete = (s) => {
		s.reset();
		s.start();
	};
	drape.start();

	const reach = new Reach();
	reach.speed = 2;
	let next = 1;
	let timer: ReturnType<typeof setTimeout> | undefined;
	reach.onArrive = (r) => {
		timer = setTimeout(() => {
			r.aim(next++ % r.level.targets.length);
			r.go();
		}, 1500);
	};
	// The demo explores the duct run; planning only happens in the browser.
	onMount(() => {
		reach.setLevel(2);
		reach.go();
	});
	onDestroy(() => clearTimeout(timer));

	const stack = new Stack(true);
	stack.warp = 3;
	stack.start();

	const tandem = new Tandem(true);
	tandem.warp = 8;
	tandem.start();

	const figures = $derived({
		drape: data.drape ? `${data.drape.passed}/${data.drape.plies} in tolerance` : 'No runs yet',
		reach: `${LEVELS.length} structures, one a maze`,
		stack: data.stack ? `${fixed(data.stack.throughput, 0)} billets/h` : 'No runs yet',
		tandem: data.tandem ? `×${fixed(data.tandem.speedup, 2)} vs one gantry` : 'No runs yet'
	});
</script>

<svelte:head><title>Cellwork · robotic cells, simulated</title></svelte:head>

<SiteHeader />

<main class="mx-auto max-w-6xl px-4 pt-10 pb-16">
	<h1
		class="max-w-2xl font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
	>
		Four industrial robot cells, simulated in the browser.
	</h1>

	<div class="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
		{#each CELLS as c, i (c.id)}
			<DemoTile id={c.id} name={c.name} line={c.line} figure={figures[c.id]} index={i}>
				{#if c.id === 'drape'}<DrapeView sim={drape} demo />
				{:else if c.id === 'reach'}<ReachView sim={reach} demo />
				{:else if c.id === 'stack'}<StackView sim={stack} demo />
				{:else}<TandemView sim={tandem} demo />{/if}
			</DemoTile>
		{/each}
	</div>
</main>

<SiteFooter />
