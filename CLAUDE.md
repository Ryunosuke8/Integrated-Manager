# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Integrated Developer" - a Japanese project management application that integrates with Google Drive. The app manages AI-enhanced research projects through a single "Project" panel with specialized folder structures for academic and business development.

## Development Commands

### Core Development
```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Testing
No test framework is currently configured. When adding tests, check with the user about their preferred testing setup.

## Architecture Overview

### Main Application Structure
- **React 19** with Vite as the build tool
- **Single Panel Design**: App centers around one large "Project" panel (1200x600px)
- **Modal-based UI**: Project management, note-taking, and AI processing happen in modals
- **Drag & Drop**: Projects can be dragged to ChatGPT icon for research

### Key Components
- `App.jsx`: Main application with modal state management and drag/drop handlers
- `Panel.jsx`: Core project panel with Google Drive integration and hover-based project loading
- `ProjectManager.jsx`: Modal for creating/managing Google Drive projects

### Services Architecture
The application uses a comprehensive service layer in `src/services/`:

#### Core Services
- **`googleDrive.js`**: Google Drive API integration with OAuth2 authentication
- **`diffDetection.js`**: Monitors project folders for changes to trigger AI processing
- **`aiProcessing.js`**: Central AI processing hub that routes to specialized processors

#### AI Processing Services
Each project folder type has specialized AI processing:
- **`documentOrganizer.js`**: Document folder - summarization, topic extraction
- **`slideGeneration.js`**: Presentation folder - slide creation, chart generation
- **`paperGeneration.js`**: Paper folder - LaTeX templates, citation management
- **`reachingService.js`**: Reaching folder - event discovery, relevance scoring
- **`materialCollector.js`**: Material folder - asset tagging, format conversion
- **`requirementsCreator.js`**: Implementation folder - spec generation
- **`folderContentSummary.js`**: Cross-folder content analysis

#### External APIs
- **`openaiService.js`**: OpenAI API for AI processing (required)
- **`ieeeService.js`**: IEEE Xplore API for academic paper searches
- **`semanticScholarService.js`**: Semantic Scholar API integration (no key required)
- **`googleSearchService.js`**: Google Custom Search API for external information
- **`bingSearchService.js`**: Bing Search API for alternative web search
- **`referencePaperSearch.js`**: Multi-source academic search integration

### Project Folder Structure
Each project automatically creates 8 specialized folders in Google Drive:
- **Document**: Project docs, narratives, direction control
- **Implementation**: Code, GitHub repos, architecture
- **Presentation**: Slides, charts, explanations
- **Reaching**: Events, conferences, publication opportunities
- **Business**: Business models, market strategies
- **Academia**: Research papers, background materials
- **Paper**: Paper drafts, LaTeX formats
- **Material**: Images, diagrams, assets

### API Configuration
The application uses a browser-based API key management system through the settings modal, accessed via the home menu.

#### Required APIs
- **Google Drive API**: Requires `VITE_GOOGLE_API_KEY` and `VITE_GOOGLE_CLIENT_ID` in `.env` file
- **OpenAI API**: Required for all AI processing - configure in settings modal

#### Optional APIs (Configure in Settings Modal)
- **IEEE Xplore API**: Academic paper searches (technical/engineering papers)
- **Google Custom Search API**: External web search for presentations
- **Bing Search API**: Alternative web search engine
- **Semantic Scholar API**: AI/ML paper searches (no API key required)

#### API Key Storage
- All optional API keys are stored in browser localStorage for security
- Keys are never sent to servers, only used for direct API calls
- Each API can be individually configured and tested
- Fallback to mock/demo data when APIs are not configured

#### Configuration Access
1. Click the settings icon (⚙️) in the main interface
2. Navigate through the API configuration tabs:
   - **OpenAI**: Core AI processing settings
   - **IEEE**: Academic paper search settings
   - **Google Search**: Custom search configuration
   - **Bing Search**: Alternative search configuration
   - **情報**: Overview and setup instructions

## API Usage Guide

### API Integration Overview
The application integrates with multiple external APIs to provide comprehensive research and development capabilities. Each API serves specific functions within the 8-folder project structure.

### API Functions by Folder

#### Document Folder
- **OpenAI API**: Document summarization, outline generation, duplicate analysis
- **Used in**: `documentOrganizer.js`

#### Implementation Folder  
- **OpenAI API**: Requirements generation, architecture analysis
- **Used in**: `requirementsCreator.js`

#### Presentation Folder
- **OpenAI API**: Slide content generation
- **Google Custom Search API**: External information gathering for presentations
- **Bing Search API**: Alternative search for current topics
- **Used in**: `slideGeneration.js`, `reachingService.js`

#### Reaching Folder
- **Google Custom Search API**: Event and conference discovery
- **Bing Search API**: News and opportunity searches
- **Used in**: `reachingService.js`

#### Academia Folder
- **IEEE Xplore API**: Technical and engineering paper searches
- **Semantic Scholar API**: AI/ML paper searches
- **OpenAI API**: Paper topic suggestions
- **Used in**: `referencePaperSearch.js`, `paperTopicSuggestion.js`

#### Paper Folder
- **OpenAI API**: Paper structure generation, LaTeX formatting
- **IEEE/Semantic Scholar APIs**: Reference paper integration
- **Used in**: `paperGeneration.js`

### API Setup Instructions

#### 1. OpenAI API (Required)
```
1. Visit https://platform.openai.com/
2. Create account and obtain API key
3. Configure in settings modal → OpenAI tab
4. Test connection to verify setup
```

#### 2. IEEE Xplore API (Optional)
```
1. Visit https://developer.ieee.org/
2. Apply for API access (academic research purposes)
3. Configure API key in settings modal → IEEE tab
4. Alternative: Use OAuth with Client ID
```

#### 3. Google Custom Search API (Optional)
```
1. Visit https://console.cloud.google.com/
2. Enable Custom Search API
3. Create Custom Search Engine at https://programmablesearchengine.google.com/
4. Configure API key and Engine ID in settings modal → Google Search tab
```

#### 4. Bing Search API (Optional)
```
1. Visit https://azure.microsoft.com/services/cognitive-services/bing-web-search-api/
2. Create Azure Cognitive Services account
3. Obtain Bing Search API key
4. Configure in settings modal → Bing Search tab
```

### API Fallback Behavior
When APIs are not configured or fail, the application provides graceful fallbacks:

- **Paper Search**: IEEE → Semantic Scholar → Mock data
- **Web Search**: Google → Bing → Basic search
- **AI Processing**: OpenAI required, no fallback (displays error)
- **Demo Mode**: All optional APIs can use mock data for demonstrations

### Testing API Connections
Each API configuration tab includes a "接続テスト" (Connection Test) button:
1. Configure API credentials
2. Click "接続テスト" to verify connection
3. Review validation messages
4. Save configuration when test passes

### API Rate Limits and Costs

#### Free Tiers
- **Semantic Scholar**: Free, no API key required
- **Google Custom Search**: 100 queries/day free
- **Bing Search**: 1000 queries/month free
- **IEEE Xplore**: Varies by academic/commercial use

#### Paid Usage
- **OpenAI**: Pay-per-token usage
- **Google Custom Search**: $5 per 1000 additional queries
- **Bing Search**: $3-7 per 1000 queries depending on plan
- **IEEE**: Subscription-based for commercial use

### Troubleshooting

#### Common Issues
1. **CORS Errors**: 
   - Bing and Google APIs may have CORS restrictions
   - Development environment uses proxies where possible
   - Consider backend integration for production

2. **API Key Invalid**:
   - Verify keys are correctly copied without extra spaces
   - Check API key permissions and quotas
   - Ensure APIs are enabled in respective consoles

3. **Network Errors**:
   - Check internet connection
   - Verify firewall settings
   - Some APIs may be blocked in certain regions

4. **Rate Limiting**:
   - Monitor API usage in respective dashboards
   - Implement delays between requests if needed
   - Consider upgrading to paid tiers for higher limits

#### Debug Mode
Enable browser developer tools to view detailed API request/response logs:
1. Open DevTools (F12)
2. Check Console tab for API-related messages
3. Network tab shows actual HTTP requests
4. Look for service-specific console.log messages

## Development Workflow

### Adding New AI Processing
1. Create service in `src/services/`
2. Add processor method to `aiProcessing.js`
3. Update folder configuration in `src/config/googleDriveConfig.js`

### Environment Setup
1. Copy environment variables from README.md setup section
2. Configure Google Cloud Console for Drive API
3. Set up OAuth2 redirect URI: `http://localhost:5173/auth/callback`

### Code Style
- Uses ESLint with React hooks and refresh plugins
- Tailwind CSS for styling
- Japanese comments and UI text throughout codebase
- React 19 features and modern JavaScript (ES2020+)

## Important Notes
- UI text is in Japanese - maintain this when making changes
- All Google Drive operations happen through the `googleDriveService`
- AI processing is triggered by folder change detection
- Project creation happens in Google Drive's "Integrated-Manager" folder
- The app uses OAuth2 with Google Identity Services (not deprecated auth library)
- API keys are stored in browser localStorage for security (except Google Drive which uses environment variables)
- All optional APIs have fallback mechanisms to ensure application functionality
- The application can run in demo mode with mock data when APIs are not configured
- Settings modal provides comprehensive API management with testing capabilities