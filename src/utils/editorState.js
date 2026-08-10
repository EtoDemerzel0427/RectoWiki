export const MAX_UNDO_STEPS = 100;

const snapshotsEqual = (left, right) => (
    left?.body === right?.body
    && JSON.stringify(left?.metadata) === JSON.stringify(right?.metadata)
);

export const normalizeEditorMetadata = (metadata = {}, today = new Date().toISOString().split('T')[0]) => ({
    ...metadata,
    title: metadata.title || '',
    date: metadata.date || today,
    tags: metadata.tags || '',
    category: metadata.category || '',
    draft: metadata.draft ?? false,
});

export const createEditorHistory = (metadata, body) => ({
    snapshots: [{ metadata, body }],
    index: 0,
});

export const pushEditorHistory = (history, snapshot) => {
    if (!history || history.index < 0 || history.snapshots.length === 0) {
        return createEditorHistory(snapshot.metadata, snapshot.body);
    }

    const currentSnapshot = history.snapshots[history.index];
    if (snapshotsEqual(currentSnapshot, snapshot)) return history;

    const snapshots = [...history.snapshots.slice(0, history.index + 1), snapshot];
    const maximumEntries = MAX_UNDO_STEPS + 1;
    const retainedSnapshots = snapshots.length > maximumEntries
        ? snapshots.slice(-maximumEntries)
        : snapshots;

    return {
        snapshots: retainedSnapshots,
        index: retainedSnapshots.length - 1,
    };
};

export const moveEditorHistory = (history, direction) => {
    if (!history || history.index < 0) return { history, snapshot: null };

    const nextIndex = direction === 'undo'
        ? Math.max(0, history.index - 1)
        : Math.min(history.snapshots.length - 1, history.index + 1);

    if (nextIndex === history.index) return { history, snapshot: null };

    const nextHistory = { ...history, index: nextIndex };
    return { history: nextHistory, snapshot: nextHistory.snapshots[nextIndex] };
};

export const getLineSelection = (body = '', requestedOffset = 0) => {
    let anchor = Number.isFinite(requestedOffset) ? requestedOffset : 0;
    anchor = Math.max(0, Math.min(anchor, body.length));

    // Rendered Markdown nodes never represent blank separator lines. If a
    // parser reports the preceding newline, select the following source line.
    if (body[anchor] === '\n' && anchor < body.length) anchor += 1;

    const start = body.lastIndexOf('\n', Math.max(0, anchor - 1)) + 1;
    const nextLineBreak = body.indexOf('\n', anchor);
    const end = nextLineBreak === -1 ? body.length : nextLineBreak;
    return { start, end };
};

export const wrapTextSelection = (body, start, end, wrapper) => ({
    body: body.slice(0, start) + wrapper + body.slice(start, end) + wrapper + body.slice(end),
    selectionStart: start + wrapper.length,
    selectionEnd: end + wrapper.length,
});
