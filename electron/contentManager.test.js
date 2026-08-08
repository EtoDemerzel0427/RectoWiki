import { describe, it, expect, beforeEach, vi } from 'vitest';
import ContentManager from './contentManager.mjs';
import fs from 'fs-extra';
import path from 'path';
import chokidar from 'chokidar';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    glob: vi.fn()
}));

vi.mock('fs-extra');
vi.mock('chokidar');
vi.mock('glob', () => ({
    glob: mocks.glob
}));
vi.mock('electron', () => ({
    app: { isPackaged: false }
}));

describe('ContentManager', () => {
    let contentManager;
    let mockWindow;
    const mockContentPath = '/mock/content';
    const queueScan = (files = [], directories = []) => {
        mocks.glob.mockResolvedValueOnce(files).mockResolvedValueOnce(directories);
    };

    beforeEach(() => {
        mockWindow = {
            webContents: {
                send: vi.fn()
            },
            isDestroyed: () => false
        };
        // Reset mocks
        mocks.glob.mockReset();

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

    it('should initialize and scan content', async () => {
        queueScan(['test.md']);
        fs.readFile.mockResolvedValue('---\ntitle: Test\n---\nContent');

        await contentManager.initialize(mockContentPath);

        expect(contentManager.index).toHaveLength(1);
        expect(contentManager.index[0].title).toBe('Test');
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('content-updated', expect.any(Object));
    });

    it('should sanitize Date objects in frontmatter', async () => {
        queueScan(['date-test.md']);
        fs.readFile.mockResolvedValue('---\ntitle: Date Test\ndate: 2023-01-01\n---\nContent');

        await contentManager.initialize(mockContentPath);

        const node = contentManager.index[0];
        expect(typeof node.date).toBe('string');
        expect(node.date).toBe('2023-01-01');
    });

    it('should handle missing titles by falling back to filename', async () => {
        queueScan(['no-title.md']);
        fs.readFile.mockResolvedValue('Content');

        await contentManager.initialize(mockContentPath);

        const node = contentManager.index[0];
        expect(node.title).toBe('no-title');
    });

    it('should handle _config.json updates', async () => {
        // Initial state
        queueScan();

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
        queueScan();

        await handlers['change'](path.join(mockContentPath, '_config.json'));

        expect(contentManager.config.title).toBe('New Wiki Title');
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('content-updated', expect.any(Object));
    });

    it('should handle file addition', async () => {
        // First scan returns empty
        queueScan();

        const handlers = {};
        const mockOn = vi.fn((event, cb) => {
            handlers[event] = cb;
            return { on: mockOn, close: vi.fn() };
        });
        chokidar.watch.mockReturnValue({ on: mockOn, close: vi.fn() });

        await contentManager.initialize(mockContentPath);

        // Second scan (triggered by add) returns new file
        queueScan(['new-note.md']);
        fs.readFile.mockResolvedValue('---\ntitle: New Note\n---\n');

        await handlers['add'](path.join(mockContentPath, 'new-note.md'));

        expect(contentManager.index).toHaveLength(1);
        expect(contentManager.index[0].title).toBe('New Note');
    });

    it('should handle file deletion', async () => {
        // First scan returns file
        queueScan(['delete-me.md']);
        fs.readFile.mockResolvedValue('---\ntitle: Delete Me\n---\n');

        const handlers = {};
        const mockOn = vi.fn((event, cb) => {
            handlers[event] = cb;
            return { on: mockOn, close: vi.fn() };
        });
        chokidar.watch.mockReturnValue({ on: mockOn, close: vi.fn() });

        await contentManager.initialize(mockContentPath);
        expect(contentManager.index).toHaveLength(1);

        // Second scan (triggered by unlink) returns empty
        queueScan();

        await handlers['unlink'](path.join(mockContentPath, 'delete-me.md'));

        expect(contentManager.index).toHaveLength(0);
    });

    it('does not let frontmatter overwrite structural fields', async () => {
        queueScan(['safe.md']);
        fs.readFile.mockResolvedValue(`---
id: ../outside
filePath: /tmp/outside
isFolder: true
title: Safe title
---
Content`);

        await contentManager.initialize(mockContentPath);

        expect(contentManager.index[0]).toMatchObject({
            id: 'safe',
            filePath: 'content/safe.md',
            isFolder: false,
            title: 'Safe title'
        });
    });
});
