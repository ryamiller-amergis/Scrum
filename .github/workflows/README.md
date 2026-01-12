# GitHub Actions Deployment Setup

This workflow automatically deploys the application to Azure App Service when changes are pushed to the `main` branch.

## Prerequisites

### 1. Create Azure Service Principal

Run this command in Azure CLI to create a service principal with Contributor access to your resource group:

```bash
az ad sp create-for-rbac --name "github-actions-scrum-calendar" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-scrum-dev \
  --sdk-auth
```

Replace `<SUBSCRIPTION_ID>` with your Azure subscription ID. You can find it by running:
```bash
az account show --query id --output tsv
```

This command will output JSON credentials like:
```json
{
  "clientId": "<client-id>",
  "clientSecret": "<client-secret>",
  "subscriptionId": "<subscription-id>",
  "tenantId": "<tenant-id>",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### 2. Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the entire JSON output from step 1
6. Click **Add secret**

### 3. Configure Environment Variables in Azure

The Terraform configuration already sets up the required environment variables (ADO_ORG, ADO_PAT, ADO_PROJECT) in the App Service. If you need to update them:

```bash
az webapp config appsettings set \
  --resource-group rg-scrum-dev \
  --name app-scrum-dev \
  --settings ADO_ORG="<your-org>" ADO_PAT="<your-pat>" ADO_PROJECT="<your-project>"
```

## Workflow Triggers

The workflow runs on:
- **Push to main branch**: Automatic deployment when code is pushed
- **Manual trigger**: Via the "Actions" tab in GitHub (workflow_dispatch)

## Deployment Process

1. **Checkout code**: Gets the latest code from the repository
2. **Set up Node.js**: Installs Node.js 20.x
3. **Install dependencies**: Runs `npm ci` for clean install
4. **Build application**: Compiles TypeScript and builds client with Vite
5. **Create deployment package**: Prepares production-ready files
6. **Login to Azure**: Authenticates using service principal
7. **Deploy to Azure Web App**: Pushes the application to App Service
8. **Logout**: Cleans up Azure session

## Monitoring Deployments

1. Go to the **Actions** tab in your GitHub repository
2. Click on the latest workflow run to see deployment progress
3. Check the Azure Portal for application logs and monitoring

## Troubleshooting

### Deployment fails with authentication error
- Verify `AZURE_CREDENTIALS` secret is set correctly
- Ensure service principal has Contributor role on the resource group

### Application doesn't start after deployment
- Check Application Insights or App Service logs in Azure Portal
- Verify environment variables are set correctly
- Ensure `npm start` script works locally

### Build fails
- Run `npm run build` locally to test
- Check Node.js version matches (20.x)
