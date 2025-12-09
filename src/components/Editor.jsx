import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { isElectron, writeFile } from '../utils/fileSystem';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

const Editor = ({ content, filePath, onSave, onChange, fontSize }) => {
    const [body, setBody] = useState(() => parseFrontmatter(content || '').body);
    const [metadata, setMetadata] = useState(() => {
        const { metadata: parsedMeta } = parseFrontmatter(content || '');
        return {
            title: '',
            date: new Date().toISOString().split('T')[0],
            tags: '',
            category: '',
            ...parsedMeta,
            title: parsedMeta.title || '',
            date: parsedMeta.date || new Date().toISOString().split('T')[0],
            tags: parsedMeta.tags || '',
            category: parsedMeta.category || ''
        };
    });

    const sizeClass = {
        'sm': 'text-sm',
        'base': 'text-base',
        'lg': 'text-lg',
        'xl': 'text-xl'
    }[fontSize || 'base'];

    // Refs for tracking state without re-rendering and for logic checks
    const isComposing = React.useRef(false);
    const lastEmittedContent = React.useRef(content);

    // Initial load and external updates
    useEffect(() => {
        // Only update state if content is different from what we last emitted
        // This prevents the "echo" loop where typing -> parent -> prop -> reset state
        if (content !== lastEmittedContent.current) {
            const { metadata: parsedMeta, body: parsedBody } = parseFrontmatter(content || '');

            setBody(parsedBody);
            setMetadata(prev => ({
                ...prev,
                ...parsedMeta,
                title: parsedMeta.title || prev.title || '',
                date: parsedMeta.date || prev.date || new Date().toISOString().split('T')[0],
                tags: parsedMeta.tags || prev.tags || '',
                category: parsedMeta.category || prev.category || ''
            }));

            // Sync ref so we don't re-emit this back to parent immediately if we triggered it
            lastEmittedContent.current = content;
        }
    }, [content]);

    // Emit changes to parent
    const emitChange = (newMeta, newBody) => {
        // block updates if composing (IME)
        if (isComposing.current) return;

        if (onChange) {
            const fullContent = stringifyFrontmatter(newMeta, newBody);
            lastEmittedContent.current = fullContent;
            onChange(fullContent);
        }
    };

    // Helper to update state and notify parent
    const updateMetadata = (field, value) => {
        const newMeta = { ...metadata, [field]: value };
        setMetadata(newMeta);
        emitChange(newMeta, body);
    };

    const updateBody = (value) => {
        setBody(value);
        emitChange(metadata, value);
    };

    const handleCompositionStart = () => {
        isComposing.current = true;
    };

    const handleCompositionEnd = (e) => {
        isComposing.current = false;
        // Trigger a final update when composition ends
        // e.target.value contains the final committed string
        // We need to determine if this event came from metadata input or body textarea
        const { name, value } = e.target;

        if (name === 'note-body') {
            updateBody(value);
        } else if (name && name.startsWith('note-')) {
            const field = name.replace('note-', '');
            updateMetadata(field, value);
        }
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
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
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
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
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
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
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
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        placeholder="Dev"
                        className="bg-transparent border-none focus:outline-none text-slate-700 dark:text-slate-300 w-full"
                        autoComplete="off"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <textarea
                    name="note-body"
                    className={`w-full h-full p-8 resize-none focus:outline-none bg-transparent text-slate-800 dark:text-slate-200 font-mono leading-relaxed ${sizeClass}`}
                    value={body}
                    onChange={(e) => updateBody(e.target.value)}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
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
