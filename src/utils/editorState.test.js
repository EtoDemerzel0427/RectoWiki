import { describe, expect, it } from 'vitest';
import {
    MAX_UNDO_STEPS,
    createEditorHistory,
    getLineSelection,
    moveEditorHistory,
    normalizeEditorMetadata,
    pushEditorHistory,
    wrapTextSelection,
} from './editorState';

describe('editor state helpers', () => {
    it('normalizes a newly opened file without carrying metadata from the previous file', () => {
        expect(normalizeEditorMetadata({}, '2026-08-10')).toEqual({
            title: '',
            date: '2026-08-10',
            tags: '',
            category: '',
            draft: false,
        });
        expect(normalizeEditorMetadata({ title: 'Fresh', draft: true }, '2026-08-10')).toMatchObject({
            title: 'Fresh',
            date: '2026-08-10',
            tags: '',
            category: '',
            draft: true,
        });
    });

    it('selects the complete source line for a preview offset', () => {
        const body = '\nfirst line\n\nselect this line\nlast line';
        const exact = getLineSelection(body, body.indexOf('this'));
        const precedingNewline = getLineSelection(body, body.indexOf('select') - 1);

        expect(body.slice(exact.start, exact.end)).toBe('select this line');
        expect(body.slice(precedingNewline.start, precedingNewline.end)).toBe('select this line');
    });

    it('wraps selected text and keeps the inner text selected', () => {
        expect(wrapTextSelection('one two', 4, 7, '**')).toEqual({
            body: 'one **two**',
            selectionStart: 6,
            selectionEnd: 9,
        });
        expect(wrapTextSelection('one two', 4, 7, '_')).toEqual({
            body: 'one _two_',
            selectionStart: 5,
            selectionEnd: 8,
        });
    });

    it('retains exactly 100 undo operations', () => {
        let history = createEditorHistory({}, '');
        for (let index = 1; index <= 105; index += 1) {
            history = pushEditorHistory(history, { metadata: {}, body: 'x'.repeat(index) });
        }

        let undoCount = 0;
        let oldestSnapshot;
        while (true) {
            const result = moveEditorHistory(history, 'undo');
            if (!result.snapshot) break;
            history = result.history;
            oldestSnapshot = result.snapshot;
            undoCount += 1;
        }

        expect(undoCount).toBe(MAX_UNDO_STEPS);
        expect(oldestSnapshot.body).toHaveLength(5);
    });

    it('discards the redo branch after a new edit', () => {
        let history = createEditorHistory({}, 'a');
        history = pushEditorHistory(history, { metadata: {}, body: 'ab' });
        history = pushEditorHistory(history, { metadata: {}, body: 'abc' });
        history = moveEditorHistory(history, 'undo').history;
        history = pushEditorHistory(history, { metadata: {}, body: 'ab!' });

        expect(history.snapshots.map(snapshot => snapshot.body)).toEqual(['a', 'ab', 'ab!']);
        expect(moveEditorHistory(history, 'redo').snapshot).toBeNull();
    });
});
