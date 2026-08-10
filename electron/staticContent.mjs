import { createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';

const getPageKey = (id) => createHash('sha256').update(id).digest('hex').slice(0, 20);

const stripFrontmatter = (content = '') => (
    content.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, '')
);

export const buildStaticArtifacts = (nodes, config = {}) => {
    const pages = [];
    const searchIndex = {};

    const manifestNodes = nodes.map((node) => {
        const { content, ...metadata } = node;
        if (node.isFolder) return metadata;

        const pagePath = `content-pages/${getPageKey(node.id)}.json`;
        pages.push({ pagePath, payload: { id: node.id, content: content || '' } });
        searchIndex[node.id] = stripFrontmatter(content || '');
        return { ...metadata, pagePath };
    });

    return {
        manifest: { nodes: manifestNodes, config },
        pages,
        searchIndex,
    };
};
export const writeStaticContent = (outputFile, nodes, config = {}) => {
    const outputDirectory = path.dirname(outputFile);
    const pagesDirectory = path.join(outputDirectory, 'content-pages');
    const { manifest, pages, searchIndex } = buildStaticArtifacts(nodes, config);

    // Clearing the page directory is a privacy boundary: a deleted or newly
    // drafted note must not survive as an orphaned deploy artifact.
    fs.emptyDirSync(pagesDirectory);
    pages.forEach(({ pagePath, payload }) => {
        fs.outputJSONSync(path.join(outputDirectory, pagePath), payload);
    });
    fs.outputJSONSync(path.join(outputDirectory, 'search-index.json'), searchIndex);
    fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));

    return manifest;
};
