const createEditorHistoryMenuItems = (webContents) => [
    {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        registerAccelerator: false,
        click: () => webContents.send('editor-command', 'undo'),
    },
    {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        registerAccelerator: false,
        click: () => webContents.send('editor-command', 'redo'),
    },
];

module.exports = { createEditorHistoryMenuItems };
