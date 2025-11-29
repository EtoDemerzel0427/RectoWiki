import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateContent } from './generate-content.js';
import fs from 'fs-extra';
import path from 'path';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    glob: vi.fn(),
    matter: vi.fn()
}));

vi.mock('fs-extra');
vi.mock('glob', () => ({
    glob: mocks.glob
}));
vi.mock('gray-matter', () => ({
    default: mocks.matter
}));

describe('generateContent', () => {
    const mockContentDir = '/mock/content';
    const mockOutputFile = '/mock/public/content.json';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        mocks.glob.mockResolvedValue([]);
        fs.existsSync.mockReturnValue(false);
        fs.statSync.mockReturnValue({ birthtime: new Date('2023-01-01') });
        fs.readFileSync.mockReturnValue('');
        fs.readJSONSync.mockReturnValue([]);
        fs.outputJSONSync.mockReturnValue();
        fs.writeFileSync.mockReturnValue();
    });

    it('should generate content from markdown files', async () => {
        mocks.glob.mockResolvedValue(['note1.md', 'folder/note2.md']);

        // Mock file content
        mocks.matter.mockImplementation((content) => {
            return { data: { title: 'Test Title' }, content: 'Test Content' };
        });

        await generateContent(mockContentDir, mockOutputFile);

        // Verify output
        expect(fs.writeFileSync).toHaveBeenCalled();
        const output = JSON.parse(fs.writeFileSync.mock.calls[0][1]);

        expect(output.nodes).toHaveLength(3); // note1, note2, folder

        const note1 = output.nodes.find(n => n.id === 'note1');
        expect(note1).toBeDefined();
        expect(note1.title).toBe('Test Title');
        expect(note1.isFolder).toBe(false);

        const folder = output.nodes.find(n => n.id === 'folder');
        expect(folder).toBeDefined();
        expect(folder.isFolder).toBe(true);
    });

    it('should read _config.json', async () => {
        mocks.glob.mockResolvedValue([]);

        fs.existsSync.mockImplementation((p) => p.endsWith('_config.json'));
        fs.readFileSync.mockImplementation((p) => {
            if (p.endsWith('_config.json')) return JSON.stringify({ title: 'My Wiki' });
            return '';
        });

        await generateContent(mockContentDir, mockOutputFile);

        const output = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(output.config.title).toBe('My Wiki');
    });

    it('should use _meta.json for sorting', async () => {
        mocks.glob.mockResolvedValue(['a.md', 'b.md']);
        mocks.matter.mockReturnValue({ data: {}, content: '' });

        // Mock _meta.json existence and content
        fs.existsSync.mockImplementation((p) => p.endsWith('_meta.json'));
        fs.readJSONSync.mockImplementation((p) => {
            if (p.endsWith('_meta.json')) return ['b', 'a']; // Reverse order
            return [];
        });

        await generateContent(mockContentDir, mockOutputFile);

        const output = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        const nodeA = output.nodes.find(n => n.id === 'a');
        const nodeB = output.nodes.find(n => n.id === 'b');

        expect(nodeB.sortIndex).toBe(0);
        expect(nodeA.sortIndex).toBe(1);
    });
});
