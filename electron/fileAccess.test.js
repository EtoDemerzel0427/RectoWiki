import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fileAccess from './fileAccess.cjs';

const {
    atomicWriteFile,
    createFileExclusive,
    listTrashItems,
    moveToTrash,
    publishDraftFile,
    renameExclusive,
    restoreTrashItem,
    resolveContentPath,
} = fileAccess;

const temporaryDirectories = [];

const createTemporaryDirectory = async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'rectowiki-file-access-'));
    const contentDirectory = path.join(workspace, 'content');
    await fs.mkdir(contentDirectory);
    temporaryDirectories.push(workspace);
    return contentDirectory;
};

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => (
        fs.rm(directory, { recursive: true, force: true })
    )));
});

describe('file access boundary', () => {
    it('resolves normal content paths inside the configured root', async () => {
        const root = await createTemporaryDirectory();
        expect(resolveContentPath(root, 'content/folder/note.md')).toBe(
            path.join(root, 'folder', 'note.md')
        );
    });

    it('resolves local drafts beside the configured content root', async () => {
        const root = await createTemporaryDirectory();
        expect(resolveContentPath(root, 'drafts/folder/note.md')).toBe(
            path.join(path.dirname(root), '.rectowiki', 'drafts', 'folder', 'note.md')
        );
    });

    it.each([
        '../outside.md',
        'content/../outside.md',
        'content/',
        '/tmp/outside.md',
        'settings.json',
    ])('rejects unsafe request path %s', async (requestPath) => {
        const root = await createTemporaryDirectory();
        expect(() => resolveContentPath(root, requestPath)).toThrow();
    });

    it('creates files exclusively instead of overwriting them', async () => {
        const root = await createTemporaryDirectory();
        const target = path.join(root, 'note.md');

        await createFileExclusive(target, 'first');
        await expect(createFileExclusive(target, 'second')).rejects.toMatchObject({ code: 'EEXIST' });
        await expect(fs.readFile(target, 'utf8')).resolves.toBe('first');
    });

    it('atomically replaces an existing file', async () => {
        const root = await createTemporaryDirectory();
        const target = path.join(root, 'note.md');
        await fs.writeFile(target, 'old');

        await atomicWriteFile(target, 'new');

        await expect(fs.readFile(target, 'utf8')).resolves.toBe('new');
        await expect(fs.readdir(root)).resolves.toEqual(['note.md']);
    });

    it('publishes a draft into content and removes the local source', async () => {
        const root = await createTemporaryDirectory();
        const draft = resolveContentPath(root, 'drafts/folder/note.md');
        await fs.mkdir(path.dirname(draft), { recursive: true });
        await fs.writeFile(draft, 'draft');

        await expect(publishDraftFile(root, 'drafts/folder/note.md', 'published')).resolves.toBe(
            'content/folder/note.md'
        );
        await expect(fs.readFile(path.join(root, 'folder', 'note.md'), 'utf8')).resolves.toBe('published');
        await expect(fs.access(draft)).rejects.toThrow();
    });

    it('refuses to rename over an existing destination', async () => {
        const root = await createTemporaryDirectory();
        const source = path.join(root, 'source.md');
        const destination = path.join(root, 'destination.md');
        await fs.writeFile(source, 'source');
        await fs.writeFile(destination, 'destination');

        await expect(renameExclusive(source, destination)).rejects.toMatchObject({ code: 'EEXIST' });
        await expect(fs.readFile(source, 'utf8')).resolves.toBe('source');
        await expect(fs.readFile(destination, 'utf8')).resolves.toBe('destination');
    });

    it('moves a note to recoverable trash and restores it to its original path', async () => {
        const root = await createTemporaryDirectory();
        const source = path.join(root, 'folder', 'note.md');
        await fs.mkdir(path.dirname(source), { recursive: true });
        await fs.writeFile(source, 'recover me');

        const entry = await moveToTrash(root, 'content/folder/note.md', {
            title: 'Recoverable note',
            parentId: 'folder',
        });

        await expect(fs.access(source)).rejects.toThrow();
        await expect(listTrashItems(root)).resolves.toEqual([expect.objectContaining({
            id: entry.id,
            originalPath: 'content/folder/note.md',
            title: 'Recoverable note',
        })]);

        await expect(restoreTrashItem(root, entry.id)).resolves.toMatchObject({ id: entry.id });
        await expect(fs.readFile(source, 'utf8')).resolves.toBe('recover me');
        await expect(listTrashItems(root)).resolves.toEqual([]);
    });

    it('does not overwrite an existing file when restoring from trash', async () => {
        const root = await createTemporaryDirectory();
        const source = path.join(root, 'note.md');
        await fs.writeFile(source, 'original');
        const entry = await moveToTrash(root, 'content/note.md');
        await fs.writeFile(source, 'replacement');

        await expect(restoreTrashItem(root, entry.id)).rejects.toMatchObject({ code: 'EEXIST' });
        await expect(fs.readFile(source, 'utf8')).resolves.toBe('replacement');
        await expect(listTrashItems(root)).resolves.toHaveLength(1);
    });
});
