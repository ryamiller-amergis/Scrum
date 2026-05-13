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
- PostgreSQL 14+ (for local development)

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
- `DATABASE_URL`: PostgreSQL connection string (see Database Setup below)

### Database Setup

This project uses PostgreSQL. There are two database targets: a **local** instance for development and a **cloud** instance (Azure PostgreSQL Flexible Server) deployed via Terraform.

#### Local database (first-time setup)

1. Create the local database:

```bash
createdb -U pgadmin aipilot
# or in psql:
# CREATE DATABASE aipilot;
```

2. Create `.env.local` (this file is git-ignored):

```bash
# .env.local
DATABASE_URL=postgresql://pgadmin:yourpassword@localhost:5432/aipilot
```

Replace `yourpassword` with your local Postgres password.

3. Apply all migrations to get your local schema up to date:

```bash
npm run migrate:local:up
```

#### Running migrations locally

Always develop and test migrations against your local database first.

| Command | What it does |
|---|---|
| `npm run migrate:local:create -- <name>` | Scaffold a new `.sql` migration file |
| `npm run migrate:local:up` | Apply all pending migrations to local DB |
| `npm run migrate:local:down` | Roll back the last migration on local DB |

**Example workflow:**

```bash
# 1. Create a new migration
npm run migrate:local:create -- add-users-table

# 2. Edit the generated file in migrations/ — write your SQL
# 3. Apply it locally and verify
npm run migrate:local:up

# 4. Roll back if something is wrong
npm run migrate:local:down

# 5. Once verified, apply to the cloud dev database
npm run migrate:up
```

Migration files live in `migrations/` and are plain SQL with an up and down block.

#### Applying migrations to the cloud database

The cloud `DATABASE_URL` is set in `.env` (pointing to Azure PostgreSQL). Running without the `local:` prefix targets the cloud DB:

```bash
npm run migrate:up    # apply to cloud dev (reads DATABASE_URL from .env)
npm run migrate:down  # roll back on cloud dev
```

In production, migrations run automatically as part of the CI/CD deploy pipeline before the app starts.

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
