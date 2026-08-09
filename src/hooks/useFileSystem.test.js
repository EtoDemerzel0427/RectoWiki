import { describe, expect, it } from 'vitest';
import { sharesOrderingMetadata } from './useFileSystem.js';

describe('sharesOrderingMetadata', () => {
    const published = {
        id: 'Published Page',
        parentId: null,
        sourceRoot: 'content',
        draft: false,
    };
    const localDraft = {
        id: 'Sandbox Draft',
        parentId: null,
        sourceRoot: 'drafts',
        draft: true,
    };

    it('keeps published content out of local draft reorder metadata', () => {
        expect(sharesOrderingMetadata(published, localDraft)).toBe(false);
        expect(sharesOrderingMetadata(localDraft, localDraft)).toBe(true);
    });

    it('keeps legacy repository drafts separate from published ordering', () => {
        const repositoryDraft = {
            ...localDraft,
            sourceRoot: 'content',
        };

        expect(sharesOrderingMetadata(repositoryDraft, published)).toBe(false);
        expect(sharesOrderingMetadata(repositoryDraft, repositoryDraft)).toBe(true);
    });

    it('requires the same parent directory', () => {
        expect(sharesOrderingMetadata(
            { ...localDraft, parentId: 'Nested' },
            localDraft,
        )).toBe(false);
    });
});
