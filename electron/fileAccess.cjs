const path = require('path');
const { randomUUID } = require('crypto');
const { promises: fs } = require('fs');

const CONTENT_PREFIX = 'content/';
const DRAFTS_PREFIX = 'drafts/';

function getContentRelativePath(requestPath) {
    if (typeof requestPath !== 'string' || requestPath.includes('\0')) {
        throw new Error('Invalid content path');
    }

    if (requestPath === 'public/content.json') {
        return { relativePath: 'content.json', rootType: 'content' };
    }

    if (!requestPath.startsWith(CONTENT_PREFIX) && !requestPath.startsWith(DRAFTS_PREFIX)) {
        throw new Error('File access is limited to the content or drafts directory');
    }

    const prefix = requestPath.startsWith(DRAFTS_PREFIX) ? DRAFTS_PREFIX : CONTENT_PREFIX;
    const relativePath = requestPath.slice(prefix.length);
    if (!relativePath) {
        throw new Error('The content root cannot be modified directly');
    }

    return {
        relativePath,
        rootType: requestPath.startsWith(DRAFTS_PREFIX) ? 'drafts' : 'content',
    };
}

function resolveContentPath(contentRoot, requestPath) {
    const root = path.resolve(contentRoot);
    const { relativePath, rootType } = getContentRelativePath(requestPath);

    if (path.isAbsolute(relativePath)) {
        throw new Error('Absolute paths are not allowed');
    }

    const allowedRoot = rootType === 'drafts'
        ? path.join(path.dirname(root), '.rectowiki', 'drafts')
        : root;
    const resolvedPath = path.resolve(allowedRoot, relativePath);
    if (!resolvedPath.startsWith(`${path.resolve(allowedRoot)}${path.sep}`)) {
        throw new Error('Path escapes the content directory');
    }

    return resolvedPath;
}

async function atomicWriteFile(filePath, content) {
    const directory = path.dirname(filePath);
    const temporaryPath = path.join(
        directory,
        `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
    );

    await fs.mkdir(directory, { recursive: true });

    try {
        await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
    }
}

async function createFileExclusive(filePath, content = '') {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
}

async function renameExclusive(oldPath, newPath) {
    if (oldPath === newPath) return;

    try {
        await fs.access(newPath);
        const error = new Error(`Destination already exists: ${path.basename(newPath)}`);
        error.code = 'EEXIST';
        throw error;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    await fs.rename(oldPath, newPath);
}

async function publishDraftFile(contentRoot, draftPath, content) {
    if (typeof draftPath !== 'string' || !draftPath.startsWith('drafts/')) {
        throw new Error('Only local drafts can be published');
    }

    const relativePath = draftPath.slice('drafts/'.length);
    if (!relativePath || relativePath.split('/').includes('..')) {
        throw new Error('Invalid draft path');
    }

    const sourcePath = resolveContentPath(contentRoot, draftPath);
    const targetPath = resolveContentPath(contentRoot, `content/${relativePath}`);
    await atomicWriteFile(targetPath, content);
    await fs.rm(sourcePath, { force: false });
    return `content/${relativePath}`;
}

module.exports = {
    atomicWriteFile,
    createFileExclusive,
    renameExclusive,
    publishDraftFile,
    resolveContentPath,
};
