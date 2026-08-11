import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Save, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';
import {
    createEditorHistory,
    getLineSelection,
    moveEditorHistory,
    normalizeEditorMetadata,
    pushEditorHistory,
    wrapTextSelection,
} from '../utils/editorState';

const Editor = ({ content, filePath, onSave, onChange, fontSize, selectionRequest }) => {
    const [body, setBody] = useState(() => parseFrontmatter(content || '').body);
    const [metadata, setMetadata] = useState(() => {
        const { metadata: parsedMeta } = parseFrontmatter(content || '');
        return normalizeEditorMetadata(parsedMeta);
    });

    // Search State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showLineNumbers, setShowLineNumbers] = useState(() => {
        try {
            return window.localStorage.getItem('rectowiki-editor-line-numbers') === 'true';
        } catch {
            return false;
        }
    });

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
    const lineNumbersRef = useRef(null);
    const searchInputRef = useRef(null);
    const bodyRef = useRef(body);
    const lastFilePathRef = useRef(filePath);
    const historyRef = useRef({ snapshots: [], index: -1 });

    const resetHistory = useCallback((nextMetadata, nextBody) => {
        historyRef.current = createEditorHistory(nextMetadata, nextBody);
    }, []);

    useEffect(() => {
        bodyRef.current = body;
    }, [body]);

    useEffect(() => {
        try {
            window.localStorage.setItem('rectowiki-editor-line-numbers', String(showLineNumbers));
        } catch {
            // The preference is optional when persistent browser storage is unavailable.
        }
    }, [showLineNumbers]);

    const lineNumbers = useMemo(
        () => Array.from({ length: body.split('\n').length }, (_, index) => index + 1),
        [body]
    );

    // Initial load and external updates
    useEffect(() => {
        const fileChanged = filePath !== lastFilePathRef.current;
        if (fileChanged || content !== lastEmittedContent.current) {
            const { metadata: parsedMeta, body: parsedBody } = parseFrontmatter(content || '');
            const nextMetadata = normalizeEditorMetadata(parsedMeta);

            // This controlled editor must resynchronize when another file is loaded.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBody(parsedBody);
            setMetadata(nextMetadata);
            bodyRef.current = parsedBody;
            resetHistory(nextMetadata, parsedBody);

            lastEmittedContent.current = content;
            lastFilePathRef.current = filePath;
        }
    }, [content, filePath, resetHistory]);

    useEffect(() => {
        if (historyRef.current.index === -1) {
            resetHistory(metadata, body);
        }
    }, [body, metadata, resetHistory]);

    // Emit changes to parent
    const emitChange = (newMeta, newBody) => {
        if (isComposing.current) return;

        if (onChange) {
            const fullContent = stringifyFrontmatter(newMeta, newBody);
            lastEmittedContent.current = fullContent;
            onChange(fullContent);
        }
    };

    const commitSnapshot = (nextMetadata, nextBody) => {
        if (historyRef.current.index === -1) {
            resetHistory(metadata, body);
        }

        const nextSnapshot = { metadata: nextMetadata, body: nextBody };
        const nextHistory = pushEditorHistory(historyRef.current, nextSnapshot);
        if (nextHistory === historyRef.current) return;
        historyRef.current = nextHistory;

        setMetadata(nextMetadata);
        setBody(nextBody);
        bodyRef.current = nextBody;
        emitChange(nextMetadata, nextBody);
    };

    const updateMetadata = (field, value) => {
        const newMeta = { ...metadata, [field]: value };
        if (isComposing.current) {
            setMetadata(newMeta);
            return;
        }
        commitSnapshot(newMeta, body);
    };

    const updateBody = (value) => {
        if (isComposing.current) {
            setBody(value);
            bodyRef.current = value;
            return;
        }
        commitSnapshot(metadata, value);
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

    const handleSave = useCallback(async () => {
        try {
            const fullContent = stringifyFrontmatter(metadata, body);
            if (onSave) {
                await onSave(fullContent);
            }
        } catch (e) {
            console.error("Error in handleSave:", e);
            alert("Error saving: " + e.message);
        }
    }, [body, metadata, onSave]);

    // Text Formatting Logic
    const wrapSelection = (wrapper) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const wrapped = wrapTextSelection(body, start, end, wrapper);

        updateBody(wrapped.body);

        // Restore cursor position/selection after React render cycle
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(wrapped.selectionStart, wrapped.selectionEnd);
        }, 0);
    };

    const applyHistorySnapshot = (snapshot) => {
        setMetadata(snapshot.metadata);
        setBody(snapshot.body);
        bodyRef.current = snapshot.body;
        emitChange(snapshot.metadata, snapshot.body);

        requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus({ preventScroll: true });
            const cursor = Math.min(snapshot.body.length, textarea.value.length);
            textarea.setSelectionRange(cursor, cursor);
        });
    };

    const undo = () => {
        const result = moveEditorHistory(historyRef.current, 'undo');
        if (!result.snapshot) return;
        historyRef.current = result.history;
        applyHistorySnapshot(result.snapshot);
    };

    const redo = () => {
        const result = moveEditorHistory(historyRef.current, 'redo');
        if (!result.snapshot) return;
        historyRef.current = result.history;
        applyHistorySnapshot(result.snapshot);
    };

    // Electron menu clicks originate in the main process. Keyboard accelerators
    // stay renderer-owned so they cannot bypass this controlled history.
    useEffect(() => {
        const subscribe = window.electronAPI?.onEditorCommand;
        if (!subscribe) return undefined;

        return subscribe((command) => {
            if (command === 'undo') undo();
            if (command === 'redo') redo();
        });
    });

    // Scroll Helper using a text-layout mirror with the textarea's width.
    const scrollToMatch = (textarea, index) => {
        if (!textarea) return;

        const div = document.createElement('div');
        const style = window.getComputedStyle(textarea);
        const mirroredProperties = [
            'boxSizing',
            'fontFamily',
            'fontSize',
            'fontStyle',
            'fontVariant',
            'fontWeight',
            'letterSpacing',
            'lineHeight',
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'textIndent',
            'textTransform',
            'tabSize',
            'wordSpacing'
        ];

        mirroredProperties.forEach((property) => {
            div.style[property] = style[property];
        });

        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '-9999px';
        div.style.visibility = 'hidden';
        div.style.height = 'auto';
        div.style.minHeight = '0';
        div.style.maxHeight = 'none';
        div.style.width = `${textarea.clientWidth}px`;
        div.style.overflow = 'visible';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordBreak = 'break-word';
        div.style.overflowWrap = 'break-word';

        const before = document.createElement('span');
        before.textContent = textarea.value.substring(0, index);
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        div.append(before, marker);

        document.body.appendChild(div);
        const markerTop = marker.offsetTop;
        const lineHeight = Number.parseFloat(style.lineHeight)
            || Number.parseFloat(style.fontSize) * 1.5
            || 20;
        document.body.removeChild(div);

        textarea.scrollTop = Math.max(
            0,
            markerTop - (textarea.clientHeight / 2) + (lineHeight / 2)
        );
    };

    useEffect(() => {
        if (!selectionRequest || !textareaRef.current) return;

        const textarea = textareaRef.current;
        const currentBody = bodyRef.current;
        const { start, end } = getLineSelection(currentBody, selectionRequest.start);

        const frame = requestAnimationFrame(() => {
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(start, end);
            scrollToMatch(textarea, start);
        });

        return () => cancelAnimationFrame(frame);
    }, [selectionRequest]);

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
            scrollToMatch(textarea, index);
        }
    };

    const handleTextareaKeyDown = (e) => {
        // If search is open, intercept Enter keys for navigation
        if (showSearch) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch(e.shiftKey ? 'prev' : 'next');
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSearch(false);
                textareaRef.current?.focus(); // Re-focus textarea
                return;
            }
        }

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
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    break;
                case 'y':
                    if (e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        redo();
                    }
                    break;
            }
        }
    };

    const handleTextareaScroll = (e) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
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
    }, [body, metadata, filePath, showSearch, handleSave]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 relative">
            {/* Search Bar Overlay */}
            {showSearch && (
                <div className="absolute top-4 right-36 z-50 flex items-center bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 p-1 animate-in fade-in slide-in-from-top-2 duration-200">
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

                    <div className="text-slate-500 dark:text-slate-400 flex items-center">Draft</div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="note-draft"
                            checked={!!metadata.draft}
                            onChange={(e) => updateMetadata('draft', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="ml-2 text-xs text-slate-400">
                            {metadata.draft ? 'Hidden on Web' : 'Public on Web'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="h-10 shrink-0 flex items-center justify-end px-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showLineNumbers}
                            onChange={(e) => setShowLineNumbers(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        Show line numbers
                    </label>
                </div>

                <div className="flex-1 min-h-0 flex overflow-hidden relative">
                    {showLineNumbers && (
                        <div
                            ref={lineNumbersRef}
                            aria-hidden="true"
                            className={`w-14 shrink-0 overflow-hidden border-r border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 py-8 pr-3 text-right font-mono leading-relaxed text-slate-400 dark:text-slate-600 select-none ${sizeClass}`}
                        >
                            {lineNumbers.map((lineNumber) => (
                                <div key={lineNumber}>{lineNumber}</div>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        name="note-body"
                        className={`flex-1 min-w-0 h-full py-8 pr-8 ${showLineNumbers ? 'pl-4' : 'pl-8'} resize-none focus:outline-none bg-transparent text-slate-800 dark:text-slate-200 font-mono leading-relaxed ${sizeClass}`}
                        value={body}
                        onChange={(e) => updateBody(e.target.value)}
                        onKeyDown={handleTextareaKeyDown}
                        onScroll={handleTextareaScroll}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        placeholder="Start writing..."
                        spellCheck="false"
                        wrap={showLineNumbers ? 'off' : 'soft'}
                    />
                </div>

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
