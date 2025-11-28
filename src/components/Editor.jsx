import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { isElectron, writeFile } from '../utils/fileSystem';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

const Editor = ({ content, filePath, onSave, onChange }) => {
    const [body, setBody] = useState('');
    const [metadata, setMetadata] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        tags: '',
        category: ''
    });

    // Parse frontmatter on load or content change
    useEffect(() => {
        // Always parse, even if empty, to reset state
        const { metadata: parsedMeta, body: parsedBody } = parseFrontmatter(content || '');

        setMetadata(prev => ({
            ...prev,
            ...parsedMeta,
            // Ensure defaults if missing in file
            title: parsedMeta.title || prev.title || '',
            date: parsedMeta.date || prev.date || new Date().toISOString().split('T')[0],
            tags: parsedMeta.tags || prev.tags || '',
            category: parsedMeta.category || prev.category || ''
        }));
        setBody(parsedBody);
    }, [content]);

    const isUserChange = React.useRef(false);

    // Sync changes to parent (Only if initiated by user)
    useEffect(() => {
        if (isUserChange.current && onChange) {
            const fullContent = stringifyFrontmatter(metadata, body);
            onChange(fullContent);
            isUserChange.current = false;
        }
    }, [metadata, body, onChange]);

    // Helper to update state and notify parent
    const updateMetadata = (field, value) => {
        isUserChange.current = true;
        setMetadata(prev => ({ ...prev, [field]: value }));
    };

    const updateBody = (value) => {
        isUserChange.current = true;
        setBody(value);
    };

    const handleSave = async () => {
        try {
            const fullContent = stringifyFrontmatter(metadata, body);

            if (onSave) {
                await onSave(fullContent);
            }
        } catch (e) {
            console.error("Error in handleSave:", e);
            alert("Error saving: " + e.message);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [body, metadata, filePath]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900">
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                <input
                    type="text"
                    name="note-title"
                    value={metadata.title}
                    onChange={(e) => updateMetadata('title', e.target.value)}
                    placeholder="Untitled"
                    className="text-4xl font-bold w-full bg-transparent border-none focus:outline-none text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
                    autoComplete="off"
                />

                <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center">Slug</div>
                    <input
                        type="text"
                        name="note-slug"
                        value={metadata.slug || ''}
                        onChange={(e) => updateMetadata('slug', e.target.value)}
                        placeholder="my-custom-url"
                        className="bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-300 w-full font-mono text-xs"
                        autoComplete="off"
                    />

                    <div className="text-slate-500 dark:text-slate-400 flex items-center">Date</div>
                    <input
                        type="date"
                        name="note-date"
                        value={metadata.date}
                        onChange={(e) => updateMetadata('date', e.target.value)}
                        className="bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-300 w-full"
                    />

                    <div className="text-slate-500 dark:text-slate-400 flex items-center">Tags</div>
                    <input
                        type="text"
                        name="note-tags"
                        value={metadata.tags}
                        onChange={(e) => updateMetadata('tags', e.target.value)}
                        placeholder="React, Bug, ..."
                        className="bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-300 w-full"
                        autoComplete="off"
                    />

                    <div className="text-slate-500 dark:text-slate-400 flex items-center">Category</div>
                    <input
                        type="text"
                        name="note-category"
                        value={metadata.category}
                        onChange={(e) => updateMetadata('category', e.target.value)}
                        placeholder="Dev"
                        className="bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-300 w-full"
                        autoComplete="off"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <textarea
                    className="w-full h-full p-8 resize-none focus:outline-none bg-transparent text-slate-800 dark:text-slate-200 font-mono text-base leading-relaxed"
                    value={body}
                    onChange={(e) => updateBody(e.target.value)}
                    placeholder="Start writing..."
                    spellCheck="false"
                />

                <button
                    onClick={handleSave}
                    className="absolute bottom-6 right-6 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-colors"
                    title="Save (Cmd+S)"
                >
                    <Save size={20} />
                </button>
            </div>
        </div>
    );
};

export default Editor;
