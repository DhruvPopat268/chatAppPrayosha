# Hyperlink Message Functionality

## Overview
The chat application now supports automatic detection and rendering of hyperlinks in messages. When users send messages containing URLs, they are automatically converted to clickable link messages with previews.

## Features

### 🔗 Automatic Link Detection
- Automatically detects URLs in text messages
- Supports HTTP and HTTPS links
- Extracts the first URL found in a message

### 📱 Rich Link Previews
- Displays link previews with domain information
- Shows link title and description when available
- Responsive design for both sent and received messages

### 🎨 Smart Styling
- Different styling for sent vs received link messages
- Consistent with existing message bubble design
- Hover effects and visual feedback

## How It Works

### 1. Message Input
When a user types a message containing a URL:
```typescript
// Example: "Check out this video: https://www.youtube.com/watch?v=example"
```

### 2. Automatic Detection
The system automatically detects URLs using regex patterns:
```typescript
const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};
```

### 3. Link Processing
For detected URLs, the system:
- Changes message type from "text" to "link"
- Generates link metadata (title, description, domain)
- Creates a rich preview card

### 4. Message Display
Link messages are rendered with:
- Original message text
- Clickable link preview card
- Domain information and visual indicators
- Proper styling for sender/receiver

## Message Types

### Text Message
```typescript
interface Message {
  type: "text";
  content: string;
  // ... other fields
}
```

### Link Message
```typescript
interface Message {
  type: "link";
  content: string;
  linkUrl: string;
  linkTitle: string;
  linkDescription: string;
  linkImage?: string;
  // ... other fields
}
```

## Implementation Details

### URL Detection
- Uses regex pattern: `/(https?:\/\/[^\s]+)/g`
- Supports both HTTP and HTTPS protocols
- Extracts complete URLs including query parameters

### Link Preview Generation
```typescript
const getLinkPreview = async (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return {
      title: domain,
      description: `Link to ${domain}`,
      image: null
    };
  } catch (error) {
    return {
      title: 'Invalid URL',
      description: 'Could not load link preview',
      image: null
    };
  }
};
```

### Message Processing
- Applied to both sent and received messages
- Handles existing messages during loading
- Fallback to text if link processing fails

## Usage Examples

### Sending a Link Message
1. Type a message containing a URL
2. Press Enter or click Send
3. The message is automatically converted to a link message
4. A rich preview card is displayed

### Example Messages
```
"Check out this video: https://www.youtube.com/watch?v=example"
"Visit our website: https://example.com"
"GitHub repo: https://github.com/user/repo"
```

## Styling

### Sent Messages (Blue)
- Link preview: `bg-white/10 border-white/20`
- Text: White with proper contrast
- Hover: `hover:bg-white/5`

### Received Messages (White)
- Link preview: `bg-gray-50 border-gray-200`
- Text: Dark gray for readability
- Hover: `hover:bg-gray-100`

## Browser Compatibility
- Modern browsers with ES6+ support
- Responsive design for mobile and desktop
- Proper link handling with `target="_blank"`

## Security Features
- External links open in new tabs
- `rel="noopener noreferrer"` for security
- URL validation and sanitization

## Future Enhancements
- Rich link previews with Open Graph metadata
- Image thumbnails for supported links
- Link categorization (video, article, product, etc.)
- Custom link preview templates
- Link analytics and tracking

## Testing
Use the test page (`/test`) to verify hyperlink detection:
1. Click "🔗 Test Hyperlink Detection"
2. Check logs for URL detection results
3. Verify link message rendering in chat

## Technical Notes
- Async link processing for better performance
- Graceful fallback to text messages
- Consistent with existing message architecture
- No breaking changes to existing functionality
