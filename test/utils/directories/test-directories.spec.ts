import * as fs from 'fs';
import * as path from 'path';

export const setupTestDirectories = () => {
    const testInputDir = './test-input';
    const testOutputDir = './test-output';

    if (!fs.existsSync(testInputDir)) {
        fs.mkdirSync(testInputDir, { recursive: true });
    }

    if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Create a sample test image
    const sampleImageBuffer = Buffer.alloc(1024, 0);
    fs.writeFileSync(
        path.join(testInputDir, 'test-image.jpg'),
        sampleImageBuffer,
    );

    return { testInputDir, testOutputDir };
};

export const cleanupTestDirectories = () => {
    fs.rmSync('./test-input', { recursive: true, force: true });
    fs.rmSync('./test-output', { recursive: true, force: true });
};