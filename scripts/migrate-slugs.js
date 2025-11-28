import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const CONTENT_DIR = path.join(process.cwd(), 'content');

async function migrateSlugs() {
    console.log('Starting slug migration and repair...');
    const files = await glob('**/*.md', { cwd: CONTENT_DIR });

    for (const file of files) {
        const filePath = path.join(CONTENT_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        // REPAIR: Fix "key: value---" issue (missing newline before closing delimiter)
        // We look for '---' that is NOT at the start of the string, and NOT preceded by a newline.
        // This regex matches any character that is not a newline, followed immediately by ---
        if (/[^\n]---/.test(content)) {
            content = content.replace(/([^\n])---/g, '$1\n---');
            console.log(`Repaired formatting in ${file}`);
            modified = true;
        }

        // Parse frontmatter
        const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (match) {
            const yaml = match[1];
            const body = match[2];

            // Check if slug exists
            if (yaml.includes('slug:')) {
                if (modified) {
                    fs.writeFileSync(filePath, content);
                }
                continue;
            }

            // Extract title or use filename
            const titleMatch = yaml.match(/title:\s*(.*)/);
            const title = titleMatch ? titleMatch[1].trim() : path.basename(file, '.md');

            // Generate slug
            let slug = title.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, '');

            // Fallback to filename if slug is empty (e.g. non-ASCII title)
            if (!slug) {
                slug = path.basename(file, '.md').toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }

            // Insert slug after title (or at start if no title)
            let newYaml;
            if (titleMatch) {
                newYaml = yaml.replace(/title:.*\n/, `$&slug: ${slug}\n`);
            } else {
                newYaml = `slug: ${slug}\n${yaml}`;
            }

            // Ensure newYaml ends with newline
            if (!newYaml.endsWith('\n')) newYaml += '\n';

            const newContent = `---\n${newYaml}---\n${body}`;
            fs.writeFileSync(filePath, newContent);
            console.log(`Updated ${file} with slug: ${slug}`);
        } else {
            console.warn(`Skipping ${file} (no frontmatter found)`);
        }
    }
    console.log('Migration and repair complete.');
}

migrateSlugs().catch(console.error);
