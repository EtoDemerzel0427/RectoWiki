#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import console from 'node:console';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const REQUIRED_FIELDS = ['title', 'slug', 'date', 'tags', 'category'];

function usage() {
    return `Manage RectoWiki notes through local drafts.

Usage:
  wiki-note.mjs create --content DIR --path PATH --title TITLE [options]
  wiki-note.mjs checkout --content DIR --path PATH
  wiki-note.mjs validate --content DIR [--path PATH]
  wiki-note.mjs publish --content DIR --path PATH

Create options:
  --slug SLUG       Stable lowercase ASCII slug
  --date YYYY-MM-DD Creation date (defaults to local current date)
  --category NAME   Category (defaults to the first path segment)
  --tag TAG         Tag to add; repeat for multiple tags
`;
}

function parseArgs(argv) {
    const [command, ...tokens] = argv;
    const args = { command, tags: [] };

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token === '--help' || token === '-h') {
            args.help = true;
            continue;
        }
        if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
        const key = token.slice(2);
        const value = tokens[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
        index += 1;
        if (key === 'tag') args.tags.push(value);
        else args[key] = value;
    }

    return args;
}

function requireOption(args, name) {
    if (!args[name]) throw new Error(`Missing required option: --${name}`);
    return args[name];
}

function normalizeRelativePagePath(value) {
    if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid page path');
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
    if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
        throw new Error('Page path must be relative to the content directory');
    }
    const withExtension = normalized.toLowerCase().endsWith('.md') ? normalized : `${normalized}.md`;
    const segments = withExtension.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error('Page path may not be empty or contain traversal segments');
    }
    return segments.join('/');
}

async function assertContentDirectory(contentDirectory) {
    const resolved = path.resolve(contentDirectory);
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats?.isDirectory()) throw new Error(`Content directory does not exist: ${resolved}`);
    const hasMarker = await Promise.all(['_config.json', '_meta.json'].map(async (name) => {
        try {
            await fs.access(path.join(resolved, name));
            return true;
        } catch {
            return false;
        }
    }));
    if (!hasMarker.some(Boolean)) {
        throw new Error('Content directory must contain _config.json or _meta.json');
    }
    return resolved;
}

function getPaths(contentDirectory, relativePath) {
    const draftsDirectory = path.join(path.dirname(contentDirectory), '.rectowiki', 'drafts');
    const segments = relativePath.split('/');
    return {
        contentDirectory,
        draftsDirectory,
        publishedPath: path.join(contentDirectory, ...segments),
        draftPath: path.join(draftsDirectory, ...segments),
        publishedMetaPath: path.join(contentDirectory, ...segments.slice(0, -1), '_meta.json'),
        draftMetaPath: path.join(draftsDirectory, ...segments.slice(0, -1), '_meta.json'),
        basename: path.basename(relativePath, '.md'),
    };
}

function splitFrontmatter(content) {
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) return null;
    return { yaml: match[1], body: content.slice(match[0].length) };
}

function getTopLevelFields(yaml) {
    const fields = new Map();
    const duplicates = [];
    const lines = yaml.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const match = lines[index].match(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$/);
        if (!match) continue;
        const [, key, rawValue = ''] = match;
        if (fields.has(key)) duplicates.push(key);
        else fields.set(key, { rawValue, line: index });
    }
    return { fields, duplicates, lines };
}

function parseYamlScalar(rawValue) {
    const value = rawValue.trim();
    if (value.startsWith('"')) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replaceAll("''", "'");
    }
    return value;
}

function setTopLevelScalar(content, key, value) {
    const parsed = splitFrontmatter(content);
    if (!parsed) throw new Error('Page must contain YAML frontmatter');
    const { fields, duplicates, lines } = getTopLevelFields(parsed.yaml);
    if (duplicates.includes(key)) throw new Error(`Duplicate frontmatter field: ${key}`);
    const replacement = `${key}: ${value}`;
    if (fields.has(key)) lines[fields.get(key).line] = replacement;
    else lines.push(replacement);
    return `---\n${lines.join('\n')}\n---\n${parsed.body}`;
}

function hasBlockSequence(lines, field) {
    if (!field || field.rawValue.trim()) return false;
    for (let index = field.line + 1; index < lines.length; index += 1) {
        if (/^[A-Za-z][A-Za-z0-9_-]*:/.test(lines[index])) break;
        if (/^[ \t]+-[ \t]+\S/.test(lines[index])) return true;
        if (lines[index].trim() && !/^[ \t]/.test(lines[index])) break;
    }
    return false;
}

function quoted(value) {
    return JSON.stringify(String(value));
}

function localDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createSlug(title) {
    const normalized = title.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (normalized) return normalized;
    return `note-${createHash('sha256').update(title).digest('hex').slice(0, 8)}`;
}

function createPageContent({ title, slug, date, tags, category }) {
    return [
        '---',
        `title: ${quoted(title)}`,
        `slug: ${quoted(slug)}`,
        `date: ${quoted(date)}`,
        `tags: [${tags.map(quoted).join(', ')}]`,
        `category: ${quoted(category)}`,
        'draft: true',
        '---',
        '',
    ].join('\n');
}

async function atomicWrite(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = path.join(
        path.dirname(filePath),
        `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    try {
        await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
    }
}

async function createExclusive(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
}

async function readMeta(metaPath) {
    try {
        const value = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
            throw new Error('ordering metadata must be an array of strings');
        }
        return value;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw new Error(`Invalid ${metaPath}: ${error.message}`);
    }
}

async function addToMeta(metaPath, basename) {
    const meta = await readMeta(metaPath);
    if (!meta.includes(basename)) {
        meta.push(basename);
        await atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    }
}

async function removeFromMeta(metaPath, basename) {
    const meta = await readMeta(metaPath);
    const next = meta.filter((item) => item !== basename);
    if (next.length !== meta.length) {
        await atomicWrite(metaPath, `${JSON.stringify(next, null, 2)}\n`);
    }
}

function validateContent(content, relativePath, expectedDraft) {
    const errors = [];
    const warnings = [];
    const parsed = splitFrontmatter(content);
    if (!parsed) return { errors: ['missing YAML frontmatter'], warnings };

    const { fields, duplicates, lines } = getTopLevelFields(parsed.yaml);
    for (const key of duplicates) errors.push(`duplicate frontmatter field: ${key}`);
    for (const key of REQUIRED_FIELDS) {
        const field = fields.get(key);
        const hasValue = field?.rawValue.trim() || (key === 'tags' && hasBlockSequence(lines, field));
        if (!field || !hasValue) errors.push(`missing or empty ${key}`);
    }

    const title = parseYamlScalar(fields.get('title')?.rawValue || '');
    const slug = parseYamlScalar(fields.get('slug')?.rawValue || '');
    const date = parseYamlScalar(fields.get('date')?.rawValue || '');
    const category = parseYamlScalar(fields.get('category')?.rawValue || '');
    const tags = fields.get('tags')?.rawValue.trim() || '';
    const draft = fields.get('draft')?.rawValue.trim();

    if (typeof title !== 'string' || !title.trim()) errors.push('title must be a non-empty string');
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        errors.push('slug must contain lowercase ASCII words separated by single hyphens');
    }
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (typeof date !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || Number.isNaN(parsedDate.valueOf())
        || parsedDate.toISOString().slice(0, 10) !== date) {
        errors.push('date must use YYYY-MM-DD');
    }
    if (typeof category !== 'string' || !category.trim()) errors.push('category must be a non-empty string');
    if (!(tags.startsWith('[') && tags.endsWith(']')) && !hasBlockSequence(lines, fields.get('tags'))) {
        errors.push('tags must be a YAML array');
    }
    if (expectedDraft === true && draft !== 'true') errors.push('local draft must set draft: true');
    if (expectedDraft === false && draft === 'true') warnings.push('published page has draft: true and will be excluded from static output');
    if (expectedDraft === false && draft === undefined) warnings.push('published page omits draft; it is treated as false');

    const firstSegment = relativePath.split('/')[0];
    const expectedCategory = relativePath.includes('/') ? firstSegment : 'General';
    if (category && category !== expectedCategory) {
        warnings.push(`category ${quoted(category)} differs from path-derived ${quoted(expectedCategory)}`);
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

async function walkMarkdown(root) {
    const pages = [];
    async function visit(directory, prefix = '') {
        let entries;
        try {
            entries = await fs.readdir(directory, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }
        for (const entry of entries) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) await visit(absolute, relative);
            else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) pages.push({ absolute, relative });
        }
    }
    await visit(root);
    return pages;
}

async function runCreate(args, contentDirectory, relativePath) {
    const title = requireOption(args, 'title').trim();
    if (!title) throw new Error('--title may not be empty');
    const paths = getPaths(contentDirectory, relativePath);
    const existing = await Promise.all([paths.publishedPath, paths.draftPath].map(async (filePath) => {
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            return null;
        }
    }));
    if (existing.some(Boolean)) throw new Error(`Page already exists: ${relativePath}`);

    const category = args.category || (relativePath.includes('/') ? relativePath.split('/')[0] : 'General');
    const content = createPageContent({
        title,
        slug: args.slug || createSlug(title),
        date: args.date || localDate(),
        tags: args.tags,
        category,
    });
    const result = validateContent(content, relativePath, true);
    if (result.errors.length) throw new Error(`Invalid new page: ${result.errors.join('; ')}`);
    await createExclusive(paths.draftPath, content);
    await addToMeta(paths.draftMetaPath, paths.basename);
    console.log(`Created local draft: ${paths.draftPath}`);
}

async function runCheckout(contentDirectory, relativePath) {
    const paths = getPaths(contentDirectory, relativePath);
    const source = await fs.readFile(paths.publishedPath, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') throw new Error(`Published page does not exist: ${relativePath}`);
        throw error;
    });
    try {
        await fs.access(paths.draftPath);
        throw new Error(`Local draft already exists: ${relativePath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    const draft = setTopLevelScalar(source, 'draft', 'true');
    await createExclusive(paths.draftPath, draft);
    await addToMeta(paths.draftMetaPath, paths.basename);
    console.log(`Checked out local overlay draft: ${paths.draftPath}`);
}

function printValidation(label, result) {
    for (const warning of result.warnings) console.log(`WARN  ${label}: ${warning}`);
    for (const error of result.errors) console.log(`ERROR ${label}: ${error}`);
    if (!result.warnings.length && !result.errors.length) console.log(`OK    ${label}`);
}

async function validateOne(absolute, relative, expectedDraft) {
    const result = validateContent(await fs.readFile(absolute, 'utf8'), relative, expectedDraft);
    printValidation(relative, result);
    return result.errors.length;
}

async function runValidate(contentDirectory, relativePath) {
    const draftsDirectory = path.join(path.dirname(contentDirectory), '.rectowiki', 'drafts');
    let errorCount = 0;
    if (relativePath) {
        const paths = getPaths(contentDirectory, relativePath);
        try {
            await fs.access(paths.draftPath);
            errorCount += await validateOne(paths.draftPath, relativePath, true);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            errorCount += await validateOne(paths.publishedPath, relativePath, false);
        }
    } else {
        for (const page of await walkMarkdown(contentDirectory)) {
            errorCount += await validateOne(page.absolute, page.relative, false);
        }
        for (const page of await walkMarkdown(draftsDirectory)) {
            errorCount += await validateOne(page.absolute, page.relative, true);
        }
    }
    if (errorCount) throw new Error(`Validation failed with ${errorCount} error(s)`);
}

async function runPublish(contentDirectory, relativePath) {
    const paths = getPaths(contentDirectory, relativePath);
    const draft = await fs.readFile(paths.draftPath, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') throw new Error(`Local draft does not exist: ${relativePath}`);
        throw error;
    });
    const validation = validateContent(draft, relativePath, true);
    printValidation(relativePath, validation);
    if (validation.errors.length) throw new Error('Refusing to publish an invalid draft');

    const published = setTopLevelScalar(draft, 'draft', 'false');
    await atomicWrite(paths.publishedPath, published);
    await addToMeta(paths.publishedMetaPath, paths.basename);
    await removeFromMeta(paths.draftMetaPath, paths.basename);
    await fs.rm(paths.draftPath);
    console.log(`Published page: ${paths.publishedPath}`);
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (!args.command || args.help) {
        console.log(usage());
        return;
    }
    if (!['create', 'checkout', 'validate', 'publish'].includes(args.command)) {
        throw new Error(`Unknown command: ${args.command}`);
    }
    const contentDirectory = await assertContentDirectory(requireOption(args, 'content'));
    const relativePath = args.path ? normalizeRelativePagePath(args.path) : null;
    if (args.command !== 'validate' && !relativePath) throw new Error('Missing required option: --path');

    if (args.command === 'create') await runCreate(args, contentDirectory, relativePath);
    if (args.command === 'checkout') await runCheckout(contentDirectory, relativePath);
    if (args.command === 'validate') await runValidate(contentDirectory, relativePath);
    if (args.command === 'publish') await runPublish(contentDirectory, relativePath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    });
}
