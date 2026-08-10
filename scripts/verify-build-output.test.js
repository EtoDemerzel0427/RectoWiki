import { describe, expect, it } from 'vitest';
import { findElectronBuildErrors } from './verify-build-output';

describe('findElectronBuildErrors', () => {
    it('rejects absolute Vite asset paths that make packaged Electron render blank', () => {
        const errors = findElectronBuildErrors(
            '<link href="/assets/app.css"><script src="/assets/app.js"></script>',
            process.cwd(),
        );

        expect(errors).toContain('Absolute asset path is not loadable through Electron loadFile(): /assets/app.css');
        expect(errors).toContain('Absolute asset path is not loadable through Electron loadFile(): /assets/app.js');
    });

    it('accepts relative references when all build assets exist', () => {
        const html = '<link rel="icon" href="./package.json"><script type="module" src="./scripts/verify-build-output.js"></script>';
        expect(findElectronBuildErrors(html, process.cwd())).toEqual([]);
    });
});
