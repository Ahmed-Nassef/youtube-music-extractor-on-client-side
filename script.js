(() => {
  const items = document.querySelectorAll('ytmusic-player-queue-item');
  const links = [];
  
  // Common false positive patterns to avoid
  const falsePositives = [
    'style-scope',
    'yt-spec-icon',
    'css-build',
    'dom-if',
    'template',
    'polymer'
  ];
  
  // Valid YouTube video ID pattern (more strict)
  const isValidVideoId = (str) => {
    if (!str || typeof str !== 'string' || str.length !== 11) return false;
    if (falsePositives.some(fp => str.includes(fp))) return false;
    // Valid YouTube video IDs contain alphanumeric, underscore, and hyphen
    return /^[a-zA-Z0-9_-]{11}$/.test(str) && 
           // Should not be all the same character or obvious non-video patterns
           !/^(.)\1{10}$/.test(str) &&
           !str.includes('-scope') &&
           !str.includes('style');
  };
  
  items.forEach((item, index) => {
    const title = item.querySelector('.song-title')?.innerText.trim() || '[No Title]';
    const artist = item.querySelector('.byline')?.innerText.trim() || '[No Artist]';
    
    let videoId = null;
    
    console.log(`\n=== Processing Song ${index + 1}: "${title}" by "${artist}" ===`);
    
    // Strategy 1: Look for navigation endpoints in Polymer data
    const checkForVideoId = (obj, path = '', visited = new Set()) => {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
      visited.add(obj);
      
      // Direct video ID properties
      if (obj.videoId && isValidVideoId(obj.videoId)) {
        console.log(`Found videoId at ${path}.videoId: ${obj.videoId}`);
        return obj.videoId;
      }
      
      // Navigation endpoints
      if (obj.watchEndpoint && obj.watchEndpoint.videoId && isValidVideoId(obj.watchEndpoint.videoId)) {
        console.log(`Found videoId at ${path}.watchEndpoint.videoId: ${obj.watchEndpoint.videoId}`);
        return obj.watchEndpoint.videoId;
      }
      
      if (obj.navigationEndpoint) {
        if (obj.navigationEndpoint.videoId && isValidVideoId(obj.navigationEndpoint.videoId)) {
          console.log(`Found videoId at ${path}.navigationEndpoint.videoId: ${obj.navigationEndpoint.videoId}`);
          return obj.navigationEndpoint.videoId;
        }
        if (obj.navigationEndpoint.watchEndpoint && obj.navigationEndpoint.watchEndpoint.videoId && 
            isValidVideoId(obj.navigationEndpoint.watchEndpoint.videoId)) {
          console.log(`Found videoId at ${path}.navigationEndpoint.watchEndpoint.videoId: ${obj.navigationEndpoint.watchEndpoint.videoId}`);
          return obj.navigationEndpoint.watchEndpoint.videoId;
        }
      }
      
      // Recursively search objects
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          const result = checkForVideoId(value, path ? `${path}.${key}` : key, visited);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    // Check main element data
    const mainData = item.__data || item.__dataHost;
    if (mainData) {
      console.log('Checking main element data...');
      videoId = checkForVideoId(mainData, 'mainData');
    }
    
    // Strategy 2: Check specific child elements
    if (!videoId) {
      console.log('Checking child elements...');
      const playButton = item.querySelector('ytmusic-play-button-renderer');
      if (playButton) {
        const playButtonData = playButton.__data || playButton.__dataHost;
        if (playButtonData) {
          videoId = checkForVideoId(playButtonData, 'playButton');
        }
      }
    }
    
    // Strategy 3: Check all child elements with data
    if (!videoId) {
      console.log('Deep searching all elements...');
      const allElements = item.querySelectorAll('*');
      for (let i = 0; i < allElements.length && !videoId; i++) {
        const el = allElements[i];
        const elData = el.__data || el.__dataHost;
        if (elData) {
          videoId = checkForVideoId(elData, `element[${i}]`);
        }
      }
    }
    
    // Strategy 4: Look for href attributes with video IDs
    if (!videoId) {
      console.log('Checking href attributes...');
      const links = item.querySelectorAll('a[href*="watch?v="], a[href*="/watch/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        const match = href.match(/[?&/]v=([a-zA-Z0-9_-]{11})/);
        if (match && isValidVideoId(match[1])) {
          console.log(`Found videoId in href: ${match[1]}`);
          videoId = match[1];
          break;
        }
      }
    }
    
    // Strategy 5: Check for data-* attributes
    if (!videoId) {
      console.log('Checking data attributes...');
      const elementsWithData = item.querySelectorAll('[data-video-id], [data-videoid], [videoid]');
      for (const el of elementsWithData) {
        const vid = el.getAttribute('data-video-id') || 
                   el.getAttribute('data-videoid') || 
                   el.getAttribute('videoid');
        if (vid && isValidVideoId(vid)) {
          console.log(`Found videoId in data attribute: ${vid}`);
          videoId = vid;
          break;
        }
      }
    }
    
    console.log(`Final result: ${videoId || 'NOT FOUND'}`);
    
    if (videoId && isValidVideoId(videoId)) {
      links.push({
        title,
        artist,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId
      });
    } else {
      links.push({
        title,
        artist,
        url: '[VIDEO_ID_NOT_FOUND]',
        videoId: null
      });
    }
  });
  
  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Found ${links.length} songs total`);
  const foundIds = links.filter(l => l.videoId).length;
  console.log(`📹 Video IDs successfully extracted: ${foundIds}/${links.length}`);
  
  links.forEach((l, i) => {
    console.log(`\n${i + 1}. ${l.title} - ${l.artist}`);
    console.log(`   ${l.url}`);
    if (l.videoId) {
      console.log(`   ✓ Video ID: ${l.videoId}`);
    } else {
      console.log(`   ✗ Video ID: Not found`);
    }
  });
  
  // Copy results to clipboard
  const clipboardText = links.map(l => 
    `${l.title} - ${l.artist}\n${l.url}${l.videoId ? `\nVideo ID: ${l.videoId}` : ''}`
  ).join('\n\n');
  
  navigator.clipboard.writeText(clipboardText)
    .then(() => console.log('\n Results copied to clipboard!'))
    .catch(() => console.warn('\n Could not copy to clipboard.'));
  
  return links;
})();
