# Authentication Implementation Summary

## What Was Added

### 1. Server-Side Changes

**New Dependencies:**
- `express-session` - Session management
- `passport` - Authentication middleware
- `passport-azure-ad` - Azure AD OIDC strategy
- `connect-ensure-login` - Route protection helper

**New Files:**
- `src/server/middleware/auth.ts` - Authentication middleware
- `src/server/routes/auth.ts` - Authentication routes (/login, /callback, /logout, /status)

**Modified Files:**
- `src/server/index.ts` - Added session configuration and passport initialization

### 2. Client-Side Changes

**New Files:**
- `src/client/components/Login.tsx` - Login page component
- `src/client/components/Login.css` - Login page styling

**Modified Files:**
- `src/client/App.tsx` - Added authentication check on mount, shows login page if not authenticated

### 3. Configuration Files

**Modified:**
- `.env` - Added Azure AD configuration variables with setup instructions
- `.github/workflows/deploy.yml` - Added authentication environment variables

**New:**
- `AUTHENTICATION_SETUP.md` - Detailed setup guide for Azure AD app registration

## Required Setup Steps

### Using Existing Service Principal (Recommended - Simpler!)

Your GitHub Actions pipeline already has a service principal configured. You can reuse it!

**1. Configure the existing app registration** (5 minutes):
   - Go to Azure Portal → Azure AD → App registrations
   - Find your existing app (clientId from AZURE_CREDENTIALS secret)
   - Add redirect URIs under Authentication:
     - Dev: `http://localhost:3001/auth/callback`
     - Prod: `https://app-scrum-dev.azurewebsites.net/auth/callback`
   - Add delegated API permissions: User.Read, Azure DevOps user_impersonation
   - Grant admin consent

**2. Update local .env file:**
   - Extract clientId, clientSecret, tenantId from your GitHub `AZURE_CREDENTIALS` secret
   - Add them to .env as AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
   - Generate SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**3. Add only 2 GitHub Secrets:**
   - `AZURE_REDIRECT_URL` = `https://app-scrum-dev.azurewebsites.net/auth/callback`
   - `SESSION_SECRET` = (different value from dev)
   
The pipeline automatically extracts tenant/client/secret from existing AZURE_CREDENTIALS!

---

### Alternative: Create New Separate App

If you prefer separate apps for deployment vs authentication, see detailed steps in AUTHENTICATION_SETUP.md

### For Development (Local)

### For Development (Local)

1. **Get credentials from your GitHub AZURE_CREDENTIALS secret**:
   - Go to GitHub repo → Settings → Secrets → AZURE_CREDENTIALS
   - Extract: clientId, clientSecret, tenantId

2. **Configure the app registration** (see above)

3. **Update .env file**:
3. **Update .env file**:
   ```env
   AZURE_TENANT_ID=from-AZURE_CREDENTIALS-secret
   AZURE_CLIENT_ID=from-AZURE_CREDENTIALS-secret
   AZURE_CLIENT_SECRET=from-AZURE_CREDENTIALS-secret
   AZURE_REDIRECT_URL=http://localhost:3001/auth/callback
   SESSION_SECRET=generate-random-secret
   ```

4. **Generate Session Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### For Production (Azure Deployment)

1. **Add production redirect URI** in Azure AD App Registration:
   - `https://app-scrum-dev.azurewebsites.net/auth/callback` (or your domain)
only 2 new GitHub Secrets** (Settings → Secrets and variables → Actions → Secrets):
   - `AZURE_REDIRECT_URL` - Production URL (e.g., https://app-scrum-dev.azurewebsites.net/auth/callback)
   - `SESSION_SECRET` - Random secret for production (different from dev)

**Note:** The pipeline automatically extracts `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` from your existing `AZURE_CREDENTIALS` secret, so you don't need to add them separately!rum-dev.azurewebsites.net/auth/callback)
   - `SESSION_SECRET` - Random secret for production (different from dev)

## How It Works

### Authentication Flow

1. User visits application → App checks `/auth/status`
2. If not authenticated → Shows Login page
3. User clicks "Sign in with Azure DevOps" → Redirects to `/auth/login`
4. Server redirects to Azure AD login
5. User signs in with organizational account
6. Azure AD redirects back to `/auth/callback` with auth code
7. Server exchanges code for access token
8. User session created (24 hour cookie)
9. User redirected to main app
10. All API routes protected with `ensureAuthenticated` middleware

### Protected Routes

All `/api/*` routes now require authentication:
- `/api/workitems` - Get work items
- `/api/workitems/:id/due-date` - Update due date
- `/api/due-date-stats` - Get statistics
- `/api/cycle-time` - Calculate cycle time
- `/api/health` - Health check

### Public Routes

- `/auth/login` - Initiate login
- `/auth/callback` - OAuth callback
- `/auth/logout` - Sign out
- `/auth/status` - Check authentication status
- Static files (HTML, CSS, JS)

## Testing Authentication

1. Start dev server: `npm run dev`
2. Visit http://localhost:5173
3. Should see login page
4. Click "Sign in with Azure DevOps"
5. Sign in with organizational account
6. Should redirect to main app after successful login

## Troubleshooting

### Common Issues

**"Reply URL mismatch" error:**
- Check AZURE_REDIRECT_URL matches Azure AD exactly
- Check for http vs https, trailing slashes

**Session not persisting:**
- Verify SESSION_SECRET is set
- Check browser cookies are enabled
- In dev, make sure cookie.secure is false

**Can't access API after login:**
- Check that authentication middleware is working
- Verify session is being created (check browser dev tools → Application → Cookies)
- Check server logs for passport authentication errors

**Azure AD permission errors:**
- Make sure API permissions were granted (admin consent may be required)
- Verify user has access to Azure DevOps organization

## Security Considerations

- ✅ All API routes protected by authentication
- ✅ Sessions expire after 24 hours
- ✅ HTTPS enforced in production (cookie.secure = true)
- ✅ CSRF protection via session cookies
- ⚠️ Never commit .env or real credentials to git
- ⚠️ Use different SESSION_SECRET for each environment
- ⚠️ Rotate Azure AD client secrets periodically (they expire)
- ⚠️ Review API permissions - use minimum required scope

## Next Steps

1. Complete Azure AD app registration
2. Update .env with real credentials
3. Test locally
4. Add GitHub secrets for production
5. Deploy and test in production
6. Consider adding:
   - Logout button in the UI
   - User profile display
   - Token refresh logic for long sessions
   - Role-based access control (RBAC)
