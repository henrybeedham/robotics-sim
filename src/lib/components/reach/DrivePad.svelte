<script lang="ts">
	/**
	 * Manual controls for the snake arm: W/S feed in and out, A/D steer left and
	 * right, Q/E steer up and down. Keys work anywhere on the page (except while
	 * typing); the buttons can be held on a touch screen.
	 */
	import type { Reach } from '#lib/sim/reach.svelte.js';

	let { sim }: { sim: Reach } = $props();

	type Axis = 'feed' | 'turn' | 'climb';
	const KEYS: Record<string, [Axis, number]> = {
		w: ['feed', 1],
		s: ['feed', -1],
		a: ['turn', -1],
		d: ['turn', 1],
		q: ['climb', 1],
		e: ['climb', -1]
	};
	const held = $state<Record<string, boolean>>({});

	function set(key: string, down: boolean) {
		const bind = KEYS[key];
		if (!bind) return false;
		const [axis, value] = bind;
		held[key] = down;
		if (down) {
			if (sim.status !== 'driving') sim.drive();
			sim.input[axis] = value;
		} else if (sim.input[axis] === value) sim.input[axis] = 0;
		return true;
	}

	const typing = (e: KeyboardEvent) =>
		e.target instanceof HTMLElement &&
		(e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));

	function onkeydown(e: KeyboardEvent) {
		if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
		if (set(e.key.toLowerCase(), true)) e.preventDefault();
	}
	function onkeyup(e: KeyboardEvent) {
		set(e.key.toLowerCase(), false);
	}
	function release() {
		for (const k of Object.keys(KEYS)) set(k, false);
	}

	const pad: { key: string; label: string; area: string }[] = [
		{ key: 'q', label: 'Q', area: '1 / 1' },
		{ key: 'w', label: 'W', area: '1 / 2' },
		{ key: 'e', label: 'E', area: '1 / 3' },
		{ key: 'a', label: 'A', area: '2 / 1' },
		{ key: 's', label: 'S', area: '2 / 2' },
		{ key: 'd', label: 'D', area: '2 / 3' }
	];
</script>

<svelte:window {onkeydown} {onkeyup} onblur={release} />

<div class="flex items-center gap-4">
	<div class="grid grid-cols-3 grid-rows-2 gap-1" role="group" aria-label="Drive the arm">
		{#each pad as b (b.key)}
			<button
				type="button"
				style="grid-area: {b.area}"
				class="size-9 border figures text-xs transition-colors duration-100 select-none {held[b.key]
					? 'border-primary bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
				onpointerdown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					set(b.key, true);
				}}
				onpointerup={() => set(b.key, false)}
				onpointercancel={() => set(b.key, false)}
				aria-label={{
					q: 'Steer up',
					w: 'Feed in',
					e: 'Steer down',
					a: 'Steer left',
					s: 'Back out',
					d: 'Steer right'
				}[b.key]}
			>
				{b.label}
			</button>
		{/each}
	</div>
	<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
		<dt class="figures">W S</dt>
		<dd class="text-muted-foreground">feed in, back out</dd>
		<dt class="figures">A D</dt>
		<dd class="text-muted-foreground">steer left, right</dd>
		<dt class="figures">Q E</dt>
		<dd class="text-muted-foreground">steer up, down</dd>
	</dl>
</div>
