# RectoWiki content contract

## Storage model

Given a content directory at `<wiki>/content`:

- Store published pages under `<wiki>/content/<relative-path>.md`.
- Store local drafts under `<wiki>/.rectowiki/drafts/<relative-path>.md`.
- Use a same-relative-path local draft as an overlay for a published page.
- Store ordering for published siblings in `content/**/_meta.json`.
- Store ordering for local-draft siblings in `.rectowiki/drafts/**/_meta.json`.
- Treat repository `_draft_meta.json` files as a legacy compatibility format; do not create new ones.

The `.rectowiki/` directory is local-only and should be ignored by Git. A page with `draft: true` under `content/` is excluded from static generation, but its source can still appear in Git history. Therefore, create AI drafts only in `.rectowiki/drafts/`.

## Page frontmatter

Create new pages with this shape:

```yaml
---
title: "Page title"
slug: "stable-ascii-slug"
date: "2026-08-10"
tags: ["tag-one", "tag-two"]
category: "TopLevelFolder"
draft: true
---
```

Apply these rules:

- `title`: Require a non-empty string. Do not couple it to the filename after creation.
- `slug`: Require a non-empty, lowercase ASCII slug. Keep it stable after publication. For a new non-Latin title, supply a meaningful English slug when possible; otherwise allow the CLI's deterministic `note-<hash>` fallback.
- `date`: Use `YYYY-MM-DD`. Treat it as the creation date and preserve it during edits.
- `tags`: Use an array. Reuse existing vocabulary and capitalization.
- `category`: Default to the first folder segment, or `General` for a root page.
- `draft`: Require `true` in the local drafts tree. Change it to `false` only during explicit publication.
- Unknown keys: Preserve them byte-for-byte whenever practical. In particular, retain `fontTheme` and `fontSize`.

Do not add AI authorship metadata by default. Git history and the draft review boundary provide clearer provenance. Add a provenance field only when the user defines a concrete audit requirement.

## Ordering metadata

Each `_meta.json` is a JSON array of child basenames without `.md`:

```json
[
  "First Page",
  "Second Page",
  "Subfolder"
]
```

- Append a new page if it is absent.
- Preserve all existing entries and their order.
- Do not sort or otherwise normalize the array without an explicit reordering request.
- On publication, add the basename to the public `_meta.json` and remove it from the local draft `_meta.json`.

## Lifecycle commands

Run the bundled CLI with Node.js:

```text
node <skill>/scripts/wiki-note.mjs <command> [options]
```

Commands:

- `create --content DIR --path PATH --title TITLE [--slug SLUG] [--date DATE] [--category CATEGORY] [--tag TAG ...]`
  - Create a new local draft and update its local ordering metadata.
  - Refuse to overwrite either a published page or an existing draft.
- `checkout --content DIR --path PATH`
  - Copy a published page to the same relative path in the drafts tree.
  - Set `draft: true` while preserving every other frontmatter line.
  - Refuse to overwrite an existing draft.
- `validate --content DIR [--path PATH]`
  - With `--path`, validate the overlay draft when present, otherwise the published page.
  - Without `--path`, validate all published pages and local drafts.
- `publish --content DIR --path PATH`
  - Validate and atomically write the local draft to the same relative path under `content/`.
  - Set `draft: false`, update both ordering files, then remove the local draft.
  - This command may replace an existing published page and must require explicit user publication intent.

Paths are relative to `content/`, must end in `.md` (the CLI adds the extension when omitted), and may not contain `..` or escape either storage root.

