import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';

export async function downloadImage(
    url: string,
    destinationPath: string,
): Promise<string> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        // Asegurarse de que el directorio existe
        const dir = path.dirname(destinationPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(destinationPath, response.data);
        return destinationPath;
    } catch (error) {
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

export function calculateMD5(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

export function getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
}

export function ensureDirectoryExists(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}
