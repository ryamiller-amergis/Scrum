# Scrum Calendar

A web application for visualizing Azure DevOps Product Backlog Items (PBIs) on a calendar with two-way sync support.

## Features

- **Calendar View**: Month and week views with drag-and-drop support
- **Unscheduled List**: Side panel showing PBIs without due dates
- **Two-Way Sync**: Changes in Azure DevOps are reflected in the app within the polling interval
- **Details Panel**: Click any PBI to view details and open in Azure DevOps
- **Drag & Drop**:
  - Drag PBIs to calendar dates to set due dates
  - Drag PBIs back to unscheduled to clear due dates

## Setup

### Prerequisites

- Node.js 18+
- Azure DevOps Personal Access Token (PAT) with Work Items (Read, Write) permissions

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd AI-Pilot
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` and set your Azure DevOps configuration:

- `ADO_ORG`: Your Azure DevOps organization URL (e.g., https://dev.azure.com/yourorg)
- `ADO_PROJECT`: Your project name
- `ADO_PAT`: Your Personal Access Token
- `ADO_AREA_PATH`: (Optional) Area path to filter PBIs
- `PORT`: Server port (default: 3001)
- `POLL_INTERVAL`: Polling interval in seconds (default: 30)

### Development

Run the development server:

```bash
npm run dev
```

This starts both the backend server (port 3001) and frontend dev server (port 3000).

### Building

Build for production:

```bash
npm run build
```

Run production build:

```bash
npm start
```

### Testing

Run tests:

```bash
npm test
```

## Architecture

### Backend

- Express server with TypeScript
- Azure DevOps integration using `azure-devops-node-api`
- REST API endpoints for work item operations
- Retry logic with exponential backoff for API resilience

### Frontend

- React 18 with TypeScript
- React Big Calendar for calendar visualization
- React DnD for drag-and-drop functionality
- Polling-based sync with Azure DevOps

## API Endpoints

### GET /api/workitems

Fetch work items for a date range plus unscheduled items.

Query parameters:

- `from` (optional): Start date in YYYY-MM-DD format
- `to` (optional): End date in YYYY-MM-DD format

### PATCH /api/workitems/:id/due-date

Update the due date for a work item.

Body:

```json
{
  "dueDate": "2024-03-15" | null
}
```

### GET /api/health

Health check endpoint.

## Security

- PAT is stored server-side only and never exposed to the frontend
- All API calls are proxied through the backend
- CORS is configured for development

## License

MIT
