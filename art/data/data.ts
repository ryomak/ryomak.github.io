export interface Data {
	language: string;
	name: string;
	image: string;
	at: string;
}

export const arts: Data[] = [
	{
		language: "go",
		name: "ruby_image",
		image: "go_ruby_image.png",
		at: "2024-10-13",
	},
];

export function getArtWasm(a: Data) {
	return eval(getArtWasmName(a))
}

export function getArtWasmName(a: Data) {
	return `${a.language}_${a.name}`
}