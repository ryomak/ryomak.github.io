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
	}
];

export function getArtWasm(a: Data) {
	return eval(getArtWasmName(a))
}

export function getArtWasmName(a: Data) {
	return `${a.language}_${a.name}`
}