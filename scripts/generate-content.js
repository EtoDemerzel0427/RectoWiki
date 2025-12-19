import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

export async function generateContent(customContentDir, customOutputFile) {
    const CONTENT_DIR = customContentDir || path.join(process.cwd(), 'content');
    const OUTPUT_FILE = customOutputFile || path.join(process.cwd(), 'public', 'content.json');

    const files = await glob('**/*.md', { cwd: CONTENT_DIR });
    const dirs = await glob('**/', { cwd: CONTENT_DIR }); // Scan for directories
    const nodes = [];
    const folderSet = new Set();
    const fileMap = new Map(); // Map to store file nodes by ID

    // Add all directories to folderSet
    dirs.forEach(dir => {
        const dirPath = dir.replace(/\\/g, '/').replace(/\/$/, '');
        if (dirPath && dirPath !== '.') folderSet.add(dirPath);
    });

    // 1. Process files
    files.forEach((file) => {
        const filePath = path.join(CONTENT_DIR, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(source);

        // Normalize ID: replace backslashes, remove extension
        const id = file.replace(/\\/g, '/').replace(/\.md$/, '');
        const segments = id.split('/');
        const fileName = segments[segments.length - 1];

        // Add parent folders to set
        for (let i = 1; i < segments.length; i++) {
            const folderPath = segments.slice(0, i).join('/');
            folderSet.add(folderPath);
        }

        const stats = fs.statSync(filePath);
        const date = data.date ? new Date(data.date).toISOString().split('T')[0] : stats.birthtime.toISOString().split('T')[0];

        const node = {
            id,
            title: data.title || fileName,
            slug: data.slug,
            filePath: `content/${file}`, // Relative path for loading content
            category: data.category || segments[0] || 'General',
            tags: data.tags || [],
            date,
            draft: data.draft || false,
            content: source, // Use full source to preserve frontmatter for web parser
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: false,
            fileName: fileName + '.md' // Store actual filename for matching
        };
        nodes.push(node);
        fileMap.set(id, node);
    });

    // 2. Process folders
    const folderNodes = [];
    folderSet.forEach(folderId => {
        const segments = folderId.split('/');
        const folderName = segments[segments.length - 1];
        folderNodes.push({
            id: folderId,
            title: folderName,
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: true,
            category: segments[0] || 'System',
            children: [],
            fileName: folderName // Store folder name for matching
        });
    });
    nodes.push(...folderNodes);

    // 3. Handle _meta.json for sorting
    // Get all unique directory paths (including root)
    const allDirs = new Set(['.']);
    folderSet.forEach(f => allDirs.add(f));

    for (const dir of allDirs) {
        const dirPath = path.join(CONTENT_DIR, dir);
        const metaPath = path.join(dirPath, '_meta.json');
        const draftMetaPath = path.join(dirPath, '_draft_meta.json');

        // Get items in this directory
        const allItemsInDir = nodes.filter(n => {
            if (dir === '.') return n.parentId === null;
            return n.parentId === dir;
        });

        if (allItemsInDir.length === 0) continue;

        const publicNotes = allItemsInDir.filter(n => !n.draft);
        const draftNotes = allItemsInDir.filter(n => n.draft);

        // Helper to sync meta files
        const syncMeta = (notes, filePath, autoCreate = true) => {
            let meta = [];
            let hasChanges = false;
            const exists = fs.existsSync(filePath);

            if (exists) {
                try {
                    meta = fs.readJSONSync(filePath);
                } catch (e) {
                    console.warn(`Failed to read ${filePath}`);
                }
            }

            const currentNames = notes.map(n => (n.fileName || n.title).replace(/\.md$/, ''));

            currentNames.forEach(name => {
                if (!meta.includes(name)) {
                    meta.push(name);
                    hasChanges = true;
                }
            });

            if (hasChanges || (!exists && autoCreate && notes.length > 0)) {
                if (!exists) meta.sort((a, b) => a.localeCompare(b));
                fs.outputJSONSync(filePath, meta, { spaces: 2 });
                console.log(`Updated ${filePath}`);
            }
            return meta;
        };

        // Sync both meta files
        const publicMeta = syncMeta(publicNotes, metaPath, true);
        const draftMeta = syncMeta(draftNotes, draftMetaPath, true);

        // Assign sortIndex to nodes
        allItemsInDir.forEach(node => {
            const simpleName = (node.fileName || node.title).replace(/\.md$/, '');
            if (node.draft) {
                const index = draftMeta.indexOf(simpleName);
                node.sortIndex = index !== -1 ? 10000 + index : 20000;
            } else {
                const index = publicMeta.indexOf(simpleName);
                node.sortIndex = index !== -1 ? index : 9999;
            }
        });
    }

    // Read config
    let config = { title: "RectoWiki" };
    const configPath = path.join(CONTENT_DIR, '_config.json');
    if (fs.existsSync(configPath)) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            config = JSON.parse(configContent);
        } catch (e) {
            console.error("Failed to read config:", e);
        }
    }

    const output = {
        nodes: nodes,
        config: config
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Generated content.json with ${nodes.length} items`);
}

// Check if running directly (ESM)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    generateContent(args[0], args[1]);
}