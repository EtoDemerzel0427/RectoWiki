import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateContent } from './generate-content.js';
import fs from 'fs-extra';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    glob: vi.fn()
}));

vi.mock('fs-extra');
vi.mock('glob', () => ({
    glob: mocks.glob
}));

describe('generateContent', () => {
    const mockContentDir = '/mock/content';
    const mockOutputFile = '/mock/public/content.json';
    const queueScan = (files = [], directories = []) => {
        mocks.glob.mockResolvedValueOnce(files).mockResolvedValueOnce(directories);
    };

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
        queueScan(['note1.md', 'folder/note2.md']);

        fs.readFileSync.mockReturnValue('---\ntitle: Test Title\n---\nTest Content');

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
        queueScan();

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
        queueScan(['a.md', 'b.md']);
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

    it('should exclude draft pages from the publish artifact by default', async () => {
        queueScan(['published.md', 'draft.md']);
        fs.readFileSync.mockImplementation((filePath) => (
            filePath.endsWith('draft.md')
                ? '---\ntitle: Draft\ndraft: true\n---\nHidden'
                : '---\ntitle: Published\ndraft: false\n---\nVisible'
        ));

        await generateContent(mockContentDir, mockOutputFile);

        const output = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(output.nodes.some(node => node.id === 'draft')).toBe(false);
        expect(output.nodes.some(node => node.id === 'published')).toBe(true);
    });
});
