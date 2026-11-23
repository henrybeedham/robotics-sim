<script lang="ts">
	/** What each gantry was doing over time, one lane per gantry. */
	import type { Activity, Span } from '#lib/sim/tandem.svelte.js';
	import { clock } from '#lib/format.js';

	let { spans, now, end, lanes }: { spans: Span[]; now: number; end: number; lanes: number[] } =
		$props();

	const W = 360;
	const lane = 18;
	const pad = { l: 16, r: 4, t: 4 };
	const H = $derived(pad.t + lanes.length * (lane + 6) + 14);
	const span = $derived(Math.max(end, now, 1));
	const x = (t: number) => pad.l + ((W - pad.l - pad.r) * t) / span;

	const fill: Record<Activity, string> = {
		move: 'fill-foreground/45',
		pick: 'fill-primary',
		place: 'fill-primary',
		zone: 'fill-[url(#hatch)]',
		layer: 'fill-muted-foreground/25',
		idle: 'fill-transparent'
	};
	const legend: { kind: Activity; name: string }[] = [
		{ kind: 'pick', name: 'Pick or place' },
		{ kind: 'move', name: 'Travel' },
		{ kind: 'zone', name: 'Waiting for rail' },
		{ kind: 'layer', name: 'Waiting for layer' }
	];
	let hover = $state<Span | null>(null);
</script>

<div class="space-y-2">
	<div class="relative">
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full"
			role="img"
			aria-label="Timeline of each gantry's activity"
		>
			<defs>
				<pattern
					id="hatch"
					width="4"
					height="4"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<rect width="4" height="4" class="fill-destructive/15" />
					<line x1="0" y1="0" x2="0" y2="4" class="stroke-destructive" stroke-width="1.5" />
				</pattern>
			</defs>
			{#each lanes as g, li (g)}
				{@const y0 = pad.t + li * (lane + 6)}
				<text x="0" y={y0 + lane / 2} dy="0.32em" class="fill-muted-foreground figures text-[10px]">
					{g === 0 ? 'A' : 'B'}
				</text>
				<rect x={pad.l} y={y0} width={W - pad.l - pad.r} height={lane} class="fill-muted/60" />
				{#each spans.filter((s) => s.gantry === g && s.kind !== 'idle') as s, i (i)}
					<rect
						x={x(s.start)}
						y={y0}
						width={Math.max(0.5, x(s.end) - x(s.start))}
						height={lane}
						class={fill[s.kind]}
						role="presentation"
						onpointerenter={() => (hover = s)}
						onpointerleave={() => (hover = null)}
					/>
				{/each}
			{/each}
			{#if now > 0 && now < span}
				<line x1={x(now)} x2={x(now)} y1={pad.t - 2} y2={H - 12} class="stroke-foreground" />
			{/if}
			<text x={pad.l} y={H - 2} class="fill-muted-foreground figures text-[9px]">0:00</text>
			<text
				x={W - pad.r}
				y={H - 2}
				text-anchor="end"
				class="fill-muted-foreground figures text-[9px]"
			>
				{clock(span).slice(0, 5)}
			</text>
		</svg>
		{#if hover}
			<div
				class="pointer-events-none absolute -top-7 left-4 border bg-popover px-2 py-1 figures text-[11px]"
			>
				{hover.gantry === 0 ? 'A' : 'B'} · {legend.find((l) => l.kind === hover!.kind)?.name ??
					'Pick or place'} · {(hover.end - hover.start).toFixed(1)} s
			</div>
		{/if}
	</div>
	<ul class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
		{#each legend as l (l.kind)}
			<li class="flex items-center gap-1.5">
				<svg width="12" height="10" aria-hidden="true">
					<rect width="12" height="10" class={fill[l.kind]} />
				</svg>
				{l.name}
			</li>
		{/each}
	</ul>
</div>
