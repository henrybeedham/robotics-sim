<script lang="ts">
	/**
	 * Perimeter guarding on chosen sides of a rectangle: wire-mesh panels on
	 * yellow posts, plus yellow floor lines all round. Z-up.
	 */
	import { T } from '@threlte/core';
	import { DoubleSide, MeshStandardMaterial } from 'three';
	import { meshTexture, safety } from './materials';

	let {
		x0,
		x1,
		y0,
		y1,
		sides = ['back', 'left', 'right'],
		height = 1.6
	}: {
		x0: number;
		x1: number;
		y0: number;
		y1: number;
		sides?: ('front' | 'back' | 'left' | 'right')[];
		height?: number;
	} = $props();

	const PANEL = 1.2;
	const wire = new MeshStandardMaterial({
		color: '#77736b',
		map: meshTexture(),
		alphaMap: meshTexture(),
		transparent: true,
		opacity: 0.85,
		depthWrite: false,
		metalness: 0.5,
		roughness: 0.5,
		side: DoubleSide
	});

	type Run = { ax: number; ay: number; bx: number; by: number };
	const runs = $derived.by(() => {
		const out: Run[] = [];
		if (sides.includes('back')) out.push({ ax: x0, ay: y1, bx: x1, by: y1 });
		if (sides.includes('front')) out.push({ ax: x0, ay: y0, bx: x1, by: y0 });
		if (sides.includes('left')) out.push({ ax: x0, ay: y0, bx: x0, by: y1 });
		if (sides.includes('right')) out.push({ ax: x1, ay: y0, bx: x1, by: y1 });
		return out;
	});

	const panels = $derived(
		runs.flatMap((r) => {
			const len = Math.hypot(r.bx - r.ax, r.by - r.ay);
			const n = Math.max(1, Math.round(len / PANEL));
			const angle = Math.atan2(r.by - r.ay, r.bx - r.ax);
			return Array.from({ length: n }, (_, i) => {
				const t0 = i / n;
				const t1 = (i + 1) / n;
				return {
					cx: r.ax + (r.bx - r.ax) * ((t0 + t1) / 2),
					cy: r.ay + (r.by - r.ay) * ((t0 + t1) / 2),
					px: r.ax + (r.bx - r.ax) * t0,
					py: r.ay + (r.by - r.ay) * t0,
					len: len / n,
					angle,
					last: i === n - 1 ? { x: r.bx, y: r.by } : null
				};
			});
		})
	);

	const line = 0.06;
</script>

{#each panels as p, i (i)}
	<T.Group position={[p.cx, p.cy, 0]} rotation.z={p.angle}>
		<T.Mesh position={[0, 0, 0.15 + (height - 0.15) / 2]} material={wire}>
			<T.PlaneGeometry
				args={[p.len - 0.06, height - 0.15]}
				oncreate={(g) => {
					const uv = g.getAttribute('uv');
					for (let k = 0; k < uv.count; k++)
						uv.setXY(k, uv.getX(k) * (p.len / 0.1), uv.getY(k) * ((height - 0.15) / 0.1));
				}}
			/>
		</T.Mesh>
		<!-- Frame top and bottom rails -->
		{#each [0.15, height] as z (z)}
			<T.Mesh position={[0, 0, z]} rotation.x={Math.PI / 2}>
				<T.BoxGeometry args={[p.len - 0.06, 0.025, 0.025]} />
				<T.MeshStandardMaterial color="#2a2826" roughness={0.5} metalness={0.4} />
			</T.Mesh>
		{/each}
	</T.Group>
	{#each [{ x: p.px, y: p.py }, ...(p.last ? [p.last] : [])] as post, k (k)}
		<T.Mesh position={[post.x, post.y, height / 2 + 0.02]} material={safety} castShadow>
			<T.BoxGeometry args={[0.05, 0.05, height + 0.04]} />
		</T.Mesh>
		<T.Mesh position={[post.x, post.y, 0.005]} material={safety}>
			<T.BoxGeometry args={[0.14, 0.14, 0.01]} />
		</T.Mesh>
	{/each}
{/each}

<!-- Floor lines, just outside the guarding -->
{#each [{ x: (x0 + x1) / 2, y: y0 - 0.15, w: x1 - x0 + 0.36, h: line }, { x: (x0 + x1) / 2, y: y1 + 0.15, w: x1 - x0 + 0.36, h: line }, { x: x0 - 0.15, y: (y0 + y1) / 2, w: line, h: y1 - y0 + 0.36 }, { x: x1 + 0.15, y: (y0 + y1) / 2, w: line, h: y1 - y0 + 0.36 }] as l, i (i)}
	<T.Mesh position={[l.x, l.y, 0.002]} material={safety} receiveShadow>
		<T.PlaneGeometry args={[l.w, l.h]} />
	</T.Mesh>
{/each}
