export const isElectron = () => {
    return window.electronAPI !== undefined;
};

/**
 * Sanitizes a filename by replacing OS-forbidden characters with hyphens.
 */
export const sanitizeFilename = (name) => {
    if (!name) return '';
    return name.replace(/[\\/:*?"<>|]/g, '-').trim();
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

export const deleteFile = async (filePath) => {
    if (isElectron()) {
        const result = await window.electronAPI.deleteFile(filePath);
        if (!result.success) {
            throw new Error(result.error);
        }
    } else {
        throw new Error('Delete operation not supported in browser mode');
    }
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
