import { describe, expect, it, vi } from 'vitest';
import editorCommands from './editorCommands.cjs';

describe('createEditorHistoryMenuItems', () => {
    it('routes Electron menu accelerators to the controlled editor history', () => {
        const webContents = { send: vi.fn() };
        const items = editorCommands.createEditorHistoryMenuItems(webContents);

        expect(items.map(item => item.accelerator)).toEqual([
            'CmdOrCtrl+Z',
            'CmdOrCtrl+Shift+Z',
        ]);
        expect(items.every(item => item.registerAccelerator === false)).toBe(true);

        items[0].click();
        items[1].click();
        expect(webContents.send).toHaveBeenNthCalledWith(1, 'editor-command', 'undo');
        expect(webContents.send).toHaveBeenNthCalledWith(2, 'editor-command', 'redo');
    });
});
