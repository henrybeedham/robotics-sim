<script lang="ts">
	let { items }: { items: { label: string; value: string; unit?: string }[] } = $props();
</script>

<section class="grid grid-cols-2 border-b" aria-label="Results">
	{#each items as f, i (f.label)}
		<div class="space-y-0.5 px-4 py-3 {i % 2 ? 'border-l' : ''} {i > 1 ? 'border-t' : ''}">
			<div class="label">{f.label}</div>
			<div class="figures text-2xl leading-none">
				{f.value}{#if f.unit}<span class="ml-1 text-xs text-muted-foreground">{f.unit}</span>{/if}
			</div>
		</div>
	{/each}
</section>
