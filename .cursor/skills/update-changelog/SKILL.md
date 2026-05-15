---
name: update-changelog
description: Update public/CHANGELOG.json and bump CURRENT_VERSION in useAppShell.ts based on local git changes. Use when the user asks to update the changelog, bump the version, document what changed, write release notes, or prepare a release. Triggers on phrases like "update the changelog", "bump the version", "what changed", "write release notes", or "prepare a release".
---

# Update Changelog

Analyze local git changes, draft changelog entries, bump the semver version, and update both source files.

## Files to update

| File | Purpose |
|------|---------|
| `public/CHANGELOG.json` | Prepend new version entry at the top of the array |
| `src/client/hooks/useAppShell.ts` | Update the `CURRENT_VERSION` constant |

> **Note:** `docs/CHANGELOG_WORKFLOW.md` incorrectly references `App.tsx` — the constant actually lives in `useAppShell.ts`.

---

## Step 1 — Analyze the changes

Run these commands to understand what has changed:

```bash
# Uncommitted working-tree + staged changes
git diff HEAD

# Commits on this branch not yet on main (if on a feature branch)
git log main..HEAD --oneline

# Summary of touched files
git diff HEAD --name-status
```

Read the output and identify:
- New user-facing features (routes, components, capabilities)
- Improvements to existing behavior
- Bug fixes
- Breaking changes (API changes, data migrations, removed features)

---

## Step 2 — Determine the semver bump

| What's in the diff | Bump |
|--------------------|------|
| Any `breaking` change | **major** (X.0.0) |
| Any new `feature`, no breaking | **minor** (x.Y.0) |
| Only `improvement` / `bugfix` | **patch** (x.y.Z) |

Read the current version from `src/client/hooks/useAppShell.ts`:
```typescript
const CURRENT_VERSION = '1.12.0'; // bump this
```

Calculate the new version. When in doubt, ask the user to confirm before writing.

---

## Step 3 — Draft the changelog entries

Use the change types below. Write descriptions from a **user perspective** — what can they now do, or what was broken that now works.

| Type | Icon | Use for |
|------|------|---------|
| `feature` | ✨ | New capability the user didn't have before |
| `improvement` | 🚀 | Enhancement to something that already existed |
| `bugfix` | 🐛 | Something broken that now works |
| `breaking` | ⚠️ | Removed/changed something that requires user action |

**Good descriptions:**
- "Added resizable Details Panel with drag-to-resize functionality"
- "What's New modal now opens automatically on first visit after a new release"
- "Fixed issue where tags weren't loading on work items"

**Poor descriptions (reject these):**
- "Fixed bug", "Updated stuff", "Changes"

Group logically related changes into a single entry with a clear `title` (3-6 words describing the release theme).

---

## Step 4 — Write the files

### `public/CHANGELOG.json`

Prepend the new entry at position `[0]`. Do **not** remove existing entries.

```json
[
  {
    "version": "<new-version>",
    "date": "<YYYY-MM-DD today>",
    "title": "<release theme, 3-6 words>",
    "changes": [
      { "type": "feature",     "description": "..." },
      { "type": "improvement", "description": "..." },
      { "type": "bugfix",      "description": "..." }
    ]
  },
  ...existing entries...
]
```

### `src/client/hooks/useAppShell.ts`

Update only the one constant:

```typescript
const CURRENT_VERSION = '<new-version>';
```

---

## Step 5 — Verify

1. Confirm JSON is valid (no trailing commas, correct brackets).
2. Confirm the version string in `useAppShell.ts` matches the top entry in `CHANGELOG.json`.
3. Tell the user what version was set and show them the drafted entry for approval before writing, if the scope is large or ambiguous.

---

## Handling ambiguous scope

If the diff is large (10+ files) or spans multiple features, ask the user:

> "I see changes across X, Y, and Z. Should I group these into one release entry, or split into separate versions?"

Default: one new version entry per skill invocation unless the user says otherwise.
