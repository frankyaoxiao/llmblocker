# Focus Guard Extension - Manual Testing Scenarios

## Test Environment Setup

1. Load extension in Chrome/Firefox developer mode
2. Set up test API key (use OpenRouter for initial testing)
3. Add test goals like "Study machine learning" or "Work on programming projects"

## Core Functionality Tests

### 1. Goal Management (Popup)
- [ ] **Add Goal**: Can add new goals via popup
- [ ] **Remove Goal**: Can delete goals with confirmation
- [ ] **Goal Limits**: Cannot exceed 10 goals or 200 characters per goal
- [ ] **Goal Persistence**: Goals persist after browser restart
- [ ] **Extension Toggle**: Can enable/disable extension from popup
- [ ] **Settings Access**: Settings button opens options page

### 2. API Configuration (Options Page)
- [ ] **Provider Selection**: Can select different LLM providers
- [ ] **Model Selection**: Model dropdown updates based on provider
- [ ] **API Key Input**: Can enter and validate API keys
- [ ] **Key Visibility**: Toggle button shows/hides API key
- [ ] **Validation**: Invalid keys show error messages
- [ ] **Settings Persistence**: Configuration saves automatically

### 3. Content Analysis & Blocking
- [ ] **Page Analysis**: Extension analyzes page content on load
- [ ] **Blocking Overlay**: Shows blocking overlay for pages that don't align with goals
- [ ] **Bypass Mechanism**: "Mistake" button allows bypassing blocks
- [ ] **Goal Display**: Current goals visible in blocking overlay
- [ ] **Confidence Display**: Shows confidence percentage in overlay

### 4. Edge Cases & Error Handling
- [ ] **No Goals Set**: Allows all pages when no goals configured
- [ ] **No API Key**: Shows appropriate error when API not configured
- [ ] **API Failures**: Fails open (allows page) when API call fails
- [ ] **Rate Limiting**: Respects rate limits and shows warnings
- [ ] **Invalid Pages**: Skips analysis for chrome:// and extension pages

## Test Scenarios by Goal Type

### Academic Research Goals
**Test Goal**: "Study deep learning and neural networks"

**Expected Blocks**:
- [ ] Social media (Facebook, Twitter, Instagram)
- [ ] Entertainment (YouTube videos unrelated to ML)
- [ ] News sites (unless tech/AI related)
- [ ] Shopping sites

**Expected Allows**:
- [ ] ArXiv papers on neural networks
- [ ] Coursera ML courses
- [ ] GitHub repositories for deep learning
- [ ] Stack Overflow questions about neural networks
- [ ] Academic institution websites

### Programming Work Goals
**Test Goal**: "Work on React JavaScript project"

**Expected Blocks**:
- [ ] Social media platforms
- [ ] Non-programming YouTube content
- [ ] General news websites
- [ ] Entertainment sites

**Expected Allows**:
- [ ] React documentation
- [ ] Stack Overflow programming questions
- [ ] GitHub repositories
- [ ] NPM package pages
- [ ] Programming tutorials and blogs

### Productivity Goals
**Test Goal**: "Complete work presentation slides"

**Expected Blocks**:
- [ ] Social media
- [ ] Entertainment websites
- [ ] Gaming sites
- [ ] Non-work related content

**Expected Allows**:
- [ ] PowerPoint/Google Slides
- [ ] Stock photo websites
- [ ] Company internal sites
- [ ] Presentation templates
- [ ] Professional design resources

## Performance Tests

### Response Time
- [ ] **Initial Analysis**: Page analysis completes within 3 seconds
- [ ] **Cached Results**: Subsequent visits to same content are instant
- [ ] **Large Pages**: Extension handles pages with lots of content

### Resource Usage
- [ ] **Memory**: Extension doesn't cause excessive memory usage
- [ ] **CPU**: No noticeable performance impact on browsing
- [ ] **Network**: API calls are reasonably sized and infrequent

## Cross-Browser Compatibility

### Chrome Testing
- [ ] Extension loads correctly
- [ ] All functionality works as expected
- [ ] Developer console shows no errors
- [ ] Extension survives browser restart

### Firefox Testing
- [ ] Extension installs and loads
- [ ] Core functionality works
- [ ] Manifest compatibility confirmed
- [ ] No browser-specific issues

## Security & Privacy Tests

### Data Protection
- [ ] **API Keys**: Keys stored securely, not visible in logs
- [ ] **Content Filtering**: No sensitive content sent to LLM
- [ ] **Local Storage**: User data stays on device
- [ ] **HTTPS**: All API calls use secure connections

### Permission Scope
- [ ] **Minimal Permissions**: Only requests necessary permissions
- [ ] **Content Access**: Only accesses page content for analysis
- [ ] **No Tracking**: Extension doesn't track user behavior

## User Experience Tests

### First-Time Setup
- [ ] **Installation**: Clear installation process
- [ ] **Onboarding**: Options page opens on first install
- [ ] **Goal Creation**: Easy to add first goal
- [ ] **API Setup**: Clear instructions for API configuration

### Daily Usage
- [ ] **Blocking Flow**: Blocking overlay is clear and not annoying
- [ ] **Bypass Flow**: Easy to bypass false positives
- [ ] **Settings Changes**: Changes take effect immediately
- [ ] **Visual Design**: UI is clean and professional

## Stress Tests

### High Volume
- [ ] **Rapid Navigation**: Extension handles quick page navigation
- [ ] **Multiple Tabs**: Works correctly with many tabs open
- [ ] **Long Sessions**: Stable during extended browsing sessions

### Error Recovery
- [ ] **Network Issues**: Graceful handling of network problems
- [ ] **Invalid Responses**: Handles malformed API responses
- [ ] **Storage Errors**: Recovers from storage quota issues

## Analytics Tests

### Usage Tracking
- [ ] **Page Counts**: Correctly tracks analyzed pages
- [ ] **Block Counts**: Accurately counts blocked pages
- [ ] **Bypass Counts**: Records user bypasses
- [ ] **Statistics Display**: Stats shown correctly in options page

## Configuration Tests

### Settings Import/Export
- [ ] **Export**: Can export settings to JSON file
- [ ] **Import**: Can import valid settings file
- [ ] **Validation**: Rejects invalid import files
- [ ] **Backup**: Export excludes sensitive data (API keys)

### Data Management
- [ ] **Reset Stats**: Can reset usage statistics
- [ ] **Clear All Data**: Complete data reset works correctly
- [ ] **Confirmation**: Destructive actions require confirmation

## Bug Reproduction Checklist

### Common Issues
- [ ] **Reload Loops**: Page doesn't get stuck in reload cycles
- [ ] **Memory Leaks**: Long-term usage doesn't cause memory issues
- [ ] **Cache Problems**: Cache clearing works when goals change
- [ ] **Race Conditions**: Rapid navigation doesn't cause conflicts

### Browser Specific
- [ ] **Chrome Manifest V3**: Service worker persists correctly
- [ ] **Firefox Compatibility**: Background script works in Firefox
- [ ] **Extension Updates**: Extension updates without losing data

## Acceptance Criteria

### MVP Requirements
- [x] Goal management via popup
- [x] LLM provider configuration
- [x] Page content analysis
- [x] Blocking overlay with bypass
- [x] Confidence-based decisions
- [x] Settings persistence

### Success Metrics
- [ ] **Accuracy**: >80% of blocks feel appropriate to user
- [ ] **Performance**: <2 second analysis time
- [ ] **Reliability**: <5% API failure rate
- [ ] **Usability**: User can set up and use without documentation

## Test Results Template

```
Test Date: ___________
Tester: ___________
Browser: _____ Version: _____
Extension Version: _____

Goals Tested: ________________
API Provider: ________________

Results:
- Successful Tests: __ / __
- Failed Tests: __ / __
- Critical Issues: __ 
- Minor Issues: __

Notes:
_________________________________
```

## Known Limitations for MVP

1. **Single Language**: English content only
2. **Text Only**: No image/video content analysis
3. **Basic Caching**: Simple time-based cache expiration
4. **No Machine Learning**: No learning from user feedback
5. **Manual Setup**: Requires user to configure API keys

These limitations are acceptable for MVP and can be addressed in future versions.