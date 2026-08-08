import { dump, load } from 'js-yaml';

const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const normalizeYamlValue = (value) => {
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }

    if (Array.isArray(value)) {
        return value.map(normalizeYamlValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, childValue]) => [key, normalizeYamlValue(childValue)])
        );
    }

    return value;
};

export const parseFrontmatter = (content) => {
    if (!content) return { metadata: {}, body: '' };

    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) return { metadata: {}, body: content };

    const parsedMetadata = load(match[1]) || {};
    if (typeof parsedMetadata !== 'object' || Array.isArray(parsedMetadata)) {
        throw new Error('Frontmatter must contain a YAML mapping');
    }

    return {
        metadata: normalizeYamlValue(parsedMetadata),
        body: content.slice(match[0].length),
    };
};

export const stringifyFrontmatter = (metadata, body) => {
    const yaml = dump(normalizeYamlValue(metadata || {}), {
        lineWidth: -1,
        noRefs: true,
        noCompatMode: true,
    }).trimEnd();

    return `---\n${yaml}\n---\n${body || ''}`;
};
