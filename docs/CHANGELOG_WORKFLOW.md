# 📝 Changelog Workflow

## Quick Start

To add a new changelog entry during development:

```bash
npm run changelog
```

This interactive script will guide you through adding changes to your changelog.

## Workflow

### During Development

1. **Start working on a feature/fix**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Develop your changes**

3. **Add to changelog**
   ```bash
   npm run changelog
   ```
   
   The script will ask:
   - Is this a new version? (Usually `n` during development)
   - Select change type (feature, improvement, bugfix, breaking)
   - Enter description
   - Add more changes if needed

4. **Commit with changelog**
   ```bash
   git add public/CHANGELOG.json
   git commit -m "feat: Add my new feature"
   ```

### Before Release

1. **Create new version entry**
   ```bash
   npm run changelog
   ```
   - Answer `y` to "Is this a new version?"
   - Enter version number (e.g., `1.4.0`)
   - Enter release title (e.g., "Enhanced User Experience")
   - Add all release changes

2. **Update version in App.tsx**
   
   Open `src/client/App.tsx` and update:
   ```typescript
   const currentVersion = '1.4.0'; // Update this line
   ```

3. **Commit and tag**
   ```bash
   git add public/CHANGELOG.json src/client/App.tsx
   git commit -m "chore: Release v1.4.0"
   git tag v1.4.0
   git push origin main --tags
   ```

## Change Types

| Type | Icon | Use For |
|------|------|---------|
| `feature` | ✨ | New functionality or capabilities |
| `improvement` | 🚀 | Enhancements to existing features |
| `bugfix` | 🐛 | Bug fixes and corrections |
| `breaking` | ⚠️ | Breaking changes requiring attention |

## Best Practices

✅ **Do:**
- Add changelog entries as you develop
- Be descriptive but concise
- Group related changes in one commit
- Update changelog before merging PRs
- Use consistent formatting

❌ **Don't:**
- Skip changelog updates
- Add entries after deployment
- Use vague descriptions
- Forget to update App.tsx version

## User Experience

When users see the changelog:
- **NEW badge** appears on user menu if version hasn't been read
- **Notification dot** pulses to draw attention
- Latest version auto-expands in modal
- All past versions are accessible

## Examples

### Good Changelog Descriptions
✅ "Added resizable Details Panel with drag-to-resize functionality"
✅ "Fixed issue where tags weren't loading on work items"
✅ "Improved performance of calendar rendering"

### Poor Changelog Descriptions
❌ "Fixed bug"
❌ "Updated stuff"
❌ "Changes"

## Manual Editing

If needed, you can manually edit `public/CHANGELOG.json`:

```json
[
  {
    "version": "1.4.0",
    "date": "2026-02-03",
    "title": "Release Title",
    "changes": [
      {
        "type": "feature",
        "description": "Description here"
      }
    ]
  }
]
```

## Troubleshooting

**Changelog not showing in app?**
- Ensure file is in `public/CHANGELOG.json`
- Check browser console for fetch errors
- Verify JSON is valid

**Notification badge not appearing?**
- Update `currentVersion` in App.tsx
- Clear browser localStorage
- Hard refresh (Ctrl+Shift+R)

**Script not running?**
- Ensure Node.js is installed
- Check file permissions
- Run from project root directory
