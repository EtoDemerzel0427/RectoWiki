export const isElectron = () => {
    return window.electronAPI !== undefined;
};

/**
 * Sanitizes a filename by replacing OS-forbidden characters with hyphens.
 */
export const sanitizeFilename = (name) => {
    if (!name) return '';
    const sanitized = name
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/[. ]+$/g, '')
        .trim();

    return sanitized === '.' || sanitized === '..' ? '' : sanitized;
};

export const readFile = async (filePath) => {
    if (isElectron()) {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
            return result.content;
        } else {
            throw new Error(result.error);
        }
    } else {
        // Fallback for browser mode (read-only via fetch)
        // Note: filePath in browser mode is usually a URL path relative to public or root
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }
        return await response.text();
    }
};

export const writeFile = async (filePath, content) => {
    if (isElectron()) {
        const result = await window.electronAPI.writeFile(filePath, content);
        if (!result.success) {
            throw new Error(result.error);
        }
    } else {
        console.warn('Write operation not supported in browser mode');
        throw new Error('Write operation not supported in browser mode');
    }
};

export const createFile = async (filePath, content = '') => {
    if (isElectron()) {
        const result = await window.electronAPI.createFile(filePath, content);
        if (!result.success) {
            throw new Error(result.error);
        }
    } else {
        throw new Error('Create operation not supported in browser mode');
    }
};

export const moveToTrash = async (filePath, details = {}) => {
    if (!isElectron() || !window.electronAPI?.trashItem) {
        throw new Error('Trash is only supported in the desktop app');
    }
    const result = await window.electronAPI.trashItem(filePath, details);
    if (!result.success) throw new Error(result.error);
    return result.entry;
};

export const listTrashItems = async () => {
    if (!isElectron() || !window.electronAPI?.listTrash) return [];
    const result = await window.electronAPI.listTrash();
    if (!result.success) throw new Error(result.error);
    return result.items || [];
};

export const restoreTrashItem = async (trashId) => {
    if (!isElectron() || !window.electronAPI?.restoreTrashItem) {
        throw new Error('Trash restore is only supported in the desktop app');
    }
    const result = await window.electronAPI.restoreTrashItem(trashId);
    if (!result.success) throw new Error(result.error);
    return result.entry;
};

export const createDir = async (dirPath) => {
    if (isElectron()) {
        const result = await window.electronAPI.createDir(dirPath);
        if (!result.success) {
            throw new Error(result.error);
        }
    } else {
        throw new Error('Create directory operation not supported in browser mode');
    }
};

export const renamePath = async (oldPath, newPath) => {
    if (isElectron()) {
        const result = await window.electronAPI.renamePath(oldPath, newPath);
        if (!result.success) {
            throw new Error(result.error);
        }
    } else {
        throw new Error('Rename operation not supported in browser mode');
    }
};

export const publishDraft = async (draftPath, content) => {
    if (!isElectron() || !window.electronAPI?.publishDraft) {
        throw new Error('Publishing drafts is only supported in the desktop app');
    }

    const result = await window.electronAPI.publishDraft(draftPath, content);
    if (!result.success) {
        throw new Error(result.error);
    }

    return result.filePath;
};
