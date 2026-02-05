# Azure Cost Setup

This document explains how to set up Azure credentials to enable the Cloud Cost module to fetch real Azure subscriptions and resource groups.

## Prerequisites

The application uses Azure SDK for JavaScript to interact with Azure Resource Manager APIs. You need to provide Azure credentials that have permission to:
- List subscriptions
- List resource groups in subscriptions

**Required NPM Packages**:
- `@azure/identity` - For authentication
- `@azure/arm-resources-subscriptions` - For listing subscriptions  
- `@azure/arm-resources` - For listing resource groups

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Azure Credentials for Cost Management
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

## Getting Azure Credentials

### Option 1: Use Existing Service Principal

If you already have a service principal (like the one used for deployment), you can reuse those credentials:

1. Your GitHub `AZURE_CREDENTIALS` secret contains these values
2. Extract them and add to your `.env` file

### Option 2: Create a New Service Principal

1. **Create a service principal**:
```bash
az ad sp create-for-rbac --name "ai-pilot-cost-reader" \
  --role "Reader" \
  --scopes /subscriptions/{subscription-id}
```

2. **The command will output**:
```json
{
  "appId": "your-client-id",
  "displayName": "ai-pilot-cost-reader",
  "password": "your-client-secret",
  "tenant": "your-tenant-id"
}
```

3. **Add to `.env`**:
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id (appId from above)
AZURE_CLIENT_SECRET=your-client-secret (password from above)
```

### Option 3: Grant Access to Multiple Subscriptions

If you want to access multiple subscriptions:

```bash
# For each subscription
az ad sp create-for-rbac --name "ai-pilot-cost-reader" \
  --role "Reader" \
  --scopes /subscriptions/{subscription-id-1} /subscriptions/{subscription-id-2}
```

## Required Azure Permissions

The service principal needs **Reader** role at minimum on:
- Subscriptions you want to view
- Resource groups within those subscriptions

## API Endpoints

Once configured, the application provides these endpoints:

- `GET /api/azure/subscriptions` - List all accessible subscriptions
- `GET /api/azure/subscriptions/:id/resource-groups` - List resource groups in a subscription
- `GET /api/azure/subscriptions-with-resource-groups` - Get all subscriptions with their resource groups

## Testing

To test if your credentials work:

1. Start the server: `npm run dev:server`
2. In another terminal, test the API:
```bash
curl http://localhost:3001/api/azure/subscriptions -H "Cookie: your-session-cookie"
```

## Troubleshooting

### "Azure Cost Service not initialized"
- Check that your `.env` file contains the Azure credentials
- Verify the credentials are valid by logging into Azure Portal

### "Failed to fetch Azure subscriptions"
- Ensure the service principal has Reader access to your subscriptions
- Check that the tenant ID is correct
- Verify the client ID and secret are valid

### No subscriptions returned
- The service principal may not have access to any subscriptions
- Grant Reader role to the service principal on the desired subscriptions

## Production Deployment

For production (Azure App Service), add these as Application Settings:

1. Go to Azure Portal → Your App Service → Configuration
2. Add Application Settings:
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
3. Save and restart the app service

## Security Notes

- Never commit `.env` file to source control
- Use Azure Key Vault for production secrets
- Rotate service principal secrets regularly
- Use minimum required permissions (Reader role)
