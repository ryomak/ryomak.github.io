export interface Data {
	language: string;
	name: string;
	at: string;
}

export const arts: Data[] = [
	{
		language: "go",
		name: "ruby_image",
		at: "2024-10-13",
	},
	{
		language: "go",
		name: "move_eye",
		at: "2024-10-13",
	},
	{
		language: "go",
		name: "20250118",
		at: "2025-01-18",
	},
	{
		language: "go",
		name: "20250201",
		at: "2025-02-01",
	},
	{
		language: "go",
		name: "20250202",
		at: "2025-02-02",
	},
	{
		language: "go",
		name: "20250209",
		at: "2025-02-09",
	},
	{
		language: "go",
		name: "retro_game",
		at: "2025-08-07"
	}
];

export function getArtWasm(a: Data) {
	return eval(getArtWasmName(a))
}

export function getArtWasmName(a: Data) {
	return `${a.language}_${a.name}`
}