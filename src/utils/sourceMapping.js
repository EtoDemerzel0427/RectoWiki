import { parseFrontmatter } from './frontmatter';

export const transformWikiLinks = (source = '') => {
    const replacements = [];
    let transformed = '';
    let cursor = 0;
    const pattern = /\[\[(.*?)\]\]/g;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        transformed += source.slice(cursor, match.index);
        const replacement = `[${match[1]}](wiki:${encodeURIComponent(match[1])})`;
        const transformedStart = transformed.length;
        transformed += replacement;
        replacements.push({
            transformedStart,
            transformedEnd: transformed.length,
            originalStart: match.index,
            originalEnd: match.index + match[0].length,
        });
        cursor = match.index + match[0].length;
    }

    transformed += source.slice(cursor);

    const toOriginalOffset = (offset) => {
        let delta = 0;
        for (const replacement of replacements) {
            if (offset < replacement.transformedStart) return offset + delta;
            if (offset < replacement.transformedEnd) return replacement.originalStart;
            delta += (replacement.originalEnd - replacement.originalStart)
                - (replacement.transformedEnd - replacement.transformedStart);
        }
        return offset + delta;
    };

    return { content: transformed, toOriginalOffset };
};

export const createMarkdownSourceMap = (content = '') => {
    const { body } = parseFrontmatter(content);
    return { body, ...transformWikiLinks(body) };
};
