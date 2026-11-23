<script lang="ts">
	/**
	 * Top-down plan of the current structure: walls, tubes, the planned route,
	 * the arm and the work points. Click near a work point (or use the arrow
	 * keys) to choose it.
	 */
	import type { Reach } from '#lib/sim/reach.svelte.js';

	let { sim, locked }: { sim: Reach; locked: boolean } = $props();

	const lv = $derived(sim.level);
	const X0 = -0.45;
	const X1 = $derived(lv.max[0] + 0.05);
	const Y0 = $derived(lv.min[1] - 0.02);
	const Y1 = $derived(lv.max[1] + 0.02);
	const S = $derived(360 / (X1 - X0));
	const W = 360;
	const H = $derived((Y1 - Y0) * S);
	const px = (x: number) => (x - X0) * S;
	const py = (y: number) => (Y1 - y) * S;

	// Vertical walls and plates show as lines; floors and roofs would cover everything.
	const walls = $derived(
		lv.solids.flatMap((s) => {
			if (s.kind === 'cyl')
				return s.axis === 2
					? [{ x: s.c[0] - s.r, y: s.c[1] + s.r, w: 2 * s.r, h: 2 * s.r, tube: true }]
					: s.axis === 1
						? [{ x: s.c[0] - s.r, y: s.c[1] + s.half, w: 2 * s.r, h: 2 * s.half, tube: true }]
						: [];
			if (s.part === 'floor' || s.part === 'lid') return [];
			if (s.max[2] - s.min[2] < 0.02) return [];
			return [
				{ x: s.min[0], y: s.max[1], w: s.max[0] - s.min[0], h: s.max[1] - s.min[1], tube: false }
			];
		})
	);
	const route = $derived(
		(sim.plan?.path?.points ?? [])
			.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`)
			.join(' ')
	);
	const body = $derived(
		sim.readout.joints
			.filter((p) => p.x > -0.45)
			.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`)
			.join(' ')
	);

	let svg: SVGSVGElement;
	function pick(e: MouseEvent) {
		if (locked) return;
		const r = svg.getBoundingClientRect();
		const x = X0 + ((e.clientX - r.left) / r.width) * (W / S);
		const y = Y1 - ((e.clientY - r.top) / r.height) * (H / S);
		let best = 0;
		let bd = Infinity;
		lv.targets.forEach((t, i) => {
			const d = Math.hypot(t.p[0] - x, t.p[1] - y);
			if (d < bd) {
				bd = d;
				best = i;
			}
		});
		sim.aim(best);
	}
	function nudge(e: KeyboardEvent) {
		if (locked) return;
		const step =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!step) return;
		e.preventDefault();
		sim.aim((sim.target + step + lv.targets.length) % lv.targets.length);
	}
</script>

<!-- Keyboard is handled (arrow keys cycle work points), so this map is interactive despite being an <svg>. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svg}
	viewBox="0 0 {W} {H}"
	class="w-full {locked ? 'cursor-not-allowed' : 'cursor-pointer'}"
	role="application"
	tabindex="0"
	aria-label="Plan view of the {lv.name}. Click near a work point, or use the arrow keys, to choose it."
	onclick={pick}
	onkeydown={nudge}
>
	<rect
		x={px(0)}
		y={py(lv.max[1] - 0.05)}
		width={(lv.max[0] - 0.05) * S}
		height={(lv.max[1] - lv.min[1] - 0.1) * S}
		class="fill-muted"
	/>
	{#each walls as w, i (i)}
		<rect
			x={px(w.x)}
			y={py(w.y)}
			width={Math.max(1, w.w * S)}
			height={Math.max(1, w.h * S)}
			class={w.tube ? 'fill-foreground/25' : 'fill-foreground/55'}
		/>
	{/each}
	<polyline
		points={route}
		fill="none"
		class={sim.plan?.problem ? 'stroke-destructive' : 'stroke-primary'}
		stroke-width="1.25"
		stroke-dasharray="4 3"
	/>
	<polyline
		points={body}
		fill="none"
		class="stroke-foreground"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	{#each lv.targets as t, i (i)}
		<circle
			cx={px(t.p[0])}
			cy={py(t.p[1])}
			r={i === sim.target ? 6 : 3.5}
			class={i === sim.target
				? sim.plan?.problem
					? 'fill-none stroke-destructive'
					: 'fill-none stroke-primary'
				: 'fill-muted-foreground'}
			stroke-width="1.5"
		/>
	{/each}
</svg>
