# Google Sheets Integration Setup Guide

This application includes bidirectional Google Sheets integration that allows you to sync your timeline projects with Google Spreadsheets. This feature is only available to authenticated users.

## Features

- **Bidirectional Sync**: Changes in the UI automatically sync to Google Sheets and vice versa
- **Real-time Collaboration**: Multiple users can edit the same spreadsheet and see changes reflected in the timeline
- **Conflict Resolution**: Automatic handling of simultaneous edits with user-controlled resolution strategies
- **Offline Support**: Works offline with localStorage as fallback, syncs when reconnected
- **Data Validation**: Ensures data integrity during sync operations

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the required APIs:
   - Google Sheets API
   - Google Drive API

### 2. Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Choose **Web application** as the application type
4. Configure authorized JavaScript origins:
   - For development: `http://localhost:5173`
   - For production: `https://yourdomain.com`
5. Save and copy the **Client ID**

### 3. Environment Configuration

Create a `.env` file in your project root with:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
```

### 4. Security Considerations

- **Browser-based Auth**: Uses Google's JavaScript client library for secure browser-based authentication
- **Scopes**: The app requests minimal scopes (Sheets and Drive file access)
- **Data Privacy**: All project data remains in your Google account

## How It Works

### Data Structure in Google Sheets

The integration creates spreadsheets with three sheets:

1. **ProjectInfo Sheet**:
   - `projectName`: Project title
   - `projectStartDate`: Project start date
   - `lastModified`: Last modification timestamp
   - `createdAt`: Project creation timestamp

2. **Milestones Sheet**:
   - `milestoneId`: Unique milestone identifier
   - `milestoneName`: Milestone title
   - `startDate`: Calculated milestone start date
   - `endDate`: Calculated milestone end date
   - `orderIndex`: Display order

3. **Tasks Sheet**:
   - `taskId`: Unique task identifier
   - `milestoneId`: Parent milestone ID
   - `name`: Task name
   - `description`: Task description
   - `team`: Assigned team
   - `sprint`: Sprint assignment
   - `durationDays`: Duration in business days
   - `dependsOn`: Comma-separated task dependencies
   - `startDate`: Calculated start date
   - `endDate`: Calculated end date
   - `orderIndex`: Order within milestone

### Sync Behavior

- **UI Changes**: Automatically queued and synced to Google Sheets (debounced)
- **External Changes**: Periodically checked and pulled from Google Sheets
- **Conflict Detection**: When both local and remote data have been modified
- **Resolution Strategies**:
  - **Manual**: User chooses which version to keep
  - **Local Wins**: Always use local changes
  - **Remote Wins**: Always use remote changes

## Usage

### Connecting to Google Sheets

1. **Login** to the application first
2. In the **Google Sheets Integration** section, click **Connect Google**
3. Complete the OAuth authentication flow
4. Choose to:
   - Create a new spreadsheet from current project data
   - Connect to an existing spreadsheet

### Managing Sync

- **Auto Sync**: Enabled by default, syncs changes every 5 seconds
- **Manual Sync**: Click the sync button to manually trigger synchronization
- **Force Push**: Override remote data with local changes
- **Force Pull**: Override local data with remote changes
- **Conflict Resolution**: Configure automatic resolution strategy in settings

### Switching Between Modes

- **Local Storage Mode**: Data stored only locally in browser
- **Google Sheets Mode**: Data synced bidirectionally with Google Sheets
- You can switch between modes at any time

## Troubleshooting

### Common Issues

1. **"Google OAuth is not configured"**
   - Ensure environment variables are set correctly
   - Check that OAuth credentials are valid

2. **Authentication popup blocked**
   - Allow popups for the application domain
   - Disable popup blockers

3. **Sync conflicts**
   - Check conflict resolution settings
   - Use manual resolution for complex conflicts

4. **API quota exceeded**
   - Google Sheets API has usage limits
   - Reduce sync frequency if needed

### Development Tips

- Use browser developer tools to monitor network requests
- Check the console for detailed error messages
- Test with simple projects first before using complex data

## API Limits

- **Google Sheets API**: 300 requests per minute per user
- **Drive API**: 1,000 requests per 100 seconds per user
- The application implements intelligent batching to stay within limits

## Data Privacy

- Your project data remains in your Google account
- No data is stored on external servers
- Offline mode ensures functionality without internet connection
- You control which spreadsheets to connect to
