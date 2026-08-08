import { describe, expect, it } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';

describe('frontmatter utilities', () => {
    it('parses real YAML values without flattening their types', () => {
        const input = `---
title: "A title: with punctuation # intact"
date: 2024-05-06
tags:
  - music theory
  - "hash # tag"
appearance:
  font: serif
summary: |
  first line
  second line
---
Body text
`;

        const { metadata, body } = parseFrontmatter(input);

        expect(metadata).toEqual({
            title: 'A title: with punctuation # intact',
            date: '2024-05-06',
            tags: ['music theory', 'hash # tag'],
            appearance: { font: 'serif' },
            summary: 'first line\nsecond line\n',
        });
        expect(body).toBe('Body text\n');
    });

    it('round-trips punctuation, arrays, nested values, and multiline text', () => {
        const metadata = {
            title: 'Colon: # hash',
            tags: ['one', 'two: three'],
            nested: { enabled: true },
            summary: 'line one\nline two\n',
        };

        const serialized = stringifyFrontmatter(metadata, '# Heading\n');
        const parsed = parseFrontmatter(serialized);

        expect(parsed.metadata).toEqual(metadata);
        expect(parsed.body).toBe('# Heading\n');
    });
});
