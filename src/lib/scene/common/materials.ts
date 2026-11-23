import {
	CanvasTexture,
	Color,
	MeshStandardMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	DoubleSide
} from 'three';

/** Shared materials. One instance each so the scene stays cheap to draw. */
export const paint = new MeshStandardMaterial({
	color: '#d4861f',
	roughness: 0.42,
	metalness: 0.15
});
export const darkPaint = new MeshStandardMaterial({
	color: '#2d2b28',
	roughness: 0.6,
	metalness: 0.2
});
export const steel = new MeshStandardMaterial({
	color: '#a29d94',
	roughness: 0.35,
	metalness: 0.7
});
export const tooling = new MeshStandardMaterial({
	color: '#b9b5ad',
	roughness: 0.32,
	metalness: 0.75
});
export const tableTop = new MeshStandardMaterial({ color: '#e3ded4', roughness: 0.85 });
export const rubber = new MeshStandardMaterial({ color: '#1c1b1a', roughness: 0.9 });
export const vacuumOn = new MeshStandardMaterial({
	color: '#e39a2c',
	emissive: new Color('#c56a10'),
	emissiveIntensity: 0.4,
	roughness: 0.6
});
export const laser = new MeshStandardMaterial({
	color: '#ff4a2a',
	emissive: new Color('#ff3a1a'),
	emissiveIntensity: 2,
	side: DoubleSide
});
export const fan = new MeshStandardMaterial({
	color: '#ff4a2a',
	emissive: new Color('#ff3a1a'),
	emissiveIntensity: 1,
	transparent: true,
	opacity: 0.12,
	side: DoubleSide,
	depthWrite: false
});
export const frustum = new MeshStandardMaterial({
	color: '#ffffff',
	emissive: new Color('#9fd3ff'),
	emissiveIntensity: 0.8,
	transparent: true,
	opacity: 0.1,
	side: DoubleSide,
	depthWrite: false
});

let fibre: CanvasTexture | null = null;

/**
 * Carbon tows as a tileable stripe texture. Each ply rotates its UVs by its
 * fibre angle, so one texture covers 0°, ±45° and 90° plies.
 */
export function fibreTexture() {
	if (fibre) return fibre;
	const size = 128;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const tows = 4;
	const h = size / tows;
	for (let i = 0; i < tows; i++) {
		const g = ctx.createLinearGradient(0, i * h, 0, (i + 1) * h);
		g.addColorStop(0, '#1b1b1d');
		g.addColorStop(0.45, '#3a3a3e');
		g.addColorStop(0.55, '#34343a');
		g.addColorStop(1, '#161618');
		ctx.fillStyle = g;
		ctx.fillRect(0, i * h, size, h);
	}
	// Stitching threads of a non-crimp fabric, running across the tows.
	ctx.strokeStyle = 'rgba(210, 205, 190, 0.18)';
	ctx.lineWidth = 1;
	for (let x = 0; x < size; x += 16) {
		ctx.beginPath();
		ctx.moveTo(x + 0.5, 0);
		ctx.lineTo(x + 0.5, size);
		ctx.stroke();
	}
	fibre = new CanvasTexture(canvas);
	fibre.wrapS = fibre.wrapT = RepeatWrapping;
	fibre.colorSpace = SRGBColorSpace;
	fibre.anisotropy = 8;
	return fibre;
}

/** Real-world size of one texture tile, metres. */
export const FIBRE_TILE = 0.05;
