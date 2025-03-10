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
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Ensure absolute path
            const absolutePath = path.resolve(outputPath);
            
            // Ensure the parent directory exists with proper permissions
            const parentDir = path.dirname(absolutePath);
            console.log('Setting up directory:', {
                parentDir,
                exists: fs.existsSync(parentDir),
                absolutePath,
                originalPath: outputPath,
                attempt: attempt + 1
            });

            // Create parent directory if it doesn't exist
            if (!fs.existsSync(parentDir)) {
                console.log('Creating parent directory');
                fs.mkdirSync(parentDir, { recursive: true, mode: 0o775 });
                // Wait for directory creation
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Remove existing file if it exists
            if (fs.existsSync(absolutePath)) {
                console.log('Removing existing file');
                fs.unlinkSync(absolutePath);
                // Wait for file deletion
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Ensure we have write permissions
            const stats = fs.statSync(parentDir);
            console.log('Directory stats:', {
                mode: stats.mode.toString(8),
                uid: stats.uid,
                gid: stats.gid,
                attempt: attempt + 1
            });

            if ((stats.mode & 0o777) !== 0o775) {
                console.log('Fixing directory permissions');
                fs.chmodSync(parentDir, 0o775);
                // Wait for permission change
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Create a solid color image
            const imageBuffer = await sharp({
                create: {
                    width: options.width,
                    height: options.height,
                    channels: 3,
                    background: options.background
                }
            })
            .jpeg({
                quality: 90,
                chromaSubsampling: '4:4:4'
            })
            .toBuffer();

            // Write the buffer to file with retries
            for (let writeAttempt = 0; writeAttempt < 3; writeAttempt++) {
                try {
                    fs.writeFileSync(absolutePath, imageBuffer, { mode: 0o664 });
                    break;
                } catch (writeError) {
                    if (writeAttempt === 2) throw writeError;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Verify the file was created
            if (!fs.existsSync(absolutePath)) {
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
                },
                attempt: attempt + 1
            });

            // Success - return early
            return;
        } catch (error) {
            lastError = error;
            console.error('Failed to create test image (attempt ' + (attempt + 1) + '):', {
                outputPath,
                error: error.message,
                stack: error.stack,
                code: (error as any).code,
                errno: (error as any).errno
            });
            
            // Wait before retry
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // If we get here, all attempts failed
    throw lastError || new Error('Failed to create test image after all retries');
} 