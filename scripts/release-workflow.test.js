import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const workflow = load(readFileSync(resolve('.github/workflows/release.yml'), 'utf8'));

describe('release workflow', () => {
    it('supports tag pushes and published GitHub releases', () => {
        expect(workflow.on.push.tags).toEqual(['v*']);
        expect(workflow.on.release.types).toEqual(['published']);
    });

    it('serializes and skips duplicate completed builds for the same tag', () => {
        expect(workflow.concurrency['cancel-in-progress']).toBe(false);
        expect(workflow.jobs.prepare.outputs['should-build']).toContain('release-state.outputs.should-build');
        expect(workflow.jobs.prepare.steps[0].run).toContain('HAS_DMG');
        expect(workflow.jobs.prepare.steps[0].run).toContain('HAS_APPIMAGE');
        expect(workflow.jobs.prepare.steps[0].run).toContain('HAS_EXE');
    });

    it('gates all platform packaging on lint, tests, and a web build', () => {
        const qualityCommands = workflow.jobs.quality.steps.map(step => step.run).filter(Boolean);
        expect(qualityCommands).toEqual(expect.arrayContaining([
            'npm run lint',
            'npm test',
            'npm run build',
        ]));
        expect(workflow.jobs.build.needs).toEqual(['prepare', 'quality']);
        expect(workflow.jobs.build.steps.some(step => step.run === 'npm run electron:release')).toBe(true);
    });

    it('publishes only after all platform builds succeed', () => {
        expect(workflow.jobs.publish.needs).toEqual(['prepare', 'build']);
        expect(workflow.jobs.publish.if).toContain("needs.build.result == 'success'");
        expect(workflow.jobs.publish.steps.at(-1).run).toContain('gh release upload');
    });
});
