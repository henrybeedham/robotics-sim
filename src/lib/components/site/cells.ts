/** The four cells, in nav order. */
export const CELLS = [
	{
		id: 'drape',
		name: 'Drape',
		line: 'Conformal pick-and-place of carbon plies onto a curved mould'
	},
	{ id: 'reach', name: 'Reach', line: 'A snake arm threading rib holes inside a wing box' },
	{ id: 'stack', name: 'Stack', line: 'Palletising hot billets from a moving conveyor' },
	{ id: 'tandem', name: 'Tandem', line: 'Two gantries sharing one rail over a long mould' }
] as const;

export type CellId = (typeof CELLS)[number]['id'];
