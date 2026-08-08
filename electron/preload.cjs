const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    createFile: (path, content) => ipcRenderer.invoke('create-file', path, content),
    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    createDir: (path) => ipcRenderer.invoke('create-dir', path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
    runGenerator: () => ipcRenderer.invoke('run-generator'),
    getContent: () => ipcRenderer.invoke('get-content'),
    onContentUpdated: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('content-updated', subscription);
        return () => ipcRenderer.removeListener('content-updated', subscription);
    },
    onAutoSaveChange: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('auto-save-change', subscription);
        return () => ipcRenderer.removeListener('auto-save-change', subscription);
    },
    getAutoSaveStatus: () => ipcRenderer.invoke('get-auto-save-status'),
    selectContentFolder: () => ipcRenderer.invoke('select-content-folder'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});
