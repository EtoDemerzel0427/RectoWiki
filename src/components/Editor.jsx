import React, { useState, useEffect, useRef } from 'react';
import { Save, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { isElectron, writeFile } from '../utils/fileSystem';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

const Editor = ({ content, filePath, onSave, onChange, fontSize }) => {
    const [body, setBody] = useState(() => parseFrontmatter(content || '').body);
    const [metadata, setMetadata] = useState(() => {
        const { metadata: parsedMeta } = parseFrontmatter(content || '');
        return {
            ...parsedMeta,
            title: parsedMeta.title || '',
            date: parsedMeta.date || new Date().toISOString().split('T')[0],
            tags: parsedMeta.tags || '',
            category: parsedMeta.category || ''
        };
    });

    // Search State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const sizeClass = {
        'sm': 'text-sm',
        'base': 'text-base',
        'lg': 'text-lg',
        'xl': 'text-xl'
    }[fontSize || 'base'];

    // Refs
    const isComposing = useRef(false);
    const lastEmittedContent = useRef(content);
    const textareaRef = useRef(null);
    const searchInputRef = useRef(null);

    // Initial load and external updates
    useEffect(() => {
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

            lastEmittedContent.current = content;
        }
    }, [content]);

    // Emit changes to parent
    const emitChange = (newMeta, newBody) => {
        if (isComposing.current) return;

        if (onChange) {
            const fullContent = stringifyFrontmatter(newMeta, newBody);
            lastEmittedContent.current = fullContent;
            onChange(fullContent);
        }
    };

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

    // Text Formatting Logic
    const wrapSelection = (wrapper) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = body.substring(start, end);
        const newText = body.substring(0, start) + wrapper + selectedText + wrapper + body.substring(end);

        updateBody(newText);

        // Restore cursor position/selection after React render cycle
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + wrapper.length, end + wrapper.length);
        }, 0);
    };

    const performSearch = (direction = 'next') => {
        if (!searchQuery || !textareaRef.current) return;

        const textarea = textareaRef.current;
        const text = body.toLowerCase();
        const query = searchQuery.toLowerCase();

        let startFrom = direction === 'next' ? textarea.selectionEnd : textarea.selectionStart;
        let index = -1;

        if (direction === 'next') {
            index = text.indexOf(query, startFrom);
            if (index === -1) {
                // Wrap around
                index = text.indexOf(query, 0);
            }
        } else {
            // Find last index before current position
            index = text.lastIndexOf(query, startFrom - 1); // -1 to avoid finding current selection again if we are at start of it
            if (index === -1) {
                // Wrap around to end
                index = text.lastIndexOf(query);
            }
        }

        if (index !== -1) {
            textarea.focus();
            textarea.setSelectionRange(index, index + query.length);

            // Attempt to scroll into view
            // Textarea scroll is tricky, simplistic approach:
            const lineHeight = 24; // approx
            const lines = body.substring(0, index).split('\n').length;
            // This is a rough guess, native focus() usually handles basic scroll,
            // but exact "center" positioning requires complex calculations.
            // We rely on browser's focus behavior for now.
        }
    };

    const handleTextareaKeyDown = (e) => {
        if (e.metaKey || e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    wrapSelection('**');
                    break;
                case 'i':
                    e.preventDefault();
                    wrapSelection('_');
                    break;
                case 'f':
                    e.preventDefault();
                    setShowSearch(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                    break;
            }
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch(e.shiftKey ? 'prev' : 'next');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowSearch(false);
            textareaRef.current?.focus();
        }
    };

    // Global Key Listener for non-focused shortcuts (like Save, or generic Find if we wanted global find)
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey)) {
                if (e.key === 's') {
                    e.preventDefault();
                    handleSave();
                } else if (e.key === 'f') {
                    // Also allow global Cmd+F to open search if not already handled by textarea
                    // But prevent default browser find
                    e.preventDefault();
                    setShowSearch(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                }
            }
            if (e.key === 'Escape' && showSearch) {
                setShowSearch(false);
                textareaRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [body, metadata, filePath, showSearch]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 relative">
            {/* Search Bar Overlay */}
            {showSearch && (
                <div className="absolute top-4 right-8 z-10 flex items-center bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center px-2 text-slate-400">
                        <Search size={14} />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Find..."
                        className="w-40 bg-transparent border-none focus:outline-none text-sm text-slate-700 dark:text-slate-200 h-8"
                    />
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button
                        onClick={() => performSearch('prev')}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        title="Previous (Shift+Enter)"
                    >
                        <ChevronUp size={14} />
                    </button>
                    <button
                        onClick={() => performSearch('next')}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        title="Next (Enter)"
                    >
                        <ChevronDown size={14} />
                    </button>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button
                        onClick={() => {
                            setShowSearch(false);
                            textareaRef.current?.focus();
                        }}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

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
                    ref={textareaRef}
                    name="note-body"
                    className={`w-full h-full p-8 resize-none focus:outline-none bg-transparent text-slate-800 dark:text-slate-200 font-mono leading-relaxed ${sizeClass}`}
                    value={body}
                    onChange={(e) => updateBody(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
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
