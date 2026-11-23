<script lang="ts">
	import { resolve } from '$app/paths';
	import { toggleMode } from 'mode-watcher';
	import SunMoon from '@lucide/svelte/icons/sun-moon';
	import { Button } from '#lib/components/ui/button/index.js';
	import { CELLS, type CellId } from './cells.js';

	let { current }: { current?: CellId } = $props();
</script>

<header class="flex min-h-12 flex-wrap items-center gap-x-6 border-b px-4">
	<a href={resolve('/')} class="py-2 font-display text-xl font-semibold tracking-tight">Cellwork</a>
	<nav
		class="order-last -mx-4 flex w-[calc(100%+2rem)] overflow-x-auto border-t px-3 text-sm sm:order-none sm:mx-0 sm:w-auto sm:border-0 sm:px-0"
		aria-label="Cells"
	>
		{#each CELLS as c (c.id)}
			<a
				href={resolve(`/${c.id}`)}
				aria-current={current === c.id ? 'page' : undefined}
				class="border-b-2 px-2.5 py-2.5 whitespace-nowrap transition-colors duration-150 {current ===
				c.id
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{c.name}
			</a>
		{/each}
	</nav>
	<div class="ml-auto flex items-center gap-1 text-xs">
		<a href="https://github.com/henrybeedham/robotics-sim" class="px-2 py-1 hover:underline">
			Source
		</a>
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={toggleMode}
			aria-label="Switch light or dark theme"
		>
			<SunMoon strokeWidth={1.5} />
		</Button>
	</div>
</header>
