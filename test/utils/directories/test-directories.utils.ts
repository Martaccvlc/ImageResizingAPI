import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

// Get the workspace root from environment or use a default
const getWorkspaceRoot = () => {
    if (process.env.WORKSPACE_ROOT) {
        return process.env.WORKSPACE_ROOT;
    }
    // Try to find package.json to determine workspace root
    let currentDir = process.cwd();
    while (currentDir !== '/') {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return process.cwd();
};

export function setupTestDirectories(): { testInputDir: string; testOutputDir: string } {
    const workspaceRoot = getWorkspaceRoot();
    console.log('Setting up test directories:', {
        workspaceRoot,
        cwd: process.cwd(),
        dirname: __dirname
    });

    const testInputDir = path.join(workspaceRoot, 'test/test-input');
    const testOutputDir = path.join(workspaceRoot, 'test/test-output');

    // Clean up existing directories first
    cleanupTestDirectories();

    // Create base directories with proper permissions
    fs.mkdirSync(testInputDir, { recursive: true, mode: 0o775 });
    fs.mkdirSync(testOutputDir, { recursive: true, mode: 0o775 });

    // Create resolution directories
    ['800', '1024'].forEach(resolution => {
        const resolutionDir = path.join(testOutputDir, resolution);
        fs.mkdirSync(resolutionDir, { recursive: true, mode: 0o775 });
    });

    // Verify directories exist and have correct permissions
    [testInputDir, testOutputDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            throw new Error(`Failed to create directory: ${dir}`);
        }
        const stats = fs.statSync(dir);
        if ((stats.mode & 0o777) !== 0o775) {
            fs.chmodSync(dir, 0o775);
        }
    });

    console.log('Test directories created:', {
        testInputDir,
        testOutputDir,
        inputExists: fs.existsSync(testInputDir),
        outputExists: fs.existsSync(testOutputDir)
    });

    return { testInputDir, testOutputDir };
}

export function cleanupTestDirectories(): void {
    const workspaceRoot = getWorkspaceRoot();
    const testInputDir = path.join(workspaceRoot, 'test/test-input');
    const testOutputDir = path.join(workspaceRoot, 'test/test-output');

    // Retry cleanup a few times in case of file system locks
    for (let i = 0; i < 3; i++) {
        try {
            if (fs.existsSync(testInputDir)) {
                fs.rmSync(testInputDir, { recursive: true, force: true });
            }
            if (fs.existsSync(testOutputDir)) {
                fs.rmSync(testOutputDir, { recursive: true, force: true });
            }
            break;
        } catch (error) {
            if (i === 2) {
                console.error('Failed to cleanup test directories:', error);
            }
            // Wait a bit before retrying
            const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            wait(100);
        }
    }
} 