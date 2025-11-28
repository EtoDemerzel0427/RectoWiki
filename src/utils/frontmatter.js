export const parseFrontmatter = (content) => {
    if (!content) return { metadata: {}, body: '' };

    // Regex to match frontmatter:
    // ^\s* matches optional leading whitespace/BOM
    // --- matches start delimiter
    // \s*[\r\n]+ matches newline after delimiter
    // ([\s\S]*?) matches the YAML content (lazy)
    // [\r\n]+--- matches end delimiter
    // \s*[\r\n]* matches optional whitespace/newline after end delimiter
    // ([\s\S]*)$ matches the body
    const frontmatterRegex = /^\s*---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
        const yaml = match[1];
        const body = match[2];

        const metadata = {};
        yaml.split('\n').forEach(line => {
            // Handle "key: value"
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const key = line.slice(0, colonIndex).trim();
                let value = line.slice(colonIndex + 1).trim();

                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                // Handle array [a, b]
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1);
                    // Split by comma, but be careful with quoted strings inside (simplified for now)
                    value = value.split(',').map(v => v.trim()).join(', ');
                }

                if (key) {
                    metadata[key] = value;
                }
            }
        });

        return { metadata, body };
    }

    // If no frontmatter found, return empty metadata and full content as body
    return { metadata: {}, body: content };
};

export const stringifyFrontmatter = (metadata, body) => {
    const tagsArray = metadata.tags ? metadata.tags.split(',').map(t => t.trim()).filter(t => t) : [];

    const yamlLines = [
        '---',
        `title: ${metadata.title || ''}`,
        `date: ${metadata.date || new Date().toISOString().split('T')[0]}`,
        `tags: [${tagsArray.join(', ')}]`,
        `category: ${metadata.category || ''}`,
        '---'
    ];

    return `${yamlLines.join('\n')}\n\n${body || ''}`;
};
