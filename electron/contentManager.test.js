import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ContentManager from './contentManager.mjs';
import fs from 'fs-extra';
import path from 'path';
import chokidar from 'chokidar';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    glob: vi.fn(),
    matter: vi.fn()
}));

vi.mock('fs-extra');
vi.mock('chokidar');
vi.mock('glob', () => ({
    glob: mocks.glob
}));
vi.mock('gray-matter', () => ({
    default: mocks.matter
}));
vi.mock('electron', () => ({
    app: { isPackaged: false }
}));

describe('ContentManager', () => {
    let contentManager;
    let mockWindow;
    const mockContentPath = '/mock/content';

    beforeEach(() => {
        mockWindow = {
            webContents: {
                send: vi.fn()
            },
            isDestroyed: () => false
        };
        // Reset mocks
        mocks.glob.mockReset();
        mocks.matter.mockReset();

        // Setup chokidar mock
        chokidar.watch.mockReturnValue({
            on: vi.fn().mockReturnThis(),
            close: vi.fn()
        });

        // Default fs mocks
        fs.pathExists.mockResolvedValue(false);
        fs.stat.mockResolvedValue({ isDirectory: () => false });
        fs.readFile.mockResolvedValue('');

        contentManager = new ContentManager(mockWindow);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and scan content', async () => {
        mocks.glob.mockResolvedValue(['test.md']);
        mocks.matter.mockReturnValue({ data: { title: 'Test' }, content: 'Content' });

        await contentManager.initialize(mockContentPath);

        expect(contentManager.index).toHaveLength(1);
        expect(contentManager.index[0].title).toBe('Test');
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('content-updated', expect.any(Object));
    });

    it('should sanitize Date objects in frontmatter', async () => {
        mocks.glob.mockResolvedValue(['date-test.md']);
        const dateObj = new Date('2023-01-01T00:00:00.000Z');
        mocks.matter.mockReturnValue({
            data: { title: 'Date Test', date: dateObj },
            content: 'Content'
        });

        await contentManager.initialize(mockContentPath);

        const node = contentManager.index[0];
        expect(typeof node.date).toBe('string');
        expect(node.date).toBe(dateObj.toISOString());
    });

    it('should handle missing titles by falling back to filename', async () => {
        mocks.glob.mockResolvedValue(['no-title.md']);
        mocks.matter.mockReturnValue({ data: {}, content: 'Content' });

        await contentManager.initialize(mockContentPath);

        const node = contentManager.index[0];
        expect(node.title).toBe('no-title');
    });

    it('should handle _config.json updates', async () => {
        // Initial state
        mocks.glob.mockResolvedValue([]);

        // Capture handlers
        const handlers = {};
        const mockOn = vi.fn((event, cb) => {
            handlers[event] = cb;
            return { on: mockOn, close: vi.fn() };
        });
        chokidar.watch.mockReturnValue({ on: mockOn, close: vi.fn() });

        await contentManager.initialize(mockContentPath);

        // Mock pathExists to return true for config
        fs.pathExists.mockImplementation(async (p) => p.endsWith('_config.json'));
        fs.readJson.mockResolvedValue({ title: 'New Wiki Title' });

        await handlers['change'](path.join(mockContentPath, '_config.json'));

        expect(contentManager.config.title).toBe('New Wiki Title');
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('content-updated', expect.any(Object));
    });

    it('should handle file addition', async () => {
        // First scan returns empty
        mocks.glob.mockResolvedValueOnce([]);

        const handlers = {};
        const mockOn = vi.fn((event, cb) => {
            handlers[event] = cb;
            return { on: mockOn, close: vi.fn() };
        });
        chokidar.watch.mockReturnValue({ on: mockOn, close: vi.fn() });

        await contentManager.initialize(mockContentPath);

        // Second scan (triggered by add) returns new file
        mocks.glob.mockResolvedValueOnce(['new-note.md']);
        mocks.matter.mockReturnValue({ data: { title: 'New Note' }, content: '' });

        await handlers['add'](path.join(mockContentPath, 'new-note.md'));

        expect(contentManager.index).toHaveLength(1);
        expect(contentManager.index[0].title).toBe('New Note');
    });

    it('should handle file deletion', async () => {
        // First scan returns file
        mocks.glob.mockResolvedValueOnce(['delete-me.md']);
        mocks.matter.mockReturnValue({ data: { title: 'Delete Me' }, content: '' });

        const handlers = {};
        const mockOn = vi.fn((event, cb) => {
            handlers[event] = cb;
            return { on: mockOn, close: vi.fn() };
        });
        chokidar.watch.mockReturnValue({ on: mockOn, close: vi.fn() });

        await contentManager.initialize(mockContentPath);
        expect(contentManager.index).toHaveLength(1);

        // Second scan (triggered by unlink) returns empty
        mocks.glob.mockResolvedValueOnce([]);

        await handlers['unlink'](path.join(mockContentPath, 'delete-me.md'));

        expect(contentManager.index).toHaveLength(0);
    });
});
