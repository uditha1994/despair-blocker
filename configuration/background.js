/**
 * Background Service Worker for Despair Blocker
 * Handles alarm management, tab monitoring, and content script injection
 */

// Default configuration for new installations
const DEFAULT_CONFIG = {
    blockedSites: [
        'youtube.com',
        'facebook.com',
        'twitter.com',
        'instagram.com',
        'reddit.com',
        'tiktok.com'
    ],
    schedule: {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        workDays: [1, 2, 3, 4, 5] // Monday to Friday (0 = Sunday)
    },
    despairMessages: [
        "Hello from 3 hours from now. I didn't finish the project. I'm tired. I have to ask for an extension. All because you needed to watch one... more... cat video. Close this tab and go back to work.",
        "It's me from the future. I'm sitting here at 11 PM, stressed and overwhelmed. The deadline is tomorrow and I'm nowhere near done. This could have been avoided if you just stayed focused.",
        "Future you here. I'm disappointed. We had such good intentions this morning, but here we are again, scrolling mindlessly while our dreams slip away. Please, just close this tab.",
        "Your future self is crying. Not literally, but emotionally. The presentation is in 2 hours and I'm frantically trying to put something together. Don't let this be our reality."
    ],
    enableTTS: true
};

/**
 * Initialize extension on startup
 * Sets up default configuration and schedules
 */
chrome.runtime.onStartup.addListener(async () => {
    await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async () => {
    await initializeExtension();
});

/**
 * Initialize extension with default settings
 */
async function initializeExtension() {
    try {
        const result = await chrome.storage.sync.get(['config']);

        if (!result.config) {
            // First time installation - set default config
            await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
            console.log('Despair Blocker: Default configuration set');
        }

        // Set up blocking schedule
        await setupBlockingSchedule();

    } catch (error) {
        console.error('Despair Blocker: Initialization error:', error);
    }
}

/**
 * Set up alarms for blocking schedule
 * Creates recurring alarms for start and end times
 */
async function setupBlockingSchedule() {
    try {
        const { config } = await chrome.storage.sync.get(['config']);

        if (!config || !config.schedule.enabled) {
            return;
        }

        // Clear existing alarms
        await chrome.alarms.clearAll();

        // Create alarms for start and end times
        const startTime = parseTime(config.schedule.startTime);
        const endTime = parseTime(config.schedule.endTime);

        // Set daily recurring alarms
        chrome.alarms.create('blockingStart', {
            when: getNextAlarmTime(startTime),
            periodInMinutes: 24 * 60 // Daily
        });

        chrome.alarms.create('blockingEnd', {
            when: getNextAlarmTime(endTime),
            periodInMinutes: 24 * 60 // Daily
        });

        console.log('Despair Blocker: Blocking schedule set up');

    } catch (error) {
        console.error('Despair Blocker: Schedule setup error:', error);
    }
}

/**
 * Parse time string (HH:MM) to hours and minutes
 */
function parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
}

/**
 * Get next alarm time for given time
 */
function getNextAlarmTime(time) {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(time.hours, time.minutes, 0, 0);

    // If time has passed today, set for tomorrow
    if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
    }

    return alarmTime.getTime();
}

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Despair Blocker: Alarm triggered:', alarm.name);
    // Alarms are mainly for scheduling - actual blocking is checked on tab updates
});

/**
 * Monitor tab updates and inject blocking script when needed
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process when page is loading or complete
    if (changeInfo.status !== 'loading' && changeInfo.status !== 'complete') {
        return;
    }

    // Skip non-http(s) URLs
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
        return;
    }

    try {
        const shouldBlock = await shouldBlockCurrentSite(tab.url);

        if (shouldBlock) {
            // Small delay to ensure page is ready
            setTimeout(async () => {
                try {
                    // Inject blocking content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: blockPage,
                        args: [await getRandomDespairMessage(), await getTTSEnabled()]
                    });
                } catch (injectionError) {
                    console.error('Despair Blocker: Script injection error:', injectionError);
                }
            }, 500);
        }

    } catch (error) {
        console.error('Despair Blocker: Tab update error:', error);
    }
});

/**
 * Handle tab activation (when user switches to a tab)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
            return;
        }

        const shouldBlock = await shouldBlockCurrentSite(tab.url);

        if (shouldBlock) {
            setTimeout(async () => {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: activeInfo.tabId },
                        func: blockPage,
                        args: [await getRandomDespairMessage(), await getTTSEnabled()]
                    });
                } catch (injectionError) {
                    console.error('Despair Blocker: Script injection error on tab activation:', injectionError);
                }
            }, 100);
        }

    } catch (error) {
        console.error('Despair Blocker: Tab activation error:', error);
    }
});

/**
 * Check if current site should be blocked based on URL and schedule
 */
async function shouldBlockCurrentSite(url) {
    try {
        const { config, temporaryDisabled } = await chrome.storage.sync.get(['config', 'temporaryDisabled']);

        // Check if blocking is temporarily disabled
        if (temporaryDisabled) {
            return false;
        }

        if (!config) {
            return false;
        }

        // Check if URL matches any blocked site
        const hostname = new URL(url).hostname.toLowerCase();
        const isBlockedSite = config.blockedSites.some(site =>
            hostname.includes(site.toLowerCase()) || site.toLowerCase().includes(hostname)
        );

        if (!isBlockedSite) {
            return false;
        }

        // Check if we're in blocking time period
        if (!config.schedule.enabled) {
            return true; // Always block if schedule is disabled
        }

        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // Check if today is a work day
        if (!config.schedule.workDays.includes(currentDay)) {
            return false;
        }

        // Check if current time is within blocking period
        const startTime = parseTimeToMinutes(config.schedule.startTime);
        const endTime = parseTimeToMinutes(config.schedule.endTime);

        return currentTime >= startTime && currentTime <= endTime;

    } catch (error) {
        console.error('Despair Blocker: Block check error:', error);
        return false;
    }
}

/**
 * Convert time string to minutes since midnight
 */
function parseTimeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Get random despair message from configuration
 */
async function getRandomDespairMessage() {
    try {
        const { config } = await chrome.storage.sync.get(['config']);
        const messages = config?.despairMessages || DEFAULT_CONFIG.despairMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    } catch (error) {
        console.error('Despair Blocker: Message retrieval error:', error);
        return DEFAULT_CONFIG.despairMessages[0];
    }
}

/**
 * Check if TTS is enabled
 */
async function getTTSEnabled() {
    try {
        const { config } = await chrome.storage.sync.get(['config']);
        return config?.enableTTS ?? DEFAULT_CONFIG.enableTTS;
    } catch (error) {
        console.error('Despair Blocker: TTS check error:', error);
        return DEFAULT_CONFIG.enableTTS;
    }
}

/**
 * Function to be injected into blocked pages
 * Uses Shadow DOM for complete isolation from page CSP and React
 */
function blockPage(message, enableTTS) {
    // Prevent multiple injections
    if (document.getElementById('despair-blocker-overlay')) {
        return;
    }

    // Create shadow host
    const shadowHost = document.createElement('div');
    shadowHost.id = 'despair-blocker-overlay';
    shadowHost.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
  `;

    // Create shadow root for complete isolation
    const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    // Create overlay container
    const overlayContainer = document.createElement('div');
    overlayContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d1b2e 50%, #1a1a1a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    animation: despairFadeIn 1s ease-out;
  `;

    // Create main container
    const despairContainer = document.createElement('div');
    despairContainer.style.cssText = `
    text-align: center;
    max-width: 600px;
    padding: 40px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 20px;
    border: 2px solid #ff6b6b;
    box-shadow: 0 20px 60px rgba(255, 107, 107, 0.3);
    animation: despairPulse 2s ease-in-out infinite;
    position: relative;
  `;

    // Create skull element
    const skull = document.createElement('div');
    skull.textContent = '💀';
    skull.style.cssText = `
    font-size: 4rem;
    margin-bottom: 20px;
    animation: despairFloat 3s ease-in-out infinite;
  `;

    // Create title
    const title = document.createElement('h1');
    title.textContent = 'BLOCKED BY DESPAIR';
    title.style.cssText = `
    color: #ff6b6b;
    font-size: 2.5rem;
    font-weight: bold;
    margin: 0 0 30px 0;
    text-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
    letter-spacing: 2px;
  `;

    // Create message
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
    color: #ffffff;
    font-size: 1.2rem;
    line-height: 1.6;
    margin-bottom: 40px;
    padding: 20px;
    background: rgba(255, 107, 107, 0.1);
    border-radius: 10px;
    border-left: 4px solid #ff6b6b;
  `;

    // Create actions container
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = `
    margin-bottom: 30px;
  `;

    // Create primary button
    const primaryBtn = document.createElement('button');
    primaryBtn.textContent = 'Go Back to Work';
    primaryBtn.style.cssText = `
    padding: 15px 30px;
    margin: 0 10px;
    border: none;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
    color: white;
    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
  `;

    // Create secondary button
    const secondaryBtn = document.createElement('button');
    secondaryBtn.textContent = 'Ignore Future Me (Bad Choice)';
    secondaryBtn.style.cssText = `
    padding: 15px 30px;
    margin: 0 10px;
    border: 2px solid #444;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    background: transparent;
    color: #888;
  `;

    // Create footer
    const footer = document.createElement('div');
    footer.textContent = 'Your future self is watching... and judging.';
    footer.style.cssText = `
    color: #666;
    font-size: 0.9rem;
    font-style: italic;
  `;

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
    @keyframes despairFadeIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes despairPulse {
      0%, 100% {
        box-shadow: 0 20px 60px rgba(255, 107, 107, 0.3);
      }
      50% {
        box-shadow: 0 20px 60px rgba(255, 107, 107, 0.5);
              }
    }
    
    @keyframes despairFloat {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-10px);
      }
    }
  `;

    // Add hover effects
    primaryBtn.addEventListener('mouseenter', () => {
        primaryBtn.style.transform = 'translateY(-2px)';
        primaryBtn.style.boxShadow = '0 8px 25px rgba(255, 107, 107, 0.6)';
    });

    primaryBtn.addEventListener('mouseleave', () => {
        primaryBtn.style.transform = 'translateY(0)';
        primaryBtn.style.boxShadow = '0 5px 15px rgba(255, 107, 107, 0.4)';
    });

    secondaryBtn.addEventListener('mouseenter', () => {
        secondaryBtn.style.background = 'rgba(255, 107, 107, 0.1)';
        secondaryBtn.style.borderColor = '#ff6b6b';
        secondaryBtn.style.color = '#ff6b6b';
    });

    secondaryBtn.addEventListener('mouseleave', () => {
        secondaryBtn.style.background = 'transparent';
        secondaryBtn.style.borderColor = '#444';
        secondaryBtn.style.color = '#888';
    });

    // Add event listeners for buttons
    primaryBtn.addEventListener('click', () => {
        try {
            // Try to go back in history
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // If no history, try to close tab or redirect to a productive page
                window.location.href = 'about:blank';
            }
        } catch (error) {
            // Fallback: just remove the overlay
            shadowHost.remove();
            document.documentElement.style.overflow = '';
        }
    });

    secondaryBtn.addEventListener('click', () => {
        // Remove the overlay
        shadowHost.remove();
        // Restore page scrolling
        document.documentElement.style.overflow = '';

        // Optional: Log this action for analytics
        try {
            chrome.runtime.sendMessage({
                action: 'userIgnoredBlock',
                url: window.location.href,
                timestamp: Date.now()
            }).catch(() => {
                // Ignore errors if background script is not available
            });
        } catch (error) {
            // Ignore messaging errors
        }
    });

    // Assemble the DOM structure
    actionsDiv.appendChild(primaryBtn);
    actionsDiv.appendChild(secondaryBtn);

    despairContainer.appendChild(skull);
    despairContainer.appendChild(title);
    despairContainer.appendChild(messageDiv);
    despairContainer.appendChild(actionsDiv);
    despairContainer.appendChild(footer);

    overlayContainer.appendChild(despairContainer);

    // Append styles and content to shadow root
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(overlayContainer);

    // Insert shadow host into page
    document.documentElement.appendChild(shadowHost);

    // Text-to-speech if enabled
    if (enableTTS && 'speechSynthesis' in window) {
        setTimeout(() => {
            try {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.rate = 0.8;
                utterance.pitch = 0.7;
                utterance.volume = 0.8;
                speechSynthesis.speak(utterance);
            } catch (error) {
                console.log('Despair Blocker: TTS not available');
            }
        }, 1000);
    }

    // Hide original page content
    document.documentElement.style.overflow = 'hidden';

    // Add keyboard support (ESC to close)
    const handleKeydown = (event) => {
        if (event.key === 'Escape') {
            shadowHost.remove();
            document.documentElement.style.overflow = '';
            document.removeEventListener('keydown', handleKeydown);
        }
    };

    document.addEventListener('keydown', handleKeydown);

    // Auto-remove on page unload
    window.addEventListener('beforeunload', () => {
        if (shadowHost.parentNode) {
            shadowHost.remove();
        }
        document.documentElement.style.overflow = '';
    });
}

/**
 * Listen for messages from options page and popup
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        if (request.action === 'updateSchedule') {
            await setupBlockingSchedule();
            sendResponse({ success: true });
        } else if (request.action === 'userIgnoredBlock') {
            // Track ignored blocks for analytics
            console.log('User ignored block on:', request.url, 'at', new Date(request.timestamp));

            // Store ignored block data
            try {
                const { ignoredBlocks = [] } = await chrome.storage.local.get(['ignoredBlocks']);
                ignoredBlocks.push({
                    url: request.url,
                    timestamp: request.timestamp,
                    date: new Date(request.timestamp).toISOString()
                });

                // Keep only last 100 ignored blocks to prevent storage bloat
                if (ignoredBlocks.length > 100) {
                    ignoredBlocks.splice(0, ignoredBlocks.length - 100);
                }

                await chrome.storage.local.set({ ignoredBlocks });
            } catch (storageError) {
                console.error('Error storing ignored block data:', storageError);
            }

            sendResponse({ success: true });
        } else if (request.action === 'urlChanged') {
            // Handle URL changes from content script
            const shouldBlock = await shouldBlockCurrentSite(request.url);

            if (shouldBlock && sender.tab) {
                setTimeout(async () => {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: sender.tab.id },
                            func: blockPage,
                            args: [await getRandomDespairMessage(), await getTTSEnabled()]
                        });
                    } catch (injectionError) {
                        console.error('Despair Blocker: Script injection error on URL change:', injectionError);
                    }
                }, 500);
            }

            sendResponse({ success: true });
        } else if (request.action === 'tabVisible') {
            // Handle tab becoming visible
            const shouldBlock = await shouldBlockCurrentSite(request.url);

            if (shouldBlock && sender.tab) {
                setTimeout(async () => {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: sender.tab.id },
                            func: blockPage,
                            args: [await getRandomDespairMessage(), await getTTSEnabled()]
                        });
                    } catch (injectionError) {
                        console.error('Despair Blocker: Script injection error on tab visible:', injectionError);
                    }
                }, 100);
            }

            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Despair Blocker: Message handling error:', error);
        sendResponse({ success: false, error: error.message });
    }

    // Return true to indicate we'll send a response asynchronously
    return true;
});

/**
 * Handle extension action click (when no popup is defined)
 */
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});