# Release Management Module

## Overview

The Release Management module provides comprehensive tools for planning, tracking, and deploying releases within your Azure DevOps workflow. It enables teams to group Features and Epics into versioned releases, track deployment status across environments, and generate release notes.

## Features

### 1. **Release Planning**
- Create versioned releases (e.g., v1.0.0, 2024-Q1)
- Tag Features and Epics with release versions using Azure DevOps tags
- Group work items by release for easy tracking
- Visual release selector for quick navigation

### 2. **Release Metrics Dashboard**
- **Total Features**: Count of all Features/Epics in the release
- **Completed**: Items in "Ready For Release", "UAT - Test Done", "Done", or "Closed" states
- **In Progress**: Active development and testing states
- **Blocked**: Items in blocked state requiring attention
- **Ready for Release**: Items specifically in "Ready For Release" state
- **Health Status**: Automatic calculation (on-track, at-risk, blocked)

### 3. **Progress Tracking**
- Visual progress bar showing completion percentage
- Real-time calculation based on work item states
- Health indicators to identify risks early

### 4. **Deployment Tracking**
- Manual deployment logging across three environments:
  - **Development**: Dev/test environment
  - **Staging**: Pre-production environment
  - **Production**: Live production environment
- Track deployment history with timestamps
- Record who deployed and when
- Optional deployment notes

### 5. **Release Notes Generation**
- Automatic generation from tagged work items
- Two export formats:
  - **JSON**: Structured data for programmatic use
  - **Markdown**: Human-readable format for documentation
- Groups items by type (Features, Epics, Bugs)
- Includes work item IDs, titles, and states

### 6. **Work Items List**
- Tabular view of all Features/Epics in the release
- Click to view details in the Details Panel
- Shows ID, type, title, state, assignee, and target date
- Color-coded state badges for quick status identification

## Technical Architecture

### Data Model

#### Release Tags (Azure DevOps)
- Format: `Release:v1.0.0`
- Stored in `System.Tags` field
- Applied to Features and Epics
- Queryable via WIQL

#### Deployment Records (JSON Storage)
- Stored in: `public/deployments.json`
- Schema:
```typescript
{
  id: string;              // UUID
  releaseVersion: string;  // e.g., "v1.0.0"
  environment: 'dev' | 'staging' | 'production';
  workItemIds: number[];   // Array of ADO work item IDs
  deployedBy: string;      // User display name
  deployedAt: string;      // ISO timestamp
  notes?: string;          // Optional deployment notes
}
```

### API Endpoints

#### Release Management

- **GET /api/releases**
  - Returns all unique release versions
  - Query params: `project`, `areaPath`

- **GET /api/releases/:version/workitems**
  - Returns all work items tagged with the release version
  - Query params: `project`, `areaPath`

- **GET /api/releases/:version/metrics**
  - Returns calculated metrics for the release
  - Includes deployment history

- **POST /api/releases/:version/tag**
  - Add release tag to work items
  - Body: `{ workItemIds: number[], project?, areaPath? }`

- **DELETE /api/releases/:version/tag/:workItemId**
  - Remove release tag from a work item
  - Query params: `project`, `areaPath`

- **GET /api/releases/:version/notes**
  - Generate release notes
  - Query params: `project`, `areaPath`, `format` (json | markdown)

#### Deployment Tracking

- **POST /api/deployments**
  - Create a new deployment record
  - Body: `{ releaseVersion, environment, workItemIds, notes? }`

- **GET /api/deployments**
  - Get deployments with optional filters
  - Query params: `releaseVersion`, `environment`, `limit`

- **GET /api/deployments/:releaseVersion/latest**
  - Get latest deployment for each environment

### Services

#### AzureDevOpsService (Extended)
- `getReleaseVersions()`: Extract all release tags from work items
- `getWorkItemsByRelease(version)`: Query work items by release tag
- `getReleaseMetrics(version)`: Calculate release health metrics
- `addReleaseTag(workItemId, version)`: Add release tag to work item
- `removeReleaseTag(workItemId, version)`: Remove release tag

#### DeploymentTrackingService (New)
- `createDeployment()`: Log a new deployment
- `getDeploymentsByRelease()`: Get deployment history for release
- `getDeploymentsByEnvironment()`: Filter by environment
- `getLatestDeploymentsByRelease()`: Get current deployment status
- `getDeploymentHistory()`: Get recent deployments across all releases

## User Workflows

### Creating a Release

1. Click **"+ New Release"** button
2. Enter release version (e.g., `v1.0.0`)
3. Select Features/Epics to include from the list
4. Click **"Create Release"**
5. Work items are tagged with `Release:v1.0.0` in Azure DevOps

### Tracking Release Progress

1. Select release from dropdown
2. View metrics dashboard:
   - Check completion percentage
   - Monitor blocked items
   - Assess health status
3. Click on work items to see details
4. Use existing workflow tools (calendar, roadmap) to manage items

### Recording a Deployment

1. Select the release
2. Click **"Record Deployment"**
3. Choose environment (dev/staging/production)
4. Add optional deployment notes
5. Click **"Create Deployment"**
6. Deployment is logged with timestamp and user

### Generating Release Notes

1. Select the release
2. Click **"Download Markdown"** or **"Download JSON"**
3. File downloads with format: `release-v1.0.0-notes.md`
4. Use in documentation, emails, or change management

## Integration Points

### With Existing Features

- **Calendar View**: Continue scheduling work items with due dates
- **Roadmap View**: Visualize release timeline alongside epics
- **Details Panel**: Edit work item details including release tags
- **Cycle Time Analytics**: Track velocity within releases
- **Dev Stats**: Monitor developer performance per release

### With Azure DevOps

- **Tags**: Release versions stored as ADO tags (searchable in ADO)
- **Work Items**: All queries respect project/area path filters
- **States**: Uses existing workflow states for metrics calculation
- **History**: Tag changes tracked in ADO history

## Best Practices

### Release Naming Conventions

- **Semantic Versioning**: `v1.0.0`, `v2.1.3`
- **Date-based**: `2024-Q1`, `2024-02`
- **Named Releases**: `Winter-Release`, `Launch-v1`

### Workflow Recommendations

1. **Plan Early**: Create release and tag Features at sprint planning
2. **Monitor Health**: Check release dashboard daily
3. **Progressive Deployment**: Deploy to dev → staging → production
4. **Document Deployments**: Always add notes about special configurations
5. **Generate Notes Early**: Preview release notes before deployment

### State Management

#### Completed States (for metrics)
- Ready For Release
- UAT - Test Done
- Done
- Closed

#### In Progress States
- Committed
- In Progress
- Ready For Test
- In Test
- UAT - Ready For Test

#### Blocked States
- Blocked

## Future Enhancements

### Potential Features (Not Implemented)

1. **Release Approval Workflow**
   - Stakeholder sign-off tracking
   - Required approvals before deployment
   - Approval history and audit trail

2. **CI/CD Integration**
   - Webhook support for automated deployment logging
   - Integration with Azure DevOps Pipelines
   - Automatic deployment detection

3. **Release Burndown Charts**
   - Time-series graph of completion over time
   - Sprint-to-release progress tracking
   - Velocity metrics per release

4. **Dependency Tracking**
   - Feature dependencies within release
   - Cross-release dependencies
   - Blocking relationships visualization

5. **Environment Configuration**
   - Customizable environment names
   - Environment-specific metadata
   - Rollback tracking

6. **Advanced Metrics**
   - Lead time from commit to production
   - Mean time to recovery (MTTR)
   - Deployment frequency
   - Change failure rate

## Troubleshooting

### Release Not Showing Up

**Issue**: Created release but it's not in the dropdown

**Solution**:
- Verify work items have the correct tag format: `Release:v1.0.0`
- Check that work items are Features or Epics (not PBIs/TBIs)
- Ensure work items match current project/area path filter

### Deployment Not Recording

**Issue**: Deployment modal submits but nothing happens

**Solution**:
- Check browser console for errors
- Verify `public/deployments.json` has write permissions
- Ensure user session is active (not logged out)

### Metrics Not Calculating

**Issue**: Release shows 0 features or incorrect counts

**Solution**:
- Verify Azure DevOps connection is active
- Check that work item states match expected values
- Refresh the page to reload data

### Release Notes Empty

**Issue**: Download contains no work items

**Solution**:
- Ensure work items are properly tagged
- Check project/area path filters
- Verify work items are Features, Epics, or Bugs

## File Changes

### New Files Created
- `src/client/components/ReleaseView.tsx` - Main release management component
- `src/client/components/ReleaseView.css` - Styling for release view
- `src/server/services/deploymentTracking.ts` - Deployment tracking service
- `public/deployments.json` - Deployment data storage

### Modified Files
- `src/client/App.tsx` - Added "Releases" tab to analytics
- `src/client/types/workitem.ts` - Added Release, Deployment types
- `src/server/types/workitem.ts` - Added server-side types
- `src/server/services/azureDevOps.ts` - Added release query methods
- `src/server/routes/api.ts` - Added release and deployment endpoints
- `package.json` - Added uuid dependency

## Summary

The Release Management module provides a complete solution for managing software releases within the Scrum Calendar application. It leverages Azure DevOps tags for lightweight release grouping, provides comprehensive metrics and tracking, and integrates seamlessly with existing workflow tools. The manual deployment logging approach gives teams flexibility while maintaining a clear audit trail of what's deployed where.
