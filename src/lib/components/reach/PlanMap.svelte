<script lang="ts">
	/** Top-down plan of the wing box. Click inside a bay to choose the work point. */
	import { BOX, RIBS, type Reach } from '#lib/sim/reach.svelte.js';

	let { sim, locked }: { sim: Reach; locked: boolean } = $props();

	const X0 = -0.45;
	const X1 = BOX.x1 + 0.1;
	const S = 110;
	const W = (X1 - X0) * S;
	const H = (BOX.y1 - BOX.y0 + 0.2) * S;
	// Plan view: x to the right, y up the page.
	const px = (x: number) => (x - X0) * S;
	const py = (y: number) => (BOX.y1 + 0.1 - y) * S;

	const route = $derived(
		sim.plan.path.points.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
	);
	const body = $derived(
		sim.readout.joints.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
	);

	let svg: SVGSVGElement;
	function pick(e: MouseEvent) {
		if (locked) return;
		const r = svg.getBoundingClientRect();
		const x = X0 + ((e.clientX - r.left) / r.width) * (W / S);
		const y = BOX.y1 + 0.1 - ((e.clientY - r.top) / r.height) * (H / S);
		if (x < BOX.x0 || x > BOX.x1 || y < BOX.y0 || y > BOX.y1) return;
		sim.aim({ x, y });
	}

	const steps: Record<string, [number, number]> = {
		ArrowLeft: [-0.05, 0],
		ArrowRight: [0.05, 0],
		ArrowUp: [0, 0.05],
		ArrowDown: [0, -0.05]
	};
	function nudge(e: KeyboardEvent) {
		const d = steps[e.key];
		if (!d || locked) return;
		e.preventDefault();
		sim.aim({ x: sim.target.x + d[0], y: sim.target.y + d[1] });
	}
</script>

<!-- Keyboard is handled (arrow keys), so this map is interactive despite being an <svg>. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svg}
	viewBox="0 0 {W} {H}"
	class="w-full {locked ? 'cursor-not-allowed' : 'cursor-crosshair'}"
	role="application"
	tabindex="0"
	aria-label="Plan view of the wing box. Click a bay, or use the arrow keys, to move the work point."
	onclick={pick}
	onkeydown={nudge}
>
	<rect
		x={px(BOX.x0)}
		y={py(BOX.y1)}
		width={(BOX.x1 - BOX.x0) * S}
		height={(BOX.y1 - BOX.y0) * S}
		class="fill-muted stroke-foreground/50"
	/>
	{#each RIBS as r (r.x)}
		<line
			x1={px(r.x)}
			x2={px(r.x)}
			y1={py(BOX.y1)}
			y2={py(BOX.y0)}
			class="stroke-foreground/60"
			stroke-width="2"
		/>
		{#if r.hole}
			<line
				x1={px(r.x)}
				x2={px(r.x)}
				y1={py(r.hole.y + r.hole.r)}
				y2={py(r.hole.y - r.hole.r)}
				class="stroke-muted"
				stroke-width="4"
			/>
		{/if}
	{/each}
	<polyline
		points={route}
		fill="none"
		class={sim.plan.problem ? 'stroke-destructive' : 'stroke-primary'}
		stroke-width="1.25"
		stroke-dasharray="4 3"
	/>
	<polyline
		points={body}
		fill="none"
		class="stroke-foreground"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<circle
		cx={px(sim.target.x)}
		cy={py(sim.target.y)}
		r="6"
		fill="none"
		class={sim.plan.problem ? 'stroke-destructive' : 'stroke-primary'}
		stroke-width="1.5"
	/>
	<text x={px(BOX.x0) + 4} y={py(BOX.y0) - 4} class="fill-muted-foreground label text-[9px]">
		Root
	</text>
	<text
		x={px(BOX.x1) - 4}
		y={py(BOX.y0) - 4}
		text-anchor="end"
		class="fill-muted-foreground label text-[9px]"
	>
		Tip
	</text>
</svg>
