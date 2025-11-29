import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isElectron, readFile, writeFile, createFile, deleteFile, createDir, renamePath } from './fileSystem.js';

describe('fileSystem', () => {
    const originalWindow = global.window;

    beforeEach(() => {
        // Reset window mock
        global.window = {
            electronAPI: undefined
        };

        // Mock fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.window = originalWindow;
        vi.clearAllMocks();
    });

    describe('isElectron', () => {
        it('should return true if electronAPI is present', () => {
            global.window.electronAPI = {};
            expect(isElectron()).toBe(true);
        });

        it('should return false if electronAPI is missing', () => {
            global.window.electronAPI = undefined;
            expect(isElectron()).toBe(false);
        });
    });

    describe('readFile', () => {
        it('should use electronAPI in Electron mode', async () => {
            global.window.electronAPI = {
                readFile: vi.fn().mockResolvedValue({ success: true, content: 'content' })
            };

            const content = await readFile('test.md');
            expect(content).toBe('content');
            expect(global.window.electronAPI.readFile).toHaveBeenCalledWith('test.md');
        });

        it('should throw error if electron read fails', async () => {
            global.window.electronAPI = {
                readFile: vi.fn().mockResolvedValue({ success: false, error: 'Failed' })
            };

            await expect(readFile('test.md')).rejects.toThrow('Failed');
        });

        it('should use fetch in Browser mode', async () => {
            global.window.electronAPI = undefined;
            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('content')
            });

            const content = await readFile('test.md');
            expect(content).toBe('content');
            expect(global.fetch).toHaveBeenCalledWith('test.md');
        });
    });

    describe('writeFile', () => {
        it('should use electronAPI in Electron mode', async () => {
            global.window.electronAPI = {
                writeFile: vi.fn().mockResolvedValue({ success: true })
            };

            await writeFile('test.md', 'content');
            expect(global.window.electronAPI.writeFile).toHaveBeenCalledWith('test.md', 'content');
        });

        it('should throw error in Browser mode', async () => {
            global.window.electronAPI = undefined;
            await expect(writeFile('test.md', 'content')).rejects.toThrow('not supported');
        });
    });

    describe('Other Operations', () => {
        beforeEach(() => {
            global.window.electronAPI = {
                createFile: vi.fn().mockResolvedValue({ success: true }),
                deleteFile: vi.fn().mockResolvedValue({ success: true }),
                createDir: vi.fn().mockResolvedValue({ success: true }),
                renamePath: vi.fn().mockResolvedValue({ success: true })
            };
        });

        it('should call createFile', async () => {
            await createFile('test.md');
            expect(global.window.electronAPI.createFile).toHaveBeenCalled();
        });

        it('should call deleteFile', async () => {
            await deleteFile('test.md');
            expect(global.window.electronAPI.deleteFile).toHaveBeenCalled();
        });

        it('should call createDir', async () => {
            await createDir('folder');
            expect(global.window.electronAPI.createDir).toHaveBeenCalled();
        });

        it('should call renamePath', async () => {
            await renamePath('old', 'new');
            expect(global.window.electronAPI.renamePath).toHaveBeenCalled();
        });
    });
});
