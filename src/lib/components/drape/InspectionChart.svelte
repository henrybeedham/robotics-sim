<script lang="ts">
	import type { Simulation } from '#lib/sim/engine.svelte.js';
	import { PLY_CORNERS, applyOffset } from '#lib/sim/cell.js';
	import { angleLabel, fixed, signed } from '#lib/format.js';

	let { sim }: { sim: Simulation } = $props();

	const W = 360;
	const H = 120;
	const pad = { l: 30, r: 6, t: 10, b: 16 };

	const plies = $derived(sim.plies);
	const tol = $derived(sim.config.tolerance);
	const yMax = $derived(Math.max(tol * 1.6, ...plies.map((p) => p.deviation ?? 0)) * 1.08);
	const slot = $derived((W - pad.l - pad.r) / Math.max(plies.length, 1));
	const barW = $derived(Math.max(2, Math.min(12, slot - 2)));
	const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / yMax);
	const ticks = $derived(
		[0, tol, Math.round(yMax * 0.95 * 2) / 2].filter((v, i, a) => a.indexOf(v) === i && v <= yMax)
	);

	let hover = $state<number | null>(null);
	const lastInspected = $derived(
		[...plies].reverse().find((p) => p.status === 'inspected')?.index ?? null
	);
	const focus = $derived(hover ?? lastInspected);
	const focused = $derived(focus === null ? null : plies[focus]);

	// Deviation diagram: the ply outline, with its error magnified so millimetres are visible.
	const MAG = 25;
	const scale = 150 / 0.62;
	const outline = (pts: [number, number][]) =>
		pts.map(([u, v]) => `${(u * scale).toFixed(1)},${(-v * scale).toFixed(1)}`).join(' ');
	const nominal = outline(PLY_CORNERS);
	const actual = $derived.by(() => {
		const m = focused?.measured;
		if (!m) return null;
		const e = {
			u: (m.u / 1000) * MAG,
			v: (m.v / 1000) * MAG,
			theta: ((m.theta * Math.PI) / 180) * MAG
		};
		return outline(PLY_CORNERS.map(([u, v]) => applyOffset(e, u, v)));
	});
</script>

<div class="space-y-3">
	<div class="relative">
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full overflow-visible"
			role="img"
			aria-label="Worst-corner deviation for each inspected ply against the ±{tol} mm tolerance"
		>
			{#each ticks as t (t)}
				<line
					x1={pad.l}
					x2={W - pad.r}
					y1={y(t)}
					y2={y(t)}
					class="stroke-border"
					stroke-width="1"
				/>
				<text
					x={pad.l - 6}
					y={y(t)}
					dy="0.32em"
					text-anchor="end"
					class="fill-muted-foreground figures text-[9px]"
				>
					{fixed(t, 1)}
				</text>
			{/each}
			<line
				x1={pad.l}
				x2={W - pad.r}
				y1={y(tol)}
				y2={y(tol)}
				class="stroke-foreground"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<text
				x={W - pad.r}
				y={y(tol) - 4}
				text-anchor="end"
				class="fill-foreground figures text-[9px]"
			>
				tolerance ±{fixed(tol, 1)} mm
			</text>
			{#each plies as p (p.index)}
				{@const x = pad.l + slot * p.index + (slot - barW) / 2}
				{#if p.deviation !== null}
					<rect
						{x}
						y={y(p.deviation)}
						width={barW}
						height={Math.max(1, y(0) - y(p.deviation))}
						class={p.pass ? 'fill-foreground/70' : 'fill-destructive'}
						opacity={hover !== null && hover !== p.index ? 0.45 : 1}
					/>
					{#if !p.pass}
						<text
							x={x + barW / 2}
							y={y(p.deviation) - 3}
							text-anchor="middle"
							class="fill-destructive text-[9px] font-medium"
						>
							×
						</text>
					{/if}
				{:else}
					<rect {x} y={y(0) - 1} width={barW} height="1" class="fill-border" />
				{/if}
				<!-- Hit target wider and taller than the bar -->
				<rect
					x={pad.l + slot * p.index}
					y={pad.t}
					width={slot}
					height={H - pad.t - pad.b}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (hover = p.index)}
					onpointerleave={() => (hover = null)}
				/>
			{/each}
			<line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} class="stroke-foreground/50" />
			<text x={pad.l} y={H - 3} class="fill-muted-foreground label text-[9px]">Ply 1</text>
			<text
				x={W - pad.r}
				y={H - 3}
				text-anchor="end"
				class="fill-muted-foreground label text-[9px]"
			>
				{plies.length}
			</text>
		</svg>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t pt-3">
		<div class="min-w-0 space-y-1 text-xs">
			{#if focused?.measured}
				<div class="flex items-baseline gap-2">
					<span class="font-medium">Ply {focused.index + 1}</span>
					<span class="text-muted-foreground">
						layer {focused.layer + 1}, station {focused.station + 1}, {angleLabel(focused.angle)}
					</span>
				</div>
				<dl class="grid grid-cols-[auto_1fr] gap-x-3 figures text-[11px]">
					<dt class="text-muted-foreground">Along</dt>
					<dd>{signed(focused.measured.u, 2)} mm</dd>
					<dt class="text-muted-foreground">Across</dt>
					<dd>{signed(focused.measured.v, 2)} mm</dd>
					<dt class="text-muted-foreground">Rotation</dt>
					<dd>{signed(focused.measured.theta, 3)}°</dd>
					<dt class="text-muted-foreground">Worst corner</dt>
					<dd class={focused.pass ? '' : 'text-destructive'}>
						{fixed(focused.deviation, 2)} mm · {focused.pass ? 'pass' : 'fail'}
					</dd>
				</dl>
			{:else}
				<p class="text-muted-foreground">
					Each ply is scanned after release. Its position error appears here, with the outline drawn
					at {MAG}× so a millimetre is visible.
				</p>
			{/if}
		</div>
		<svg viewBox="-85 -50 170 100" class="h-24 w-40" aria-hidden="true">
			<polygon
				points={nominal}
				fill="none"
				class="stroke-muted-foreground"
				stroke-dasharray="3 2"
			/>
			{#if actual}
				<polygon
					points={actual}
					class={focused?.pass
						? 'fill-foreground/10 stroke-foreground'
						: 'fill-destructive/10 stroke-destructive'}
					stroke-width="1.25"
				/>
			{/if}
			<text x="84" y="48" text-anchor="end" class="fill-muted-foreground figures text-[8px]">
				×{MAG}
			</text>
		</svg>
	</div>
</div>
