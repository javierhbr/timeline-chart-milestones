# Google OAuth Setup Guide

This application requires Google OAuth configuration to enable Google Sheets integration. Follow these steps:

## 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

## 2. OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" (for testing)
3. Fill in the required fields:
   - App name: "Timeline Milestones Chart"
   - User support email: your email
   - Developer contact email: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - `openid`
   - `profile`
   - `email`
5. Add test users (your email addresses)

## 3. Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Name: "Timeline Milestones Chart"
5. **Important**: Add these to "Authorized JavaScript origins":
   ```
   http://localhost:3300
   ```
6. **Important**: Add these to "Authorized redirect URIs":
   ```
   http://localhost:3300/timeline-chart-milestones/
   ```

## 4. Update Environment Variables

Copy the Client ID and update your `.env` file:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
```

## 5. Current Configuration

Your app is currently configured for:
- **Development URL**: http://localhost:3300/timeline-chart-milestones/
- **Client ID**: 608904118556-in64g2lbi5qsgq5oah3ih4mccctj4re9.apps.googleusercontent.com

## Troubleshooting

### Common Issues:

1. **403 Forbidden**: Check that your URLs in Google Cloud Console match exactly
2. **CSP Violations**: The app includes appropriate CSP headers for development
3. **Cross-Origin Issues**: Make sure JavaScript origins are correctly set

### Debug Steps:

1. Check browser console for specific error messages
2. Verify OAuth configuration in Google Cloud Console
3. Make sure you're accessing the app at the exact URL configured
4. Clear browser cache and cookies for localhost

## Production Setup

When deploying to production:

1. Add your production domain to Authorized JavaScript origins
2. Add your production redirect URI
3. Update the OAuth consent screen for production use
4. Consider using environment-specific client IDs