# Azure AD Authentication Setup Guide

This application uses Azure Active Directory (Azure AD) for authentication before allowing access to the Azure DevOps data.

**Good News:** You can reuse the same Azure AD app registration (service principal) that's already configured in your GitHub Actions deployment pipeline!

## Quick Setup - Using Existing Service Principal

### 1. Get Your Existing Credentials from GitHub

Your `AZURE_CREDENTIALS` secret already contains:
- `clientId` → This is your `AZURE_CLIENT_ID`
- `clientSecret` → This is your `AZURE_CLIENT_SECRET`  
- `tenantId` → This is your `AZURE_TENANT_ID`

To view them:
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → Secrets
3. Click on `AZURE_CREDENTIALS` (you'll need to decode the JSON)

The JSON format is:
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "your-secret-value",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 2. Configure the Existing App Registration

You need to add web authentication capabilities to your existing app:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Find your existing app (the one with the `clientId` from above)
4. Click on **Authentication** in the left menu
5. Click **Add a platform** > **Web**
6. Add redirect URIs:
   - For development: `http://localhost:3001/auth/callback`
   - For production: `https://app-scrum-dev.azurewebsites.net/auth/callback` (or your production URL)
7. Under **Implicit grant and hybrid flows**, check:
   - ✅ ID tokens (used for implicit and hybrid flows)
8. Click **Save**

### 3. Add Required API Permissions

Your app needs delegated permissions for user sign-in:

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** > **Delegated permissions**
4. Add:
   - `User.Read` - Read user profile
   - `email` - Read user email
   - `openid` - Sign in
   - `profile` - Read user profile
5. Click **Add permissions**
6. Click **Add a permission** again
7. Select **Azure DevOps** (or search for it) > **Delegated permissions**
8. Add:
   - `user_impersonation` - Access Azure DevOps on behalf of user
9. Click **Add permissions**
10. Click **Grant admin consent** (if you have admin rights, or ask your admin)

### 4. Update Your Local .env File

Copy the values from your `AZURE_CREDENTIALS` secret:

```env
AZURE_TENANT_ID=your-tenant-id-from-AZURE_CREDENTIALS
AZURE_CLIENT_ID=your-client-id-from-AZURE_CREDENTIALS
AZURE_CLIENT_SECRET=your-client-secret-from-AZURE_CREDENTIALS
AZURE_REDIRECT_URL=http://localhost:3001/auth/callback
SESSION_SECRET=generate-a-random-secret-key
```

Generate a random session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Add GitHub Secrets (Production Only)

You only need to add 2 new secrets:

1. Go to GitHub repository → Settings → Secrets and variables → Actions → Secrets
2. Add:
   - `AZURE_REDIRECT_URL` = `https://app-scrum-dev.azurewebsites.net/auth/callback`
   - `SESSION_SECRET` = (generate with the command above, use a different value than dev)

**Note:** The pipeline will automatically extract `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` from your existing `AZURE_CREDENTIALS` secret!

## Alternative: Create a New App Registration

If you prefer to keep deployment and authentication separate, follow these steps:

## Alternative: Create a New App Registration

If you prefer to keep deployment and authentication separate, follow these steps:

### 1. Register a New Application in Azure AD

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**

- **Name**: AI Pilot Auth (or your preferred name)
- **Supported account types**: "Accounts in this organizational directory only"
- **Redirect URI**: 
  - Platform: Web
  - URL: `http://localhost:3001/auth/callback` (for development)

Click **Register**

### 2. Get Application IDs

### 2. Get Application IDs

After registration, you'll see the **Overview** page:
- Copy the **Application (client) ID** → This is your `AZURE_CLIENT_ID`
- Copy the **Directory (tenant) ID** → This is your `AZURE_TENANT_ID`

### 3. Create a Client Secret

### 3. Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description (e.g., "AI Pilot Auth Secret")
4. Choose an expiration period
5. Click **Add**
6. **IMPORTANT**: Copy the secret **Value** immediately → This is your `AZURE_CLIENT_SECRET`
   (You won't be able to see it again!)

### 4. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** > **Delegated permissions**
4. Add these permissions:
   - `User.Read` (to read user profile)
   - `email`
   - `openid`
   - `profile`
5. Click **Add permissions**
6. Click **Add a permission** again
7. Select **Azure DevOps** > **Delegated permissions**
8. Add:
   - `user_impersonation` (allows access to Azure DevOps as the signed-in user)
9. Click **Grant admin consent** (if you have admin rights)

### 5. Update .env File with New Appconsent** (if you have admin rights)

### 5. Update .env File with New App

Update your `.env` file with the values you collected:

```env
AZURE_TENANT_ID=your-new-tenant-id-from-step-2
AZURE_CLIENT_ID=your-new-client-id-from-step-2
AZURE_CLIENT_SECRET=your-new-client-secret-from-step-3
AZURE_REDIRECT_URL=http://localhost:3001/auth/callback
SESSION_SECRET=generate-a-random-secret-key-here
```

For `SESSION_SECRET`, generate a random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Add Separate GitHub Secrets

If using a separate app, add these secrets:
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_REDIRECT_URL`
- `SESSION_SECRET`

---

## Testing Authenticationur production environment has all the required environment variables set

## How It Works

1. User visits the application
2. App checks if user is authenticated via `/auth/status` endpoint
3. If not authenticated, shows login page
4. User clicks "Sign in with Azure DevOps"
5. Redirects to Azure AD login
6. User signs in with their organizational account
7. Azure AD redirects back to `/auth/callback` with authorization code
8. Server exchanges code for access token
9. User is authenticated and can access the application
10. Session is stored for 24 hours

## Testing

1. Start the development server: `npm run dev`
2. Open browser to `http://localhost:5173`
3. You should see the login page
4. Click "Sign in with Azure DevOps"
5. Sign in with your organizational account
6. After successful login, you'll be redirected to the main application

## Troubleshooting

### "AADSTS50011: The reply URL specified in the request does not match"
- Make sure the redirect URI in your .env matches exactly what's configured in Azure AD
- Check for trailing slashes and http vs https

### "AADSTS700016: Application not found"
- Verify `AZURE_CLIENT_ID` is correct
- Make sure you're using the Application (client) ID, not Object ID

### Session not persisting
- Make sure cookies are enabled in your browser
- Check that `SESSION_SECRET` is set
- In development, make sure `cookie.secure` is set to false

### Can't access Azure DevOps data
- Make sure you've granted the Azure DevOps API permission
- Verify the user signing in has access to the Azure DevOps organization
- Check that `ADO_PAT` is still valid in your .env

## Security Notes

- Never commit `.env` file with real credentials to git
- Use different `SESSION_SECRET` for production
- Client secrets expire - set a reminder to rotate them
- Enable MFA for accounts accessing the application
- Review and minimize API permissions regularly
