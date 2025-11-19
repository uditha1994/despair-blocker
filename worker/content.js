/**
 * Content Script for Despair Blocker
 * This script runs on all pages and communicates with the background script
 * Handles URL change detection and provides fallback blocking functionality
 */

// Flag to prevent multiple executions
let despairBlockerActive = false;
let urlObserver = null;
let lastUrl = window.location.href;

/**
 * Initialize content script
 */
(function initContentScript() {
    // Prevent multiple initializations
    if (despairBlockerActive) {
        return;
    }

    despairBlockerActive = true;

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
            if (request.action === 'checkBlockStatus') {
                sendResponse({
                    url: window.location.href,
                    title: document.title || 'Loading...'
                });
            }
        } catch (error) {
            console.error('Despair Blocker: Message handling error:', error);
            sendResponse({ error: error.message });
        }
    });

    // Initialize URL monitoring when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUrlMonitoring);
    } else {
        initUrlMonitoring();
    }

})();

/**
 * Initialize URL monitoring for SPA navigation detection
 */
function initUrlMonitoring() {
    try {
        // Create mutation observer for DOM changes
        urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                handleUrlChange();
            }
        });

        // Wait for document.body to be available
        if (document.body) {
            startObserving();
        } else {
            // If body is not ready, wait for it
            const bodyObserver = new MutationObserver((mutations, observer) => {
                if (document.body) {
                    observer.disconnect();
                    startObserving();
                }
            });

            bodyObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }

        // Also listen for popstate events (back/forward navigation)
        window.addEventListener('popstate', handleUrlChange);

        // Listen for pushstate/replacestate (programmatic navigation)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(history, args);
            handleUrlChange();
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(history, args);
            handleUrlChange();
        };

    } catch (error) {
        console.error('Despair Blocker: URL monitoring initialization error:', error);
        // Fallback to periodic checking
        startPeriodicUrlCheck();
    }
}

/**
 * Start observing DOM changes
 */
function startObserving() {
    if (urlObserver && document.body) {
        try {
            urlObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (error) {
            console.error('Despair Blocker: Error starting DOM observation:', error);
            // Fallback to periodic checking
            startPeriodicUrlCheck();
        }
    }
}

/**
 * Handle URL changes
 */
function handleUrlChange() {
    // Small delay to ensure the page has updated
    setTimeout(() => {
        try {
            chrome.runtime.sendMessage({
                action: 'urlChanged',
                url: window.location.href
            }).catch(() => {
                // Ignore errors if background script is not ready
            });
        } catch (error) {
            // Ignore messaging errors
        }
    }, 100);
}

/**
 * Fallback periodic URL checking for sites where MutationObserver doesn't work well
 */
function startPeriodicUrlCheck() {
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            handleUrlChange();
        }
    }, 1000); // Check every second
}

/**
 * Utility function to check if despair blocker is already active on page
 */
function isDespairBlockerActive() {
    return document.getElementById('despair-blocker-overlay') !== null;
}

/**
 * Handle visibility changes (tab switching)
 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Tab became visible, check if we need to block
        try {
            chrome.runtime.sendMessage({
                action: 'tabVisible',
                url: window.location.href
            }).catch(() => {
                // Ignore errors if background script is not ready
            });
        } catch (error) {
            // Ignore messaging errors
        }
    }
});

/**
 * Handle focus events (when user returns to tab)
 */
window.addEventListener('focus', () => {
    // Small delay to ensure focus is properly established
    setTimeout(() => {
        try {
            chrome.runtime.sendMessage({
                action: 'tabVisible',
                url: window.location.href
            }).catch(() => {
                // Ignore errors if background script is not ready
            });
        } catch (error) {
            // Ignore messaging errors
        }
    }, 100);
});

/**
 * Clean up function for page unload
 */
window.addEventListener('beforeunload', () => {
    despairBlockerActive = false;

    // Disconnect observer
    if (urlObserver) {
        try {
            urlObserver.disconnect();
            urlObserver = null;
        } catch (error) {
            // Ignore cleanup errors
        }
    }
});

/**
 * Handle page load completion
 */
window.addEventListener('load', () => {
    // Notify background script that page is fully loaded
    setTimeout(() => {
        try {
            chrome.runtime.sendMessage({
                action: 'pageLoaded',
                url: window.location.href
            }).catch(() => {
                // Ignore errors if background script is not ready
            });
        } catch (error) {
            // Ignore messaging errors
        }
    }, 500);
});

/**
 * Emergency cleanup function
 * Removes any blocking overlays if they get stuck
 */
function emergencyCleanup() {
    try {
        const overlay = document.getElementById('despair-blocker-overlay');
        if (overlay) {
            overlay.remove();
            document.documentElement.style.overflow = '';
        }
    } catch (error) {
        // Ignore cleanup errors
    }
}

/**
 * Add emergency cleanup on Ctrl+Shift+D
 */
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        emergencyCleanup();
    }
});

/**
 * Periodic cleanup check to prevent stuck overlays
 */
setInterval(() => {
    try {
        const overlay = document.getElementById('despair-blocker-overlay');
        if (overlay) {
            // Check if overlay has been there for more than 5 minutes
            const overlayTime = overlay.dataset.createdAt;
            if (overlayTime && Date.now() - parseInt(overlayTime) > 5 * 60 * 1000) {
                emergencyCleanup();
            } else if (!overlayTime) {
                // Add timestamp if missing
                overlay.dataset.createdAt = Date.now().toString();
            }
        }
    } catch (error) {
        // Ignore cleanup errors
    }
}, 30000); // Check every 30 seconds

/**
 * Handle extension context invalidation
 */
chrome.runtime.onConnect.addListener(() => {
    // Extension context is valid
});

/**
 * Detect if extension context becomes invalid
 */
function checkExtensionContext() {
    try {
        chrome.runtime.sendMessage({ action: 'ping' }).catch(() => {
            // Extension context is invalid, clean up
            emergencyCleanup();
        });
    } catch (error) {
        // Extension context is invalid, clean up
        emergencyCleanup();
    }
}

// Check extension context periodically
setInterval(checkExtensionContext, 60000); // Check every minute