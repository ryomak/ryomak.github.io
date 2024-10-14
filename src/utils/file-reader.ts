import fs from 'fs/promises';
import path from 'path';

export async function readFile(language: string, name: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'art', language, name, `main.${language}`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return 'Error: Could not read the Go file.';
  }
}