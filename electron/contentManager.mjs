import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { glob } from 'glob';
import { app } from 'electron';
import { parseFrontmatter } from './frontmatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ContentManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.contentPath = null;
        this.draftsPath = null;
        this.index = [];
        this.watcher = null;
        this.config = {};
        this.isDev = !app.isPackaged;
    }

    async initialize(contentPath) {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }

        this.contentPath = contentPath;
        this.draftsPath = path.join(path.dirname(contentPath), '.rectowiki', 'drafts');
        console.log(`[ContentManager] Initializing with path: ${this.contentPath}`);

        // Reset state to prevent pollution from previous content location
        this.config = {};
        this.index = [];

        // 1. Initial Scan
        await this.scan();

        // 2. Start Watcher
        this.startWatcher();

        // 3. Sync for Dev (Optional)
        if (this.isDev) {
            await this.syncToPublic();
        }
    }

    async scan() {
        console.log('[ContentManager] Scanning content...');
        try {
            // Read config
            const configPath = path.join(this.contentPath, '_config.json');
            if (await fs.pathExists(configPath)) {
                try {
                    this.config = await fs.readJson(configPath);
                } catch (e) {
                    console.error('[ContentManager] Failed to read _config.json:', e);
                }
            } else {
                // Reset config if file doesn't exist (important for switching to empty folders)
                this.config = {};
            }

            const nodeMap = new Map();
            const folderMap = new Map();
            const sources = [
                { root: this.contentPath, prefix: 'content', isDraftSource: false, exists: true },
                { root: this.draftsPath, prefix: 'drafts', isDraftSource: true, exists: await fs.pathExists(this.draftsPath) },
            ];

            for (const source of sources) {
                if (!source.exists) continue;

                const files = await glob('**/*.md', { cwd: source.root, ignore: 'node_modules/**' });
                const dirs = await glob('**/', { cwd: source.root, ignore: 'node_modules/**' });

                for (const dir of dirs) {
                    const dirPath = dir.replace(/\\/g, '/').replace(/\/$/, '');
                    if (!dirPath || dirPath === '.') continue;
                    const parts = dirPath.split('/');
                    const parentId = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
                    const existing = folderMap.get(dirPath);
                    if (!existing || source.isDraftSource) {
                        folderMap.set(dirPath, {
                            id: dirPath,
                            title: parts[parts.length - 1],
                            isFolder: true,
                            parentId,
                            sortIndex: 999,
                            children: [],
                            fileName: parts[parts.length - 1],
                            sourceRoot: existing?.sourceRoot || source.prefix,
                        });
                    }
                }

                for (const file of files) {
                    const relativePath = file.replace(/\\/g, '/');
                    const fullPath = path.join(source.root, relativePath);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const { metadata: data } = parseFrontmatter(content);
                    const safeData = {};
                    for (const key in data) {
                        const value = data[key];
                        safeData[key] = value instanceof Date
                            ? value.toISOString().split('T')[0]
                            : value;
                    }

                    const pathParts = relativePath.split('/');
                    const fileName = pathParts.pop();
                    const dirPath = pathParts.join('/');
                    const basename = fileName.replace(/\.md$/, '');
                    const id = dirPath ? `${dirPath}/${basename}` : basename;
                    const node = {
                        ...safeData,
                        id,
                        title: String(safeData.title || basename),
                        isFolder: false,
                        parentId: dirPath || null,
                        slug: safeData.slug || id,
                        sortIndex: safeData.sortIndex || 999,
                        fileName,
                        filePath: `${source.prefix}/${relativePath}`,
                        sourceRoot: source.prefix,
                        draft: source.isDraftSource ? true : Boolean(safeData.draft),
                        content,
                    };

                    // A local draft overlays the published note with the same relative path.
                    nodeMap.set(id, node);

                    let currentDir = '';
                    for (const part of pathParts) {
                        const parentDir = currentDir;
                        currentDir = currentDir ? `${currentDir}/${part}` : part;
                        const existing = folderMap.get(currentDir);
                        if (!existing || source.isDraftSource) {
                            folderMap.set(currentDir, {
                                id: currentDir,
                                title: part,
                                isFolder: true,
                                parentId: parentDir || null,
                                sortIndex: 999,
                                children: [],
                                fileName: part,
                                sourceRoot: existing?.sourceRoot || source.prefix,
                            });
                        }
                    }
                }
            }

            const nodes = [...nodeMap.values(), ...folderMap.values()];
            const nodesByParent = {};
            nodes.forEach(node => {
                const parentId = node.parentId || 'root';
                if (!nodesByParent[parentId]) nodesByParent[parentId] = [];
                nodesByParent[parentId].push(node);
            });

            for (const [parentId, groupNodes] of Object.entries(nodesByParent)) {
                for (const node of groupNodes) {
                    const base = node.sourceRoot === 'drafts' ? this.draftsPath : this.contentPath;
                    const nodeDir = parentId === 'root' ? base : path.join(base, parentId);
                    const primaryMetaPath = path.join(nodeDir, '_meta.json');
                    const legacyDraftMetaPath = path.join(nodeDir, '_draft_meta.json');
                    let metaPath = primaryMetaPath;
                    if (node.sourceRoot !== 'drafts' && node.draft && !(await fs.pathExists(primaryMetaPath))) {
                        metaPath = legacyDraftMetaPath;
                    }

                    if (await fs.pathExists(metaPath)) {
                        try {
                            const meta = await fs.readJson(metaPath);
                            if (Array.isArray(meta)) {
                                const simpleName = (node.fileName || node.title).replace(/\.md$/, '');
                                const index = meta.indexOf(simpleName);
                                node.sortIndex = index !== -1
                                    ? index + (node.draft ? 10000 : 0)
                                    : (node.draft ? 19999 : 9999);
                            }
                        } catch (e) {
                            console.error(`[ContentManager] Failed to read meta for ${parentId}:`, e);
                        }
                    } else if (node.draft) {
                        node.sortIndex = 19999;
                    }
                }
            }

            this.index = nodes;
            this.notifyFrontend();

            if (this.isDev) {
                await this.syncToPublic();
            }

        } catch (error) {
            console.error('[ContentManager] Scan failed:', error);
        }
    }

    startWatcher() {
        console.log('[ContentManager] Starting watcher...');
        this.watcher = chokidar.watch([this.contentPath, this.draftsPath], {
            ignored: /(^|[/\\])node_modules([/\\])/, // ignore dependencies, but watch .rectowiki/drafts
            persistent: true,
            ignoreInitial: true
        });

        this.watcher
            .on('add', async changedPath => { console.log(`File ${changedPath} has been added`); await this.scan(); })
            .on('change', async changedPath => { console.log(`File ${changedPath} has been changed`); await this.scan(); })
            .on('unlink', async changedPath => { console.log(`File ${changedPath} has been removed`); await this.scan(); })
            .on('addDir', async changedPath => { console.log(`Directory ${changedPath} has been added`); await this.scan(); })
            .on('unlinkDir', async changedPath => { console.log(`Directory ${changedPath} has been removed`); await this.scan(); });
    }

    notifyFrontend() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log('[ContentManager] Sending update to frontend');
            this.mainWindow.webContents.send('content-updated', {
                nodes: this.index,
                config: this.config || {}
            });
        }
    }

    async syncToPublic() {
        // Write content.json to public/ for Dev Server
        const publicPath = path.join(process.cwd(), 'public', 'content.json');
        const output = {
            config: this.config,
            // The dev server is still a web surface. Never expose local drafts
            // through its generated JSON, even when Electron is watching a
            // content folder that contains private drafts.
            nodes: this.index.filter(node => !node.draft)
        };
        try {
            await fs.writeJson(publicPath, output, { spaces: 2 });
            console.log('[ContentManager] Synced to public/content.json');
        } catch (e) {
            console.error('[ContentManager] Failed to sync public:', e);
        }
    }

    getContent() {
        return {
            nodes: this.index,
            config: this.config
        };
    }

    async dispose() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}

export default ContentManager;
