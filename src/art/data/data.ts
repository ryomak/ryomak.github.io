export interface Data {
	language: string;
	name: string;
	image: string;
}

export const arts: Data[] = [
	{
		language: "go",
		name: "ruby_image",
		image: "go_ruby_image.png",
	},
];

export function getArtWasm(a: Data) {
	return eval(getArtWasmName(a))
}

export function getArtWasmName(a: Data) {
	return `${a.language}_${a.name}`
}