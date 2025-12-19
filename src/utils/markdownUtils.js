/**
 * Strips markdown syntax from a string to return plain text.
 * Optimized for wiki content including standard Markdown and WikiLinks.
 */
export const stripMarkdown = (markdown) => {
    if (!markdown) return '';

    let output = markdown;

    // 1. Remove YAML frontmatter
    output = output.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, '');

    // 2. Remove HTML tags
    output = output.replace(/<[^>]*>/g, '');

    // 3. Remove Images: ![alt](url) -> alt
    output = output.replace(/\!\[(.*?)\]\s*\(.*?\)/g, '$1');

    // 4. Remove Inline Links: [text](url) -> text
    output = output.replace(/\[(.*?)\]\s*\(.*?\)/g, '$1');

    // 5. Remove WikiLinks: [[Title]] or [[Title|Alias]] -> Alias or Title
    output = output.replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, '$2');

    // 6. Remove ATX-style headers: # Header -> Header
    output = output.replace(/^(\s{0,3}\#{1,6}\s*([^#\n]*)\s*(\#{1,6})?)/gm, '$2');

    // 7. Remove Setext-style headers: Header\n=== -> Header
    output = output.replace(/^[=\-]{2,}\s*$/gm, '');

    // 8. Remove Emphasis (Bold/Italic): **text**, *text*, __text__, _text_
    // We run this twice to handle nested styles like ***text***
    output = output.replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2');
    output = output.replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2');

    // 9. Remove Blockquotes: > text -> text
    output = output.replace(/^\s{0,3}>\s?/gm, '');

    // 10. Remove Code blocks: ```js ... ``` -> ...
    output = output.replace(/(`{3,})(.*?)\1/gs, '$2');

    // 11. Remove Inline code: `code` -> code
    output = output.replace(/`(.+?)`/g, '$1');

    // 12. Remove Horizontal rules: ---, ***, ___
    output = output.replace(/^[-\*_]{3,}\s*$/gm, '');

    // 13. Remove List markers: *, -, +, 1.
    output = output.replace(/^[\s]*[\*\-\+]\s+/gm, '');
    output = output.replace(/^[\s]*\d+\.\s+/gm, '');

    // 14. Remove all remaining markdown-style markers that might be cluttering the text
    // Such as remaining *, _, #, etc. at the beginning or end of words
    output = output.replace(/(^|\s)[\*\-_]+(\s|$)/g, '$1$2'); // Remove isolated markers
    output = output.replace(/[\*\-_]/g, ''); // Remove any remaining * or _ characters

    // 15. Cleanup multiple newlines and spaces
    return output
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Extracts a snippet of text around the first occurrence of the query.
 * If query is empty or not found, returns the beginning of the text.
 */
export const getSearchSnippet = (content, query = '', length = 120) => {
    const plainText = stripMarkdown(content);
    if (!query || query.trim() === '') return plainText.substring(0, length) + (plainText.length > length ? '...' : '');

    const index = plainText.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return plainText.substring(0, length) + (plainText.length > length ? '...' : '');

    // Calculate window
    const start = Math.max(0, index - Math.floor(length / 2));
    const end = Math.min(plainText.length, start + length);

    let snippet = plainText.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < plainText.length) snippet = snippet + '...';

    return snippet;
};
