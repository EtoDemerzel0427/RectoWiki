const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { promises: fsPromises } = fs;
const {
    atomicWriteFile,
    createFileExclusive,
    renameExclusive,
    resolveContentPath,
} = require('./fileAccess.cjs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEV_SERVER_URL = 'http://127.0.0.1:5173/';

let mainWindow = null;
let contentManager = null;
let pendingSelectedContentPath = null;

const loadSettings = () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return { autoSave: false };
};

const saveSettings = (settings) => {
    try {
        fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
};

const getDefaultContentPath = () => (
    app.isPackaged
        ? path.join(process.resourcesPath, 'content')
        : path.join(__dirname, '../content')
);

const getConfiguredContentPath = () => loadSettings().contentPath || getDefaultContentPath();

const isSafeExternalUrl = (url) => {
    try {
        const protocol = new URL(url).protocol;
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
};

const isSameApplicationPage = (currentUrl, targetUrl) => {
    try {
        const current = new URL(currentUrl);
        const target = new URL(targetUrl);
        return current.protocol === target.protocol
            && current.host === target.host
            && current.pathname === target.pathname;
    } catch {
        return false;
    }
};

const configureNavigationSecurity = (win) => {
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        if (isSameApplicationPage(win.webContents.getURL(), url)) return;

        event.preventDefault();
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url);
        }
    });
};

const buildApplicationMenu = (win) => Menu.buildFromTemplate([
    {
        label: 'File',
        submenu: [
            {
                label: 'Auto Save',
                type: 'checkbox',
                checked: loadSettings().autoSave,
                click: (menuItem) => {
                    const settings = loadSettings();
                    settings.autoSave = menuItem.checked;
                    saveSettings(settings);
                    win.webContents.send('auto-save-change', menuItem.checked);
                },
            },
            { type: 'separator' },
            { role: 'quit' },
        ],
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
        ],
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    },
]);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });

    configureNavigationSecurity(win);
    Menu.setApplicationMenu(buildApplicationMenu(win));

    win.webContents.on('console-message', (_event, _level, message) => {
        console.log(`[Renderer] ${message}`);
    });

    win.on('closed', () => {
        if (mainWindow === win) mainWindow = null;
    });

    return win;
}

async function loadApplication(win) {
    if (process.env.NODE_ENV === 'development') {
        await win.loadURL(DEV_SERVER_URL);
        win.webContents.openDevTools();
        return;
    }

    await win.loadFile(path.join(__dirname, '../dist/index.html'));
}

const assertTrustedSender = (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        throw new Error('Rejected IPC request from an untrusted renderer');
    }

    if (event.senderFrame && event.senderFrame !== mainWindow.webContents.mainFrame) {
        throw new Error('Rejected IPC request from a child frame');
    }
};

const getRequestedPath = (requestPath) => {
    if (!contentManager?.contentPath) {
        throw new Error('Content manager is not initialized');
    }
    return resolveContentPath(contentManager.contentPath, requestPath);
};

const registerIpcHandlers = () => {
    ipcMain.handle('read-file', async (event, filePath) => {
        try {
            assertTrustedSender(event);
            const content = await fsPromises.readFile(getRequestedPath(filePath), 'utf8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('write-file', async (event, filePath, content) => {
        try {
            assertTrustedSender(event);
            await atomicWriteFile(getRequestedPath(filePath), content);
            return { success: true };
        } catch (error) {
            console.error(`[Main] Write failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('create-file', async (event, filePath, content = '') => {
        try {
            assertTrustedSender(event);
            await createFileExclusive(getRequestedPath(filePath), content);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-file', async (event, filePath) => {
        try {
            assertTrustedSender(event);
            await fsPromises.rm(getRequestedPath(filePath), { recursive: true, force: false });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('create-dir', async (event, dirPath) => {
        try {
            assertTrustedSender(event);
            await fsPromises.mkdir(getRequestedPath(dirPath));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rename-path', async (event, oldPath, newPath) => {
        try {
            assertTrustedSender(event);
            await renameExclusive(getRequestedPath(oldPath), getRequestedPath(newPath));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('run-generator', async (event) => {
        try {
            assertTrustedSender(event);
            if (!contentManager) throw new Error('Content manager is not initialized');
            await contentManager.scan();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-auto-save-status', (event) => {
        assertTrustedSender(event);
        const fileMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === 'File');
        const autoSave = fileMenu?.submenu.items.find((item) => item.label === 'Auto Save');
        return autoSave?.checked || false;
    });

    ipcMain.handle('select-content-folder', async (event) => {
        assertTrustedSender(event);
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        if (result.canceled || result.filePaths.length === 0) return null;

        pendingSelectedContentPath = path.resolve(result.filePaths[0]);
        return pendingSelectedContentPath;
    });

    ipcMain.handle('get-settings', (event) => {
        assertTrustedSender(event);
        return loadSettings();
    });

    ipcMain.handle('save-settings', async (event, newSettings) => {
        assertTrustedSender(event);

        const currentSettings = loadSettings();
        const requestedPath = newSettings.contentPath
            ? path.resolve(newSettings.contentPath)
            : '';
        const currentPath = currentSettings.contentPath
            ? path.resolve(currentSettings.contentPath)
            : '';

        if (requestedPath !== currentPath && requestedPath !== pendingSelectedContentPath) {
            throw new Error('Content folder must be selected through the folder picker');
        }

        if (requestedPath) {
            const stats = await fsPromises.stat(requestedPath);
            if (!stats.isDirectory()) throw new Error('Selected content path is not a directory');
        }

        const mergedSettings = { ...currentSettings, ...newSettings, contentPath: requestedPath };
        saveSettings(mergedSettings);
        pendingSelectedContentPath = null;

        const targetPath = requestedPath || getDefaultContentPath();
        if (contentManager && targetPath !== contentManager.contentPath) {
            await contentManager.initialize(targetPath);
        }

        return { success: true };
    });

    ipcMain.handle('get-content', async (event) => {
        assertTrustedSender(event);
        return contentManager?.getContent() || { nodes: [], config: {} };
    });
};

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    registerIpcHandlers();

    const { default: ContentManager } = await import('./contentManager.mjs');
    mainWindow = createWindow();
    contentManager = new ContentManager(mainWindow);
    await contentManager.initialize(getConfiguredContentPath());
    await loadApplication(mainWindow);

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length > 0) return;

        mainWindow = createWindow();
        contentManager.mainWindow = mainWindow;
        await loadApplication(mainWindow);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    void contentManager?.dispose();
});
