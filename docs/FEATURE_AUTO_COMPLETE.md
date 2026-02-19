# Feature Auto-Complete Background Service

## Overview

The Feature Auto-Complete service is a background job that runs every 15 minutes to automatically update Feature work items to "Done" status when all their child items (PBIs, TBIs, Bugs) are in completed states.

## How It Works

### Automatic Execution
- **Frequency**: Runs every 15 minutes
- **Start**: Automatically starts when the server starts
- **Scope**: Checks all teams/projects configured in `VITE_TEAMS` environment variable

### Completion Criteria
A Feature is automatically set to "Done" when ALL of its child items are in one of these states:
- `Ready For Release`
- `UAT - Test Done`
- `Done`
- `Closed`

### What Gets Updated
- **Work Item Type**: Features only
- **Current State**: Only Features that are NOT already in `Done` or `Closed`
- **Field Updated**: `System.State` → `Done`

## Configuration

No additional configuration is needed. The service uses the existing environment variables:
- `VITE_TEAMS`: Defines which projects/area paths to monitor
- `ADO_ORG`: Azure DevOps organization URL
- `ADO_PAT`: Personal Access Token for authentication

## Manual Trigger (Testing/Admin)

You can manually trigger a check using the API endpoint:

```bash
POST /api/admin/trigger-feature-check
```

Example:
```bash
curl -X POST http://localhost:3001/api/admin/trigger-feature-check \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=<your-session-cookie>"
```

## Logging

The service provides detailed logging for monitoring:

```
[FeatureAutoComplete] Starting service - checking every 15 minutes
[FeatureAutoComplete] Starting feature check at 2026-02-03T10:00:00.000Z
[FeatureAutoComplete] Found 5 features to check in MaxView/MaxView
[FeatureAutoComplete] Feature 37311 - All 3 children are complete. Updating to Done.
[FeatureAutoComplete] Successfully updated Feature 37311 to Done
[FeatureAutoComplete] Check completed in 2341ms - Checked: 5, Updated: 1
```

## Service Lifecycle

### Startup
The service starts automatically when the server starts:
```typescript
const featureAutoComplete = getFeatureAutoCompleteService();
featureAutoComplete.start();
```

### Graceful Shutdown
To stop the service (if needed):
```typescript
const featureAutoComplete = getFeatureAutoCompleteService();
featureAutoComplete.stop();
```

## Performance Considerations

- **Debouncing**: Only one check runs at a time; subsequent triggers are skipped if a check is in progress
- **Batching**: Processes all teams in a single execution cycle
- **Error Handling**: Team-level errors don't stop the entire check; each team is processed independently
- **Lightweight**: Only queries Features that aren't already Done/Closed

## Error Handling

The service includes comprehensive error handling:
- Team-level errors are logged but don't stop other teams from being checked
- Feature-level errors are logged but don't stop other features from being processed
- Network/API errors trigger retries via the existing `retryWithBackoff` utility

## Testing

To test the service:

1. **Create a test scenario**:
   - Create a Feature with child PBIs/Bugs
   - Set all children to "Ready For Release" or "Done"
   - Ensure the Feature is NOT in "Done" state

2. **Trigger manually**:
   ```bash
   POST /api/admin/trigger-feature-check
   ```

3. **Check logs**:
   - Look for `[FeatureAutoComplete]` log entries
   - Verify the Feature was updated to "Done"

4. **Verify in Azure DevOps**:
   - Check the Feature's state
   - Review the work item history for the state change

## Files Modified/Created

- `src/server/services/featureAutoComplete.ts` - New service implementation
- `src/server/index.ts` - Integration with server startup
- `src/server/routes/api.ts` - Manual trigger endpoint
