# Scrum Calendar - Azure DevOps PBIs

A minimal single-page web application for visualizing and managing Azure DevOps Product Backlog Items (PBIs) on a calendar interface.

## Features

- **Calendar Views**: Switch between month and week views
- **Drag & Drop**: Move PBIs between dates to update their due dates
- **Unscheduled List**: View and manage PBIs without due dates
- **Real-time Sync**: Auto-refresh every 30 seconds to sync with Azure DevOps changes
- **Color-coded States**: Visual indicators for different PBI states (New, Active, Resolved, Closed)

## Prerequisites

- Node.js (v14 or higher)
- Azure DevOps Personal Access Token (PAT) with work item read/write permissions

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI-Pilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Azure DevOps connection**
   
   Create a `.env` file in the root directory (use `.env.example` as template):
   ```
   ADO_ORGANIZATION=your-organization
   ADO_PROJECT=your-project
   ADO_PAT=your-personal-access-token
   PORT=3000
   ```

   To get your Azure DevOps PAT:
   - Go to https://dev.azure.com/{your-organization}
   - Click on User Settings (top right) > Personal Access Tokens
   - Create a new token with "Work Items (Read & Write)" scope

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the application**
   
   Navigate to `http://localhost:3000` in your browser

## Usage

### Viewing PBIs
- The calendar displays all PBIs with due dates set in Azure DevOps
- PBIs without due dates appear in the "Unscheduled" sidebar
- Switch between month and week views using the buttons in the header

### Updating Due Dates
- Drag any PBI and drop it on a different date to update its due date
- Drag a PBI to the "Unscheduled" sidebar to remove its due date
- Changes are immediately saved to Azure DevOps

### Navigation
- Use "Previous" and "Next" buttons to navigate through dates
- Click "Today" to return to the current date
- Click "Refresh" to manually sync with Azure DevOps

### Auto-refresh
- The application automatically polls Azure DevOps every 30 seconds
- This ensures changes made in Azure DevOps are reflected in the calendar
- Last update time is shown in the header

## Architecture

### Backend (server.js)
- Express.js server that proxies requests to Azure DevOps REST API
- Handles authentication using server-side PAT (keeps token secure)
- Endpoints:
  - `GET /api/pbis` - Fetch all PBIs with due dates
  - `PATCH /api/pbis/:id` - Update PBI due date

### Frontend (public/index.html)
- Single-page application with vanilla JavaScript
- No build process required
- Features:
  - Calendar rendering (month/week views)
  - Drag-and-drop interface
  - Automatic polling for updates
  - Responsive design

## Security Notes

- **Never commit your `.env` file** - it contains your PAT
- The PAT is stored server-side and never exposed to the browser
- All Azure DevOps API calls go through the backend server
- For production deployment, see [SECURITY.md](SECURITY.md) for important security recommendations including rate limiting and authentication

## Troubleshooting

**PBIs not loading**
- Verify your `.env` file is configured correctly
- Check that your PAT has the required permissions
- Ensure your organization and project names are correct

**Drag and drop not working**
- Make sure you're using a modern browser (Chrome, Firefox, Edge, Safari)
- Check browser console for errors

**Changes not syncing**
- Wait for the auto-refresh (30 seconds)
- Click the "Refresh" button to force an update
- Verify your PAT has write permissions for work items

## License

MIT
