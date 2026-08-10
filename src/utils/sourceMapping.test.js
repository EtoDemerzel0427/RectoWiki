import { describe, expect, it } from 'vitest';
import { getLineSelection } from './editorState';
import { createMarkdownSourceMap, transformWikiLinks } from './sourceMapping';

describe('transformWikiLinks', () => {
    it('preserves source offsets after wiki-link expansion', () => {
        const source = 'Before [[Target Page]]\n\n## Edit this heading';
        const transformed = transformWikiLinks(source);
        const transformedHeading = transformed.content.indexOf('## Edit this heading');

        expect(transformed.content).toContain('[Target Page](wiki:Target%20Page)');
        expect(transformed.toOriginalOffset(transformedHeading)).toBe(source.indexOf('## Edit this heading'));
    });

    it('maps clicks inside a generated wiki link to the original link', () => {
        const source = 'See [[Target]] now';
        const transformed = transformWikiLinks(source);
        const insideLink = transformed.content.indexOf('wiki:') + 2;

        expect(transformed.toOriginalOffset(insideLink)).toBe(source.indexOf('[[Target]]'));
    });
});

describe('createMarkdownSourceMap', () => {
    it('uses the editor frontmatter parser so preview offsets select the exact source line', () => {
        const content = [
            '---',
            'title: Offset regression',
            'tags: [test]',
            '---',
            '',
            'See [[Another Page]] first.',
            '',
            'This is the paragraph that was previously off by one.',
        ].join('\n');
        const mapped = createMarkdownSourceMap(content);
        const paragraph = 'This is the paragraph that was previously off by one.';
        const renderedOffset = mapped.content.indexOf(paragraph);
        const sourceOffset = mapped.toOriginalOffset(renderedOffset);
        const selection = getLineSelection(mapped.body, sourceOffset);

        expect(mapped.body.startsWith('\nSee [[Another Page]]')).toBe(true);
        expect(sourceOffset).toBe(mapped.body.indexOf(paragraph));
        expect(mapped.body.slice(selection.start, selection.end)).toBe(paragraph);
    });
});
