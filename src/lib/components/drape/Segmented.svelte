<script lang="ts" generics="T extends string | number">
	let {
		options,
		value,
		onchange,
		disabled = false,
		label,
		size = 'default'
	}: {
		options: { value: T; label: string }[];
		value: T;
		onchange: (v: T) => void;
		disabled?: boolean;
		label: string;
		size?: 'default' | 'sm';
	} = $props();
</script>

<div class="inline-flex border" role="radiogroup" aria-label={label}>
	{#each options as o, i (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={o.value === value}
			{disabled}
			class="px-2.5 figures text-xs transition-colors duration-150 disabled:opacity-50 {size ===
			'sm'
				? 'h-7'
				: 'h-8'} {i > 0 ? 'border-l' : ''} {o.value === value
				? 'bg-foreground text-background'
				: 'hover:bg-muted'}"
			onclick={() => onchange(o.value)}
		>
			{o.label}
		</button>
	{/each}
</div>
