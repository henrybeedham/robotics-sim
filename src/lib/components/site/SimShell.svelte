<script lang="ts">
	/** Page frame for a cell: 3D view on the left (top on phones), process sheet on the right. */
	import type { Snippet } from 'svelte';
	import { browser } from '$app/env';
	import SiteHeader from './SiteHeader.svelte';
	import type { CellId } from './cells.js';

	let {
		cell,
		viewport,
		overlay,
		panel,
		below
	}: {
		cell: CellId;
		viewport: Snippet;
		overlay?: Snippet;
		panel: Snippet;
		below?: Snippet;
	} = $props();
</script>

<SiteHeader current={cell} />

<main class="lg:grid lg:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_400px]">
	<section
		class="relative h-[58dvh] min-h-80 border-b lg:h-full lg:border-r lg:border-b-0"
		style="background: var(--scene-bg)"
		aria-label="3D view of the cell"
	>
		{#if browser}{@render viewport()}{/if}
		{@render overlay?.()}
	</section>
	<aside class="lg:overflow-y-auto">
		{@render panel()}
	</aside>
</main>
{@render below?.()}
