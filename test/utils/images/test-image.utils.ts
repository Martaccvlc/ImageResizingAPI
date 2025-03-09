import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

interface TestImageOptions {
    width: number;
    height: number;
    background: {
        r: number;
        g: number;
        b: number;
        alpha?: number;
    };
}

export async function createTestImage(outputPath: string, options: TestImageOptions): Promise<void> {
    try {
        // Ensure absolute path
        const absolutePath = path.resolve(outputPath);
        
        // Ensure the parent directory exists with proper permissions
        const parentDir = path.dirname(absolutePath);
        console.log('Setting up directory:', {
            parentDir,
            exists: fs.existsSync(parentDir),
            absolutePath,
            originalPath: outputPath
        });

        if (!fs.existsSync(parentDir)) {
            console.log('Creating parent directory');
            fs.mkdirSync(parentDir, { recursive: true, mode: 0o775 });
        }

        // Ensure we have write permissions
        const stats = fs.statSync(parentDir);
        console.log('Directory stats:', {
            mode: stats.mode.toString(8),
            uid: stats.uid,
            gid: stats.gid
        });

        if ((stats.mode & 0o777) !== 0o775) {
            console.log('Fixing directory permissions');
            fs.chmodSync(parentDir, 0o775);
        }

        console.log('Creating test image:', {
            absolutePath,
            parentDir,
            parentDirExists: fs.existsSync(parentDir),
            parentDirMode: stats.mode.toString(8),
            options
        });

        // Create the image
        try {
            await sharp({
                create: {
                    width: options.width,
                    height: options.height,
                    channels: 3,
                    background: options.background
                }
            })
            .jpeg()
            .toFile(absolutePath);
        } catch (sharpError) {
            console.error('Sharp error:', {
                error: sharpError.message,
                stack: sharpError.stack,
                code: (sharpError as any).code
            });
            throw sharpError;
        }

        // Verify the file was created
        if (!fs.existsSync(absolutePath)) {
            console.error('File was not created:', {
                path: absolutePath,
                parentExists: fs.existsSync(parentDir),
                parentWritable: (stats.mode & 0o200) !== 0
            });
            throw new Error(`Failed to create test image at ${absolutePath}`);
        }

        // Ensure the file has proper permissions
        fs.chmodSync(absolutePath, 0o664);

        const finalStats = fs.statSync(absolutePath);
        console.log('Test image created:', {
            absolutePath,
            exists: fs.existsSync(absolutePath),
            stats: {
                size: finalStats.size,
                mode: finalStats.mode.toString(8),
                uid: finalStats.uid,
                gid: finalStats.gid
            }
        });
    } catch (error) {
        console.error('Failed to create test image:', {
            outputPath,
            error: error.message,
            stack: error.stack,
            code: (error as any).code,
            errno: (error as any).errno
        });
        throw error;
    }
} 