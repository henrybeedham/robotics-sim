<script lang="ts">
	/** A landing-page tile: a live, slowly turning view of a cell that only renders when on screen. */
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		id,
		name,
		line,
		figure,
		index,
		children
	}: {
		id: string;
		name: string;
		line: string;
		figure: string;
		index: number;
		children: Snippet;
	} = $props();

	let el: HTMLElement;
	let visible = $state(false);
	$effect(() => {
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
			rootMargin: '100px'
		});
		io.observe(el);
		return () => io.disconnect();
	});
</script>

<a
	href={resolve(`/${id}` as '/drape')}
	class="group block border-t pt-3 focus-visible:outline-offset-4"
	aria-label="{name}: {line}"
>
	<div class="flex items-baseline justify-between gap-3">
		<div class="flex items-baseline gap-3">
			<span class="figures text-xs text-muted-foreground">0{index + 1}</span>
			<h2 class="font-display text-2xl font-semibold tracking-tight">{name}</h2>
		</div>
		<span class="figures text-xs">{figure}</span>
	</div>
	<p class="mt-1 text-sm text-muted-foreground">{line}</p>
	<div
		bind:this={el}
		class="relative mt-3 aspect-[4/3] overflow-hidden border transition-colors duration-150 group-hover:border-foreground"
		style="background: var(--scene-bg)"
	>
		{#if visible}{@render children()}{/if}
		<span
			class="absolute right-2 bottom-2 flex items-center gap-1 bg-background px-2 py-1 text-xs opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
		>
			Open <ArrowRight class="size-3.5" strokeWidth={1.5} />
		</span>
	</div>
</a>
