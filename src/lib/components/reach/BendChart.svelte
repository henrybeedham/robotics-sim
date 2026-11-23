<script lang="ts">
	/** Bend at each joint, tip on the left, against the joint limit. */
	let { bends, limit }: { bends: number[]; limit: number } = $props();

	const W = 360;
	const H = 90;
	const pad = { l: 26, r: 4, t: 8, b: 14 };
	const yMax = $derived(Math.max(limit * 1.25, ...bends));
	const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / yMax);
	const slot = $derived((W - pad.l - pad.r) / Math.max(1, bends.length));
	let hover = $state<number | null>(null);
</script>

<div class="relative">
	<svg
		viewBox="0 0 {W} {H}"
		class="w-full overflow-visible"
		role="img"
		aria-label="Bend at each joint against the {limit}° limit"
	>
		<line
			x1={pad.l}
			x2={W - pad.r}
			y1={y(limit)}
			y2={y(limit)}
			class="stroke-foreground"
			stroke-dasharray="3 3"
		/>
		<text
			x={W - pad.r}
			y={y(limit) - 4}
			text-anchor="end"
			class="fill-foreground figures text-[9px]"
		>
			limit {limit}°
		</text>
		<text
			x={pad.l - 6}
			y={y(0)}
			dy="0.32em"
			text-anchor="end"
			class="fill-muted-foreground figures text-[9px]"
		>
			0
		</text>
		{#each bends as b, i (i)}
			<rect
				x={pad.l + i * slot + 1}
				y={y(b)}
				width={Math.max(1.5, slot - 2)}
				height={Math.max(0.5, y(0) - y(b))}
				class={b > limit ? 'fill-destructive' : 'fill-foreground/70'}
				opacity={hover !== null && hover !== i ? 0.45 : 1}
			/>
			<rect
				x={pad.l + i * slot}
				y={pad.t}
				width={slot}
				height={H - pad.t - pad.b}
				fill="transparent"
				role="presentation"
				onpointerenter={() => (hover = i)}
				onpointerleave={() => (hover = null)}
			/>
		{/each}
		<line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} class="stroke-foreground/50" />
		<text x={pad.l} y={H - 2} class="fill-muted-foreground label text-[9px]">Tip</text>
		<text x={W - pad.r} y={H - 2} text-anchor="end" class="fill-muted-foreground label text-[9px]">
			Base
		</text>
	</svg>
	{#if hover !== null}
		<div
			class="pointer-events-none absolute top-0 left-8 border bg-popover px-2 py-1 figures text-[11px]"
		>
			Joint {hover + 1}: {bends[hover].toFixed(1)}°
		</div>
	{/if}
</div>
