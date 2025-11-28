import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'content.json');

async function generate() {
    const files = await glob('**/*.md', { cwd: CONTENT_DIR });
    const nodes = [];
    const folderSet = new Set();

    // 1. Process files
    files.forEach((file) => {
        const filePath = path.join(CONTENT_DIR, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(source);

        // Normalize ID: replace backslashes, remove extension
        const id = file.replace(/\\/g, '/').replace(/\.md$/, '');
        const segments = id.split('/');

        // Add parent folders to set
        for (let i = 1; i < segments.length; i++) {
            const folderPath = segments.slice(0, i).join('/');
            folderSet.add(folderPath);
        }

        const stats = fs.statSync(filePath);
        const date = data.date ? new Date(data.date).toISOString().split('T')[0] : stats.birthtime.toISOString().split('T')[0];

        nodes.push({
            id,
            title: data.title || path.basename(id),
            category: data.category || segments[0] || 'General',
            tags: data.tags || [],
            date,
            content,
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: false
        });
    });

    // 2. Process folders
    folderSet.forEach(folderId => {
        const segments = folderId.split('/');
        nodes.push({
            id: folderId,
            title: segments[segments.length - 1],
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: true,
            category: segments[0] || 'System',
            children: [] // Will be populated by buildTree in frontend, but good to have structure
        });
    });

    await fs.outputJSON(OUTPUT_FILE, nodes);
    console.log(`✅ Generated content.json with ${nodes.length} nodes.`);
}

generate();