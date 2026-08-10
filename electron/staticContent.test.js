import { describe, expect, it } from 'vitest';
import { buildStaticArtifacts } from './staticContent.mjs';

describe('static content artifacts', () => {
    it('keeps bodies out of the manifest and emits per-page payloads', () => {
        const { manifest, pages, searchIndex } = buildStaticArtifacts([
            {
                id: 'Folder/Page',
                title: 'Page',
                content: '---\ntitle: Page\n---\nSearchable body',
                isFolder: false,
            },
            { id: 'Folder', title: 'Folder', isFolder: true },
        ], { title: 'Wiki' });

        const pageNode = manifest.nodes.find(node => node.id === 'Folder/Page');
        expect(pageNode.content).toBeUndefined();
        expect(pageNode.pagePath).toMatch(/^content-pages\/[a-f0-9]{20}\.json$/);
        expect(pages).toEqual([{
            pagePath: pageNode.pagePath,
            payload: {
                id: 'Folder/Page',
                content: '---\ntitle: Page\n---\nSearchable body',
            },
        }]);
        expect(searchIndex).toEqual({ 'Folder/Page': 'Searchable body' });
        expect(manifest.config.title).toBe('Wiki');
    });
});
