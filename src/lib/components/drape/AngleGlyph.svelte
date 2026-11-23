<script lang="ts">
	/** A small square showing a ply's fibre direction. 0° runs along the ply's long edge. */
	let { angle, size = 14 }: { angle: number; size?: number } = $props();
	const id = $props.id();
	const lines = [-4.5, 0, 4.5];
</script>

<svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true" class="shrink-0">
	<defs>
		<clipPath id="clip-{id}"><rect x="-7" y="-7" width="14" height="14" /></clipPath>
	</defs>
	<rect
		x="-7.5"
		y="-7.5"
		width="15"
		height="15"
		fill="none"
		stroke="currentColor"
		stroke-opacity="0.4"
	/>
	<g clip-path="url(#clip-{id})">
		<g transform="rotate({-angle})">
			{#each lines as o (o)}
				<line x1="-12" x2="12" y1={o} y2={o} stroke="currentColor" stroke-width="1.5" />
			{/each}
		</g>
	</g>
</svg>
