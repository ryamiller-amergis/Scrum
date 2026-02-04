# Unit Tests for Version 1.6.0

This directory contains comprehensive unit tests for the changes introduced in version 1.6.0.

## Test Coverage

### Server-Side Tests

#### 1. Release Management API Tests (`releaseManagement.test.ts`)
Tests for the new release management endpoints:
- ✅ `DELETE /api/releases/:epicId` - Delete release epic
  - Successfully deletes epic with valid ID
  - Returns 400 for invalid epic ID
  - Handles deletion errors gracefully
  - Works with/without project and areaPath parameters
- ✅ `GET /api/releases` - Fetch release versions
  - Returns array of release versions
  - Handles empty results
  - Error handling
- ✅ `GET /api/releases/epics` - Fetch release epics with progress
- ✅ `PATCH /api/releases/:epicId` - Update release epic
- ✅ `POST /api/releases/:epicId/link` - Link work items to epic
  - Validates work item IDs array
  - Handles linking errors

#### 2. Azure DevOps Service Tests (`azureDevOpsDelete.test.ts`)
Tests for the new deleteWorkItem method:
- ✅ Successfully deletes work items
- ✅ Handles deletion errors
- ✅ Implements retry logic for transient failures
- ✅ Works with different projects
- ✅ Handles permission errors
- ✅ Extracts release versions from tags
- ✅ Handles missing or empty tags

### Client-Side Tests

#### 3. Release View Delete Tests (`ReleaseView.delete.test.tsx`)
Tests for the new delete epic functionality:
- ✅ Renders delete button in action menu
- ✅ Opens delete confirmation modal
- ✅ Successfully deletes epic when confirmed
- ✅ Closes modal when cancel is clicked
- ✅ Handles delete errors with user feedback
- ✅ Disables buttons during deletion
- ✅ Refreshes epic list after deletion

#### 4. App Planning View Tests (`App.planning.test.tsx`)
Tests for the Analytics → Planning rename:
- ✅ Renders "Planning" button instead of "Analytics"
- ✅ Switches to Planning view correctly
- ✅ Renders all tabs with standardized names:
  - "Cycle Time" (not "Cycle Time Analytics")
  - "Developer Stats" (not "Developer Statistics")
  - "QA Metrics" (not "QA Analytics")
  - "Roadmap"
  - "Releases"
- ✅ Switches between planning tabs
- ✅ Toggles between Calendar and Planning views
- ✅ Uses correct CSS classes:
  - `.planning-view` (not `.analytics-view`)
  - `.planning-tabs` (not `.analytics-tabs`)
  - `.planning-content` (not `.analytics-content`)
- ✅ Shows QA Metrics placeholder

## Running Tests

### Run all tests
```bash
npm test
```

### Run server tests only
```bash
npm test -- --selectProjects=server
```

### Run client tests only
```bash
npm test -- --selectProjects=client
```

### Run specific test file
```bash
npm test -- releaseManagement.test.ts
```

### Run with coverage
```bash
npm test -- --coverage
```

### Watch mode
```bash
npm test -- --watch
```

## Test Dependencies

- **jest**: Test runner and assertion library
- **ts-jest**: TypeScript support for Jest
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Custom DOM matchers
- **@testing-library/user-event**: User interaction simulation
- **supertest**: HTTP assertion library for API tests
- **jest-environment-jsdom**: DOM environment for React tests

## Test Structure

```
src/
├── client/
│   └── components/
│       └── __tests__/
│           ├── App.planning.test.tsx
│           └── ReleaseView.delete.test.tsx
├── server/
│   └── __tests__/
│       ├── api.test.ts (existing)
│       ├── azureDevOps.test.ts (existing)
│       ├── releaseManagement.test.ts (new)
│       └── azureDevOpsDelete.test.ts (new)
└── setupTests.ts
```

## Configuration

Tests are configured in:
- `jest.config.js` - Main Jest configuration with separate projects for server/client
- `src/setupTests.ts` - Test environment setup (mocks, polyfills)
- `tsconfig.*.json` - TypeScript configuration for different environments

## CI/CD Integration

These tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test -- --ci --coverage --maxWorkers=2
```

## Notes

- Server tests use Node environment
- Client tests use jsdom environment for DOM simulation
- CSS imports are mocked using identity-obj-proxy
- All tests follow AAA pattern (Arrange, Act, Assert)
- Mocks are cleared between tests to prevent state leakage
