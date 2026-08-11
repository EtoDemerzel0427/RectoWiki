#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import console from 'node:console';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'wiki-note.mjs');
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'rectowiki-skill-'));
const contentDirectory = path.join(sandbox, 'content');

function run(...args) {
    return execFileSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
}

try {
    await fs.mkdir(path.join(contentDirectory, 'Dev'), { recursive: true });
    await fs.writeFile(path.join(contentDirectory, '_config.json'), '{"title":"Test Wiki"}\n');
    await fs.writeFile(path.join(contentDirectory, '_meta.json'), '["Dev"]\n');
    await fs.writeFile(path.join(contentDirectory, 'Dev', '_meta.json'), '["Existing"]\n');
    const original = [
        '---',
        'title: "Existing"',
        'slug: "existing"',
        'date: "2026-08-01"',
        'tags:',
        '  - "test"',
        'category: "Dev"',
        'fontTheme: theme-ink',
        'draft: false',
        '---',
        'Original body',
        '',
    ].join('\n');
    await fs.writeFile(path.join(contentDirectory, 'Dev', 'Existing.md'), original);

    run('create', '--content', contentDirectory, '--path', 'Dev/中文页面.md', '--title', '中文页面', '--tag', 'test');
    const createdPath = path.join(sandbox, '.rectowiki', 'drafts', 'Dev', '中文页面.md');
    const created = await fs.readFile(createdPath, 'utf8');
    assert.match(created, /slug: "note-[0-9a-f]{8}"/);
    assert.match(created, /draft: true/);
    assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(sandbox, '.rectowiki', 'drafts', 'Dev', '_meta.json'), 'utf8')),
        ['中文页面'],
    );

    run('checkout', '--content', contentDirectory, '--path', 'Dev/Existing.md');
    const overlayPath = path.join(sandbox, '.rectowiki', 'drafts', 'Dev', 'Existing.md');
    let overlay = await fs.readFile(overlayPath, 'utf8');
    assert.match(overlay, /fontTheme: theme-ink/);
    assert.match(overlay, /draft: true/);
    assert.equal(await fs.readFile(path.join(contentDirectory, 'Dev', 'Existing.md'), 'utf8'), original);

    overlay = overlay.replace('Original body', 'AI-revised body');
    await fs.writeFile(overlayPath, overlay);
    run('validate', '--content', contentDirectory, '--path', 'Dev/Existing.md');
    run('publish', '--content', contentDirectory, '--path', 'Dev/Existing.md');

    const published = await fs.readFile(path.join(contentDirectory, 'Dev', 'Existing.md'), 'utf8');
    assert.match(published, /AI-revised body/);
    assert.match(published, /fontTheme: theme-ink/);
    assert.match(published, /draft: false/);
    await assert.rejects(fs.access(overlayPath));
    assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(sandbox, '.rectowiki', 'drafts', 'Dev', '_meta.json'), 'utf8')),
        ['中文页面'],
    );

    const invalid = spawnSync(process.execPath, [
        scriptPath,
        'create',
        '--content', contentDirectory,
        '--path', '../escape.md',
        '--title', 'Escape',
    ], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /traversal segments/);

    console.log('All manage-rectowiki CLI tests passed.');
} finally {
    await fs.rm(sandbox, { recursive: true, force: true });
}
