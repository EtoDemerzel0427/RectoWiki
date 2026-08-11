---
name: manage-rectowiki
description: Create, draft, revise, validate, organize, and publish Markdown pages in a RectoWiki content repository. Use when Codex is asked to write a new wiki page, edit or expand an existing page, manage page frontmatter or navigation metadata, work with local RectoWiki drafts, or explicitly publish a reviewed draft.
---

# Manage RectoWiki

Manage RectoWiki content through a local-draft-first workflow. Keep public pages unchanged until the user explicitly requests publication.

## Establish context

1. Locate the Wiki `content/` directory. Confirm it contains `_config.json` or `_meta.json`.
2. Read [references/content-contract.md](references/content-contract.md) before creating, moving, renaming, or publishing a page.
3. Search existing titles, slugs, tags, categories, and `[[wiki links]]` before writing. Reuse established terminology and avoid duplicate pages.
4. Read the target page and closely related pages before revising content. Preserve the author's language, structure, and level of detail unless asked to change them.

## Choose the safe workflow

- **Create a page:** Run `wiki-note.mjs create`. Write the requested body into the resulting local draft.
- **Revise a public page:** Run `wiki-note.mjs checkout`. Edit only the same-path file under `.rectowiki/drafts/`.
- **Revise an existing draft:** Edit the existing file under `.rectowiki/drafts/` directly.
- **Validate changes:** Run `wiki-note.mjs validate --path <relative-page-path>` before reporting completion.
- **Publish:** Run `wiki-note.mjs publish` only when the user explicitly asks to publish, make public, or move the reviewed draft live. Treat approval to write or revise as approval to create a draft, not approval to publish.

Use an absolute content-directory path and quote page paths containing spaces:

```bash
node scripts/wiki-note.mjs create \
  --content /absolute/wiki/content \
  --path 'Dev/React Server Components.md' \
  --title 'React Server Components' \
  --slug react-server-components \
  --tag React \
  --tag architecture

node scripts/wiki-note.mjs checkout \
  --content /absolute/wiki/content \
  --path 'Dev/Existing Page.md'

node scripts/wiki-note.mjs validate \
  --content /absolute/wiki/content \
  --path 'Dev/Existing Page.md'

node scripts/wiki-note.mjs publish \
  --content /absolute/wiki/content \
  --path 'Dev/Existing Page.md'
```

## Write and revise

- Preserve all unknown frontmatter keys. Do not remove `fontTheme`, `fontSize`, or future fields.
- Keep a published slug stable unless the user explicitly requests a URL change.
- Preserve `date` when revising; use the current local date only for a new page.
- Prefer existing tag spelling and capitalization. Keep `tags` as a YAML list.
- Derive `category` from the first path segment unless the Wiki already uses a different convention.
- Use meaningful `[[wiki links]]` to existing pages when they improve navigation. Do not invent targets.
- Separate sourced facts from interpretation. When the user requests research or current facts, verify them with appropriate sources before writing.
- Make focused edits. Do not rewrite unrelated sections merely to normalize style.

## Finish safely

1. Validate the changed page.
2. Review the diff between the public page and its overlay draft when revising an existing page.
3. Report the draft path, content changes, metadata changes, validation result, and whether the page remains local or was explicitly published.
4. Never commit, push, or publish unless the user separately requests that action.

