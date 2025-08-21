# Semantic Scholar API Integration

## Overview

The reference paper search functionality now supports both IEEE Xplore and Semantic Scholar APIs. Users can toggle between the two search sources using the dropdown menu in the reference paper search button.

## Features

### 🔬 IEEE Xplore

- **Specialization**: Technical and engineering papers
- **Requirements**: API key required
- **Cost**: Paid service
- **CORS**: No CORS issues (uses proxy in development)

### 🎓 Semantic Scholar

- **Specialization**: AI and machine learning papers
- **Requirements**: No API key required (free)
- **Cost**: Free
- **CORS**: Has CORS restrictions (addressed with proxy solutions)

## CORS Issue Resolution

### Problem

Semantic Scholar API has CORS (Cross-Origin Resource Sharing) restrictions that prevent direct browser access from web applications.

### Solution

The application implements multiple fallback strategies:

1. **Primary Proxy**: Uses `api.allorigins.win` as the main CORS proxy
2. **Alternative Proxies**: Falls back to other proxy services if the primary fails
3. **Direct API**: Attempts direct API access as a last resort
4. **IEEE Fallback**: If Semantic Scholar fails completely, falls back to IEEE Xplore
5. **Mock Data**: If all APIs fail, uses mock data for demonstration

### Proxy Services Used

- `https://api.allorigins.win/raw?url=`
- `https://cors-anywhere.herokuapp.com/`
- `https://thingproxy.freeboard.io/fetch/`

## Usage

1. Click the "📚 参考論文検索" button
2. Select your preferred search source from the dropdown:
   - **IEEE Xplore**: For technical/engineering papers
   - **Semantic Scholar**: For AI/ML papers
3. Click "検索実行" to start the search
4. The system will automatically handle API failures and fallbacks

## Error Handling

The system provides informative messages about:

- Which search source was selected
- Which search source was actually used (may differ due to fallbacks)
- API connection status
- Fallback behavior

## Technical Implementation

### Files Modified

- `src/services/semanticScholarService.js` - New Semantic Scholar API service
- `src/services/referencePaperSearch.js` - Updated to support both APIs
- `src/components/ProjectManager.jsx` - Added toggle UI and better error handling

### Key Features

- **Automatic Fallback**: Seamless switching between APIs
- **Multiple Proxy Support**: Redundant proxy services for reliability
- **User Feedback**: Clear indication of which service is being used
- **Error Recovery**: Graceful handling of API failures

## Troubleshooting

### If Semantic Scholar Fails

1. Check your internet connection
2. Try using IEEE Xplore instead
3. The system will automatically fall back to mock data if needed

### If IEEE Xplore Fails

1. Verify your IEEE API key is configured
2. Check the API key in the IEEE configuration modal
3. The system will fall back to Semantic Scholar or mock data

## Future Improvements

- Add more proxy services for better reliability
- Implement local caching to reduce API calls
- Add user preference settings for default search source
- Consider implementing a backend proxy service for production use
