<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="A browser simulation of a robotic composite layup cell: a rail-mounted arm with a conformal vacuum gripper drapes carbon plies onto a curved mould, with vision-guided picking and laser inspection."
	/>
</svelte:head>

<ModeWatcher defaultMode="system" />
<Toaster position="bottom-left" />
{@render children()}
