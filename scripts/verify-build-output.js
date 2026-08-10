import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOCAL_ASSET_PATTERN = /(?:src|href)=["']([^"']+)["']/g;

export const findElectronBuildErrors = (html, outputDirectory) => {
    const errors = [];
    const references = [...html.matchAll(LOCAL_ASSET_PATTERN)].map(match => match[1]);
    const localReferences = references.filter(reference => !/^(?:[a-z]+:|#|\/\/)/i.test(reference));

    for (const reference of references) {
        if (reference.startsWith('/')) {
            errors.push(`Absolute asset path is not loadable through Electron loadFile(): ${reference}`);
        }
    }

    for (const reference of localReferences) {
        const cleanReference = reference.split(/[?#]/, 1)[0];
        if (!existsSync(resolve(outputDirectory, cleanReference))) {
            errors.push(`Referenced build asset does not exist: ${reference}`);
        }
    }

    if (!localReferences.some(reference => /\.js(?:[?#]|$)/.test(reference))) {
        errors.push('No bundled JavaScript asset was referenced.');
    }

    return errors;
};

export const verifyElectronBuild = (htmlPath) => {
    const html = readFileSync(htmlPath, 'utf8');
    const errors = findElectronBuildErrors(html, dirname(htmlPath));
    if (errors.length > 0) {
        throw new Error(`Electron build verification failed:\n- ${errors.join('\n- ')}`);
    }
};

const isCli = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
    const scriptDirectory = dirname(fileURLToPath(import.meta.url));
    const htmlPath = resolve(scriptDirectory, '..', 'dist', 'index.html');
    verifyElectronBuild(htmlPath);
    console.log(`Verified Electron entry point: ${htmlPath}`);
}
