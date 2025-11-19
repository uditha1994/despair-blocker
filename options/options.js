/**
 * Options Page JavaScript for Despair Blocker
 * Handles all settings management and user interactions
 */

// DOM Elements
const elements = {
    // Sites management
    newSiteInput: document.getElementById('newSiteInput'),
    addSiteBtn: document.getElementById('addSiteBtn'),
    sitesList: document.getElementById('sitesList'),

    // Schedule management
    scheduleEnabled: document.getElementById('scheduleEnabled'),
    scheduleSettings: document.getElementById('scheduleSettings'),
    startTime: document.getElementById('startTime'),
    endTime: document.getElementById('endTime'),
    workdayCheckboxes: document.querySelectorAll('.workday-checkbox'),

    // Messages management
    newMessageInput: document.getElementById('newMessageInput'),
    addMessageBtn: document.getElementById('addMessageBtn'),
    messagesList: document.getElementById('messagesList'),

    // Additional settings
    enableTTS: document.getElementById('enableTTS'),

    // Action buttons
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    testBtn: document.getElementById('testBtn'),

    // Status message
    statusMessage: document.getElementById('statusMessage')
};

// Current configuration state
let currentConfig = null;
let hasUnsavedChanges = false;

/**
 * Initialize the options page
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoadingState(true);
        await loadConfiguration();
        setupEventListeners();
        updateUI();
        showStatus('Settings loaded successfully', 'success');

        // Mark as no unsaved changes after initial load
        hasUnsavedChanges = false;
        updateSaveButtonState();

    } catch (error) {
        console.error('Despair Blocker: Options initialization error:', error);
        showStatus('Error loading settings. Using defaults.', 'error');

        // Load default configuration on error
        currentConfig = getDefaultConfig();
        updateUI();
    } finally {
        showLoadingState(false);
    }
});

/**
 * Load configuration from storage
 */
async function loadConfiguration() {
    try {
        const result = await chrome.storage.sync.get(['config']);

        if (result.config) {
            currentConfig = result.config;

            // Validate and fix configuration if needed
            currentConfig = validateAndFixConfig(currentConfig);
        } else {
            // Use default configuration
            currentConfig = getDefaultConfig();
            await saveConfiguration();
        }

    } catch (error) {
        console.error('Despair Blocker: Configuration load error:', error);
        currentConfig = getDefaultConfig();
        throw error;
    }
}

/**
 * Validate and fix configuration object
 */
function validateAndFixConfig(config) {
    const defaultConfig = getDefaultConfig();

    // Ensure all required properties exist
    if (!config.blockedSites || !Array.isArray(config.blockedSites)) {
        config.blockedSites = defaultConfig.blockedSites;
    }

    if (!config.schedule || typeof config.schedule !== 'object') {
        config.schedule = defaultConfig.schedule;
    } else {
        // Validate schedule properties
        if (typeof config.schedule.enabled !== 'boolean') {
            config.schedule.enabled = defaultConfig.schedule.enabled;
        }
        if (!config.schedule.startTime || !isValidTimeString(config.schedule.startTime)) {
            config.schedule.startTime = defaultConfig.schedule.startTime;
        }
        if (!config.schedule.endTime || !isValidTimeString(config.schedule.endTime)) {
            config.schedule.endTime = defaultConfig.schedule.endTime;
        }
        if (!config.schedule.workDays || !Array.isArray(config.schedule.workDays)) {
            config.schedule.workDays = defaultConfig.schedule.workDays;
        }
    }

    if (!config.despairMessages || !Array.isArray(config.despairMessages) || config.despairMessages.length === 0) {
        config.despairMessages = defaultConfig.despairMessages;
    }

    if (typeof config.enableTTS !== 'boolean') {
        config.enableTTS = defaultConfig.enableTTS;
    }

    return config;
}

/**
 * Validate time string format (HH:MM)
 */
function isValidTimeString(timeString) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
}

/**
 * Get default configuration
 */
function getDefaultConfig() {
    return {
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
            workDays: [1, 2, 3, 4, 5] // Monday to Friday
        },
        despairMessages: [
            "Hello from 3 hours from now. I didn't finish the project. I'm tired. I have to ask for an extension. All because you needed to watch one... more... cat video. Close this tab and go back to work.",
            "It's me from the future. I'm sitting here at 11 PM, stressed and overwhelmed. The deadline is tomorrow and I'm nowhere near done. This could have been avoided if you just stayed focused.",
            "Future you here. I'm disappointed. We had such good intentions this morning, but here we are again, scrolling mindlessly while our dreams slip away. Please, just close this tab.",
            "Your future self is crying. Not literally, but emotionally. The presentation is in 2 hours and I'm frantically trying to put something together. Don't let this be our reality."
        ],
        enableTTS: true
    };
}

/**
 * Save configuration to storage
 */
async function saveConfiguration() {
    try {
        // Validate configuration before saving
        currentConfig = validateAndFixConfig(currentConfig);

        await chrome.storage.sync.set({ config: currentConfig });

        // Notify background script to update schedule
        try {
            await chrome.runtime.sendMessage({ action: 'updateSchedule' });
        } catch (messageError) {
            console.warn('Could not notify background script:', messageError);
        }

        hasUnsavedChanges = false;
        updateSaveButtonState();

        return true;
    } catch (error) {
        console.error('Despair Blocker: Configuration save error:', error);
        return false;
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Sites management
    elements.addSiteBtn.addEventListener('click', addSite);
    elements.newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSite();
        }
    });
    elements.newSiteInput.addEventListener('input', markUnsavedChanges);

    // Schedule management
    elements.scheduleEnabled.addEventListener('change', toggleSchedule);
    elements.startTime.addEventListener('change', updateScheduleTime);
    elements.endTime.addEventListener('change', updateScheduleTime);
    elements.workdayCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateWorkDays);
    });

    // Messages management
    elements.addMessageBtn.addEventListener('click', addMessage);
    elements.newMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addMessage();
        }
    });
    elements.newMessageInput.addEventListener('input', markUnsavedChanges);

    // Additional settings
    elements.enableTTS.addEventListener('change', updateTTSSetting);

    // Action buttons
    elements.saveBtn.addEventListener('click', saveSettings);
    elements.resetBtn.addEventListener('click', resetSettings);
    elements.testBtn.addEventListener('click', testBlockMessage);

    // Auto-save on visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && hasUnsavedChanges) {
            saveSettings();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
    // Ctrl+S to save
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveSettings();
    }

    // Ctrl+R to reset (with confirmation)
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        resetSettings();
    }

    // Ctrl+T to test
    if (event.ctrlKey && event.key === 't') {
        event.preventDefault();
        testBlockMessage();
    }
}

/**
 * Mark that there are unsaved changes
 */
function markUnsavedChanges() {
    hasUnsavedChanges = true;
    updateSaveButtonState();
}

/**
 * Update save button state based on unsaved changes
 */
function updateSaveButtonState() {
    if (hasUnsavedChanges) {
        elements.saveBtn.textContent = '💾 Save Changes *';
        elements.saveBtn.classList.add('has-changes');
    } else {
        elements.saveBtn.textContent = '💾 Save Settings';
        elements.saveBtn.classList.remove('has-changes');
    }
}

/**
 * Show/hide loading state
 */
function showLoadingState(isLoading) {
    const container = document.querySelector('.container');
    if (isLoading) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

/**
 * Update UI with current configuration
 */
function updateUI() {
    try {
        // Update blocked sites list
        updateSitesList();

        // Update schedule settings
        elements.scheduleEnabled.checked = currentConfig.schedule.enabled;
        elements.startTime.value = currentConfig.schedule.startTime;
        elements.endTime.value = currentConfig.schedule.endTime;

        // Update work days
        elements.workdayCheckboxes.forEach(checkbox => {
            const day = parseInt(checkbox.value);
            checkbox.checked = currentConfig.schedule.workDays.includes(day);
        });

        // Update schedule visibility
        toggleScheduleVisibility();

        // Update messages list
        updateMessagesList();

        // Update additional settings
        elements.enableTTS.checked = currentConfig.enableTTS;

        // Update statistics
        updateStatistics();

    } catch (error) {
        console.error('Despair Blocker: UI update error:', error);
        showStatus('Error updating interface', 'error');
    }
}

/**
 * Update blocked sites list in UI
 */
function updateSitesList() {
    elements.sitesList.innerHTML = '';

    if (currentConfig.blockedSites.length === 0) {
        elements.sitesList.innerHTML = '<div class="empty-state">No blocked sites yet. Add some to get started!</div>';
        return;
    }

    currentConfig.blockedSites.forEach((site, index) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.style.animationDelay = `${index * 0.1}s`;

        siteItem.innerHTML = `
            <span class="site-name" title="${escapeHtml(site)}">${escapeHtml(site)}</span>
            <div class="site-actions">
                <button class="edit-site" data-index="${index}" title="Edit site">✏️</button>
                <button class="remove-site" data-index="${index}" title="Remove site">🗑️</button>
            </div>
        `;

        // Add event listeners
        const editBtn = siteItem.querySelector('.edit-site');
        const removeBtn = siteItem.querySelector('.remove-site');

        editBtn.addEventListener('click', () => editSite(index));
        removeBtn.addEventListener('click', () => removeSite(index));

        elements.sitesList.appendChild(siteItem);
    });
}

/**
 * Update messages list in UI
 */
function updateMessagesList() {
    elements.messagesList.innerHTML = '';

    if (currentConfig.despairMessages.length === 0) {
        elements.messagesList.innerHTML = '<div class="empty-state">No despair messages yet. Add some guilt-inducing messages!</div>';
        return;
    }

    currentConfig.despairMessages.forEach((message, index) => {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        messageItem.style.animationDelay = `${index * 0.1}s`;

        const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;

        messageItem.innerHTML = `
            <div class="message-text" title="${escapeHtml(message)}">"${escapeHtml(truncatedMessage)}"</div>
            <div class="message-actions">
                <button class="edit-message" data-index="${index}" title="Edit message">✏️</button>
                <button class="test-message" data-index="${index}" title="Test this message">🧪</button>
                <button class="remove-message" data-index="${index}" title="Remove message">🗑️</button>
            </div>
        `;

        // Add event listeners
        const editBtn = messageItem.querySelector('.edit-message');
        const testBtn = messageItem.querySelector('.test-message');
        const removeBtn = messageItem.querySelector('.remove-message');

        editBtn.addEventListener('click', () => editMessage(index));
        testBtn.addEventListener('click', () => testSpecificMessage(index));
        removeBtn.addEventListener('click', () => removeMessage(index));

        elements.messagesList.appendChild(messageItem);
    });
}

/**
 * Update statistics display
 */
function updateStatistics() {
    // This could be expanded to show more detailed statistics
    const statsContainer = document.querySelector('.statistics-container');
    if (statsContainer) {
        const totalSites = currentConfig.blockedSites.length;
        const totalMessages = currentConfig.despairMessages.length;
        const scheduleStatus = currentConfig.schedule.enabled ? 'Enabled' : 'Disabled';

        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${totalSites}</span>
                <span class="stat-label">Blocked Sites</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${totalMessages}</span>
                <span class="stat-label">Despair Messages</span>
            </div>
            <div class="stat-item">
                <span class="stat-status ${scheduleStatus.toLowerCase()}">${scheduleStatus}</span>
                <span class="stat-label">Schedule</span>
            </div>
        `;
    }
}

/**
 * Add new blocked site
 */
function addSite() {
    const siteInput = elements.newSiteInput.value.trim();

    if (!siteInput) {
        showStatus('Please enter a website URL', 'error');
        elements.newSiteInput.focus();
        return;
    }

    // Validate URL format
    if (!isValidSiteUrl(siteInput)) {
        showStatus('Please enter a valid website URL (e.g., youtube.com)', 'error');
        elements.newSiteInput.focus();
        return;
    }

    // Clean up the input
    const cleanSite = cleanSiteUrl(siteInput);

    // Check if site already exists
    if (currentConfig.blockedSites.some(site => site.toLowerCase() === cleanSite.toLowerCase())) {
        showStatus('This site is already blocked', 'error');
        elements.newSiteInput.focus();
        return;
    }

    // Add to configuration
    currentConfig.blockedSites.push(cleanSite);

    // Update UI
    updateSitesList();
    elements.newSiteInput.value = '';

    markUnsavedChanges();
    showStatus(`Added ${cleanSite} to blocked sites`, 'success');

    // Auto-focus back to input for easy multiple additions
    elements.newSiteInput.focus();
}

/**
 * Edit existing site
 */
function editSite(index) {
    const currentSite = currentConfig.blockedSites[index];
    const newSite = prompt('Edit blocked site:', currentSite);

    if (newSite === null) {
        return; // User cancelled
    }

    const cleanNewSite = cleanSiteUrl(newSite.trim());

    if (!cleanNewSite) {
        showStatus('Please enter a valid website URL', 'error');
        return;
    }

    // Check if new site already exists (excluding current one)
    const existingIndex = currentConfig.blockedSites.findIndex((site, i) =>
        i !== index && site.toLowerCase() === cleanNewSite.toLowerCase()
    );

    if (existingIndex !== -1) {
        showStatus('This site is already blocked', 'error');
        return;
    }

    // Update the site
    currentConfig.blockedSites[index] = cleanNewSite;
    updateSitesList();
    markUnsavedChanges();
    showStatus(`Updated site to ${cleanNewSite}`, 'success');
}

/**
 * Remove blocked site
 */
function removeSite(index) {
    const removedSite = currentConfig.blockedSites[index];

    if (!confirm(`Are you sure you want to remove "${removedSite}" from blocked sites?`)) {
        return;
    }

    currentConfig.blockedSites.splice(index, 1);
    updateSitesList();
    markUnsavedChanges();
    showStatus(`Removed ${removedSite} from blocked sites`, 'info');
}

/**
 * Validate site URL format
 */
function isValidSiteUrl(url) {
    // Basic validation for domain names
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.?[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    const cleanUrl = cleanSiteUrl(url);

    // Allow simple domain names and subdomains
    return cleanUrl.length > 0 && (
        domainRegex.test(cleanUrl) ||
        cleanUrl.includes('.') ||
        cleanUrl.length > 3 // Allow simple cases like "reddit"
    );
}

/**
 * Clean site URL for consistent storage
 */
function cleanSiteUrl(url) {
    return url
        .replace(/^https?:\/\//, '') // Remove protocol
        .replace(/^www\./, '')       // Remove www
        .replace(/\/$/, '')          // Remove trailing slash
        .replace(/\/.*$/, '')        // Remove path
        .toLowerCase()
        .trim();
}

/**
 * Toggle schedule enabled/disabled
 */
function toggleSchedule() {
    currentConfig.schedule.enabled = elements.scheduleEnabled.checked;
    toggleScheduleVisibility();
    markUnsavedChanges();
    showStatus(`Schedule ${currentConfig.schedule.enabled ? 'enabled' : 'disabled'}`, 'info');
}

/**
 * Toggle schedule settings visibility
 */
function toggleScheduleVisibility() {
    if (currentConfig.schedule.enabled) {
        elements.scheduleSettings.classList.remove('disabled');
        elements.scheduleSettings.style.opacity = '1';
        elements.scheduleSettings.style.pointerEvents = 'auto';
    } else {
        elements.scheduleSettings.classList.add('disabled');
        elements.scheduleSettings.style.opacity = '0.5';
        elements.scheduleSettings.style.pointerEvents = 'none';
    }
}

/**
 * Update schedule time settings
 */
function updateScheduleTime() {
    const startTime = elements.startTime.value;
    const endTime = elements.endTime.value;

    // Validate time format
    if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
        showStatus('Please enter valid time format (HH:MM)', 'error');
        return;
    }

    // Validate time range
    if (startTime >= endTime) {
        showStatus('End time must be after start time', 'error');
        // Reset to previous values
        elements.startTime.value = currentConfig.schedule.startTime;
        elements.endTime.value = currentConfig.schedule.endTime;
        return;
    }

    // Check for reasonable work hours (not more than 16 hours)
    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = timeStringToMinutes(endTime);
    const duration = endMinutes - startMinutes;

    if (duration > 16 * 60) {
        if (!confirm('You\'ve set a work period longer than 16 hours. Are you sure this is correct?')) {
            elements.startTime.value = currentConfig.schedule.startTime;
            elements.endTime.value = currentConfig.schedule.endTime;
            return;
        }
    }

    currentConfig.schedule.startTime = startTime;
    currentConfig.schedule.endTime = endTime;

    markUnsavedChanges();
    showStatus('Schedule times updated', 'success');
}

/**
 * Convert time string to minutes since midnight
 */
function timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Update work days selection
 */
function updateWorkDays() {
    const selectedDays = [];
    elements.workdayCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedDays.push(parseInt(checkbox.value));
        }
    });

    if (selectedDays.length === 0) {
        showStatus('Please select at least one work day', 'error');
        // Reset to previous selection
        elements.workdayCheckboxes.forEach(checkbox => {
            const day = parseInt(checkbox.value);
            checkbox.checked = currentConfig.schedule.workDays.includes(day);
        });
        return;
    }

    currentConfig.schedule.workDays = selectedDays;
    markUnsavedChanges();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const selectedDayNames = selectedDays.map(day => dayNames[day]).join(', ');
    showStatus(`Work days updated: ${selectedDayNames}`, 'success');
}

/**
 * Add new despair message
 */
function addMessage() {
    const messageInput = elements.newMessageInput.value.trim();

    if (!messageInput) {
        showStatus('Please enter a message', 'error');
        elements.newMessageInput.focus();
        return;
    }

    if (messageInput.length < 10) {
        showStatus('Message should be at least 10 characters long for maximum despair', 'error');
        elements.newMessageInput.focus();
        return;
    }

    if (messageInput.length > 500) {
        showStatus('Message is too long. Please keep it under 500 characters for better readability.', 'error');
        elements.newMessageInput.focus();
        return;
    }

    // Check for duplicate messages
    if (currentConfig.despairMessages.some(msg => msg.toLowerCase() === messageInput.toLowerCase())) {
        showStatus('This message already exists', 'error');
        elements.newMessageInput.focus();
        return;
    }

    // Add to configuration
    currentConfig.despairMessages.push(messageInput);

    // Update UI
    updateMessagesList();
    elements.newMessageInput.value = '';

    markUnsavedChanges();
    showStatus('Despair message added successfully', 'success');

    // Auto-focus back to input
    elements.newMessageInput.focus();
}

/**
 * Edit existing message
 */
function editMessage(index) {
    const currentMessage = currentConfig.despairMessages[index];
    const newMessage = prompt('Edit despair message:', currentMessage);

    if (newMessage === null) {
        return; // User cancelled
    }

    const trimmedMessage = newMessage.trim();

    if (!trimmedMessage) {
        showStatus('Message cannot be empty', 'error');
        return;
    }

    if (trimmedMessage.length < 10) {
        showStatus('Message should be at least 10 characters long', 'error');
        return;
    }

    if (trimmedMessage.length > 500) {
        showStatus('Message is too long. Please keep it under 500 characters.', 'error');
        return;
    }

    // Check for duplicates (excluding current message)
    const existingIndex = currentConfig.despairMessages.findIndex((msg, i) =>
        i !== index && msg.toLowerCase() === trimmedMessage.toLowerCase()
    );

    if (existingIndex !== -1) {
        showStatus('This message already exists', 'error');
        return;
    }

    // Update the message
    currentConfig.despairMessages[index] = trimmedMessage;
    updateMessagesList();
    markUnsavedChanges();
    showStatus('Message updated successfully', 'success');
}

/**
 * Remove despair message
 */
function removeMessage(index) {
    if (currentConfig.despairMessages.length <= 1) {
        showStatus('You must have at least one despair message', 'error');
        return;
    }

    const messagePreview = currentConfig.despairMessages[index].substring(0, 50) + '...';

    if (!confirm(`Are you sure you want to remove this message?\n\n"${messagePreview}"`)) {
        return;
    }

    currentConfig.despairMessages.splice(index, 1);
    updateMessagesList();
    markUnsavedChanges();
    showStatus('Despair message removed', 'info');
}

/**
 * Test specific message
 */
function testSpecificMessage(index) {
    const message = currentConfig.despairMessages[index];
    showTestBlockOverlay(message);
}

/**
 * Update TTS setting
 */
function updateTTSSetting() {
    currentConfig.enableTTS = elements.enableTTS.checked;
    markUnsavedChanges();
    showStatus(`Text-to-speech ${currentConfig.enableTTS ? 'enabled' : 'disabled'}`, 'info');
}

/**
 * Save all settings
 */
async function saveSettings() {
    if (!hasUnsavedChanges) {
        showStatus('No changes to save', 'info');
        return;
    }

    elements.saveBtn.classList.add('loading');
    elements.saveBtn.disabled = true;

    try {
        const success = await saveConfiguration();

        if (success) {
            showStatus('Settings saved successfully!', 'success');

            // Show save confirmation animation
            elements.saveBtn.classList.add('saved');
            setTimeout(() => {
                elements.saveBtn.classList.remove('saved');
            }, 2000);
        } else {
            showStatus('Error saving settings. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Despair Blocker: Save error:', error);
        showStatus('Error saving settings. Please check your internet connection.', 'error');
    } finally {
        elements.saveBtn.classList.remove('loading');
        elements.saveBtn.disabled = false;
    }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
    const confirmed = confirm(
        'Are you sure you want to reset all settings to defaults?\n\n' +
        'This will:\n' +
        '• Reset blocked sites to default list\n' +
        '• Reset schedule to 9 AM - 5 PM, weekdays\n' +
        '• Reset despair messages to defaults\n' +
        '• Enable text-to-speech\n\n' +
        'This action cannot be undone.'
    );

    if (!confirmed) {
        return;
    }

    elements.resetBtn.classList.add('loading');
    elements.resetBtn.disabled = true;

    try {
        currentConfig = getDefaultConfig();
        await saveConfiguration();
        updateUI();
        showStatus('Settings reset to defaults', 'info');

        // Show reset confirmation
        elements.resetBtn.classList.add('reset');
        setTimeout(() => {
            elements.resetBtn.classList.remove('reset');
        }, 2000);

    } catch (error) {
        console.error('Despair Blocker: Reset error:', error);
        showStatus('Error resetting settings', 'error');
    } finally {
        elements.resetBtn.classList.remove('loading');
        elements.resetBtn.disabled = false;
    }
}

/**
 * Test block message functionality
 */
function testBlockMessage() {
    const randomMessage = currentConfig.despairMessages[
        Math.floor(Math.random() * currentConfig.despairMessages.length)
    ];

    showTestBlockOverlay(randomMessage);
}

/**
 * Show test block overlay
 */
function showTestBlockOverlay(message) {
    // Remove existing test overlay
    const existingOverlay = document.getElementById('test-despair-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create test overlay
    const testOverlay = document.createElement('div');
    testOverlay.id = 'test-despair-overlay';
    testOverlay.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d1b2e 50%, #1a1a1a 100%);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            animation: testFadeIn 0.5s ease-out;
        ">
            <div style="
                text-align: center;
                max-width: 600px;
                padding: 40px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 20px;
                border: 2px solid #ff6b6b;
                box-shadow: 0 20px 60px rgba(255, 107, 107, 0.3);
                position: relative;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px; animation: testFloat 3s ease-in-out infinite;">💀</div>
                <h1 style="
                    color: #ff6b6b;
                    font-size: 2.5rem;
                    font-weight: bold;
                                        margin: 0 0 30px 0;
                    text-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
                    letter-spacing: 2px;
                ">TEST: BLOCKED BY DESPAIR</h1>
                <div style="
                    color: #ffffff;
                    font-size: 1.2rem;
                    line-height: 1.6;
                    margin-bottom: 40px;
                    padding: 20px;
                    background: rgba(255, 107, 107, 0.1);
                    border-radius: 10px;
                    border-left: 4px solid #ff6b6b;
                ">${escapeHtml(message)}</div>
                <div style="margin-bottom: 30px;">
                    <button id="testTTSBtn" style="
                        padding: 15px 30px;
                        margin: 0 10px;
                        border: none;
                        border-radius: 25px;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        background: linear-gradient(45deg, #28a745, #34ce57);
                        color: white;
                        box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
                        transition: all 0.3s ease;
                    ">🔊 Test TTS</button>
                    <button id="closeTestBtn" style="
                        padding: 15px 30px;
                        margin: 0 10px;
                        border: none;
                        border-radius: 25px;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
                        color: white;
                        box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
                        transition: all 0.3s ease;
                    ">Close Test</button>
                </div>
                <div style="
                    color: #666;
                    font-size: 0.9rem;
                    font-style: italic;
                ">This is how the blocking overlay will appear on blocked sites</div>
            </div>
        </div>
        <style>
            @keyframes testFadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes testFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
        </style>
    `;

    document.body.appendChild(testOverlay);

    // Add event listeners
    document.getElementById('closeTestBtn').addEventListener('click', () => {
        testOverlay.remove();
    });

    document.getElementById('testTTSBtn').addEventListener('click', () => {
        testTextToSpeech(message);
    });

    // Close on ESC key
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            testOverlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Auto-close after 30 seconds
    setTimeout(() => {
        if (document.getElementById('test-despair-overlay')) {
            testOverlay.remove();
        }
    }, 30000);

    showStatus('Test block message displayed', 'info');
}

/**
 * Test text-to-speech functionality
 */
function testTextToSpeech(message) {
    if (!currentConfig.enableTTS) {
        showStatus('Text-to-speech is disabled. Enable it in settings to test.', 'error');
        return;
    }

    if (!('speechSynthesis' in window)) {
        showStatus('Text-to-speech is not supported in your browser', 'error');
        return;
    }

    try {
        // Stop any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.8;
        utterance.pitch = 0.7;
        utterance.volume = 0.8;

        utterance.onstart = () => {
            showStatus('Playing text-to-speech...', 'info');
        };

        utterance.onend = () => {
            showStatus('Text-to-speech completed', 'success');
        };

        utterance.onerror = (event) => {
            console.error('TTS Error:', event);
            showStatus('Text-to-speech error occurred', 'error');
        };

        speechSynthesis.speak(utterance);

    } catch (error) {
        console.error('TTS Test Error:', error);
        showStatus('Error testing text-to-speech', 'error');
    }
}

/**
 * Show status message to user
 */
function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.add('show');

    // Auto-hide after delay based on message type
    const hideDelay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        elements.statusMessage.classList.remove('show');
    }, hideDelay);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Import settings from JSON
 */
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedConfig = JSON.parse(text);

            // Validate imported configuration
            const validatedConfig = validateAndFixConfig(importedConfig);

            if (confirm('Are you sure you want to import these settings? This will overwrite your current configuration.')) {
                currentConfig = validatedConfig;
                updateUI();
                markUnsavedChanges();
                showStatus('Settings imported successfully', 'success');
            }

        } catch (error) {
            console.error('Import error:', error);
            showStatus('Error importing settings. Please check the file format.', 'error');
        }
    };

    input.click();
}

/**
 * Export settings to JSON
 */
function exportSettings() {
    try {
        const dataStr = JSON.stringify(currentConfig, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `despair-blocker-settings-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        showStatus('Settings exported successfully', 'success');

    } catch (error) {
        console.error('Export error:', error);
        showStatus('Error exporting settings', 'error');
    }
}

/**
 * Add import/export buttons if they exist in HTML
 */
document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');

    if (importBtn) {
        importBtn.addEventListener('click', importSettings);
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportSettings);
    }
});

/**
 * Handle storage changes from other instances
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.config) {
        const newConfig = changes.config.newValue;

        if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
            currentConfig = newConfig;
            updateUI();
            hasUnsavedChanges = false;
            updateSaveButtonState();
            showStatus('Settings updated from another instance', 'info');
        }
    }
});

/**
 * Handle beforeunload to warn about unsaved changes
 */
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        const confirmationMessage = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

/**
 * Auto-save functionality
 */
let autoSaveTimeout;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (hasUnsavedChanges) {
            saveSettings();
        }
    }, 30000); // Auto-save after 30 seconds of inactivity
}

// Schedule auto-save when changes are made
function markUnsavedChanges() {
    hasUnsavedChanges = true;
    updateSaveButtonState();
    scheduleAutoSave();
}

/**
 * Bulk operations for sites
 */
function addMultipleSites() {
    const sitesText = prompt(
        'Enter multiple sites separated by commas or new lines:\n\n' +
        'Example:\n' +
        'youtube.com, facebook.com\n' +
        'twitter.com\n' +
        'instagram.com'
    );

    if (!sitesText) return;

    const sites = sitesText
        .split(/[,\n]/)
        .map(site => cleanSiteUrl(site.trim()))
        .filter(site => site && isValidSiteUrl(site));

    if (sites.length === 0) {
        showStatus('No valid sites found', 'error');
        return;
    }

    let addedCount = 0;
    sites.forEach(site => {
        if (!currentConfig.blockedSites.some(existing => existing.toLowerCase() === site.toLowerCase())) {
            currentConfig.blockedSites.push(site);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        updateSitesList();
        markUnsavedChanges();
        showStatus(`Added ${addedCount} new site(s)`, 'success');
    } else {
        showStatus('All sites were already in the blocked list', 'info');
    }
}

/**
 * Clear all sites
 */
function clearAllSites() {
    if (!confirm('Are you sure you want to remove ALL blocked sites? This cannot be undone.')) {
        return;
    }

    const removedCount = currentConfig.blockedSites.length;
    currentConfig.blockedSites = [];
    updateSitesList();
    markUnsavedChanges();
    showStatus(`Removed ${removedCount} site(s)`, 'info');
}

/**
 * Add bulk operation buttons if they exist
 */
document.addEventListener('DOMContentLoaded', () => {
    const bulkAddBtn = document.getElementById('bulkAddBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if (bulkAddBtn) {
        bulkAddBtn.addEventListener('click', addMultipleSites);
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllSites);
    }
});

/**
 * Search functionality for sites and messages
 */
function setupSearchFunctionality() {
    const siteSearchInput = document.getElementById('siteSearch');
    const messageSearchInput = document.getElementById('messageSearch');

    if (siteSearchInput) {
        siteSearchInput.addEventListener('input', (e) => {
            filterSites(e.target.value);
        });
    }

    if (messageSearchInput) {
        messageSearchInput.addEventListener('input', (e) => {
            filterMessages(e.target.value);
        });
    }
}

/**
 * Filter sites based on search term
 */
function filterSites(searchTerm) {
    const siteItems = document.querySelectorAll('.site-item');
    const term = searchTerm.toLowerCase();

    siteItems.forEach(item => {
        const siteName = item.querySelector('.site-name').textContent.toLowerCase();
        if (siteName.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Filter messages based on search term
 */
function filterMessages(searchTerm) {
    const messageItems = document.querySelectorAll('.message-item');
    const term = searchTerm.toLowerCase();

    messageItems.forEach(item => {
        const messageText = item.querySelector('.message-text').textContent.toLowerCase();
        if (messageText.includes(term)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize search functionality when DOM is ready
document.addEventListener('DOMContentLoaded', setupSearchFunctionality);

/**
 * Theme toggle functionality
 */
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('despair-blocker-theme', newTheme);

    showStatus(`Switched to ${newTheme} theme`, 'info');
}

// Load saved theme
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('despair-blocker-theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

/**
 * Accessibility improvements
 */
function setupAccessibility() {
    // Add ARIA labels and roles
    const sitesList = document.getElementById('sitesList');
    if (sitesList) {
        sitesList.setAttribute('role', 'list');
        sitesList.setAttribute('aria-label', 'Blocked sites list');
    }

    const messagesList = document.getElementById('messagesList');
    if (messagesList) {
        messagesList.setAttribute('role', 'list');
        messagesList.setAttribute('aria-label', 'Despair messages list');
    }

    // Add keyboard navigation for custom elements
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            // Ensure proper tab order
            const focusableElements = document.querySelectorAll(
                'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
            );

            // Add visual focus indicators
            focusableElements.forEach(el => {
                el.addEventListener('focus', () => {
                    el.classList.add('keyboard-focus');
                });
                el.addEventListener('blur', () => {
                    el.classList.remove('keyboard-focus');
                });
            });
        }
    });
}

// Initialize accessibility features
document.addEventListener('DOMContentLoaded', setupAccessibility);

/**
 * Performance monitoring
 */
function logPerformanceMetrics() {
    if (performance.mark) {
        performance.mark('options-page-loaded');

        // Log timing information
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        if (navigationTiming) {
            console.log('Despair Blocker Options Performance:', {
                domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
                loadComplete: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
                totalTime: navigationTiming.loadEventEnd - navigationTiming.navigationStart
            });
        }
    }
}

// Log performance metrics when page is fully loaded
window.addEventListener('load', logPerformanceMetrics);

/**
 * Error boundary for graceful error handling
 */
window.addEventListener('error', (event) => {
    console.error('Despair Blocker Options Error:', event.error);
    showStatus('An unexpected error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Despair Blocker Options Promise Rejection:', event.reason);
    showStatus('An error occurred while processing your request.', 'error');
});

/**
 * Tooltip functionality for help text
 */
function setupTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');

    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('focus', showTooltip);
        element.addEventListener('blur', hideTooltip);
    });
}

function showTooltip(event) {
    const element = event.target;
    const tooltipText = element.getAttribute('data-tooltip');

    if (!tooltipText) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    tooltip.id = 'active-tooltip';

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';

    // Show tooltip
    setTimeout(() => tooltip.classList.add('show'), 10);
}

function hideTooltip() {
    const tooltip = document.getElementById('active-tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
        setTimeout(() => tooltip.remove(), 200);
    }
}

// Initialize tooltips
document.addEventListener('DOMContentLoaded', setupTooltips);

/**
 * Advanced validation for configuration
 */
function validateCompleteConfiguration(config) {
    const errors = [];

    // Validate blocked sites
    if (!config.blockedSites || !Array.isArray(config.blockedSites)) {
        errors.push('Blocked sites must be an array');
    } else {
        config.blockedSites.forEach((site, index) => {
            if (typeof site !== 'string' || !site.trim()) {
                errors.push(`Blocked site at index ${index} is invalid`);
            }
        });
    }

    // Validate schedule
    if (!config.schedule || typeof config.schedule !== 'object') {
        errors.push('Schedule configuration is missing or invalid');
    } else {
        if (typeof config.schedule.enabled !== 'boolean') {
            errors.push('Schedule enabled flag must be boolean');
        }

        if (!isValidTimeString(config.schedule.startTime)) {
            errors.push('Start time format is invalid');
        }

        if (!isValidTimeString(config.schedule.endTime)) {
            errors.push('End time format is invalid');
        }

        if (!Array.isArray(config.schedule.workDays)) {
            errors.push('Work days must be an array');
        } else {
            const validDays = [0, 1, 2, 3, 4, 5, 6];
            config.schedule.workDays.forEach(day => {
                if (!validDays.includes(day)) {
                    errors.push(`Invalid work day: ${day}`);
                }
            });
        }
    }

    // Validate messages
    if (!config.despairMessages || !Array.isArray(config.despairMessages)) {
        errors.push('Despair messages must be an array');
    } else if (config.despairMessages.length === 0) {
        errors.push('At least one despair message is required');
    } else {
        config.despairMessages.forEach((message, index) => {
            if (typeof message !== 'string' || message.trim().length < 10) {
                errors.push(`Message at index ${index} is too short or invalid`);
            }
        });
    }

    // Validate TTS setting
    if (typeof config.enableTTS !== 'boolean') {
        errors.push('TTS setting must be boolean');
    }

    return errors;
}

/**
 * Configuration backup and restore
 */
function createConfigurationBackup() {
    const backup = {
        config: currentConfig,
        timestamp: Date.now(),
        version: '1.0',
        userAgent: navigator.userAgent
    };

    localStorage.setItem('despair-blocker-backup', JSON.stringify(backup));
    showStatus('Configuration backup created', 'success');
}

function restoreConfigurationBackup() {
    try {
        const backupStr = localStorage.getItem('despair-blocker-backup');
        if (!backupStr) {
            showStatus('No backup found', 'error');
            return;
        }

        const backup = JSON.parse(backupStr);
        const backupDate = new Date(backup.timestamp).toLocaleString();

        if (confirm(`Restore configuration from backup created on ${backupDate}?`)) {
            currentConfig = backup.config;
            updateUI();
            markUnsavedChanges();
            showStatus('Configuration restored from backup', 'success');
        }

    } catch (error) {
        console.error('Backup restore error:', error);
        showStatus('Error restoring backup', 'error');
    }
}

/**
 * Quick setup wizard for new users
 */
function startQuickSetup() {
    const isFirstTime = !localStorage.getItem('despair-blocker-setup-complete');

    if (!isFirstTime) {
        if (!confirm('Run the setup wizard again? This will guide you through the basic configuration.')) {
            return;
        }
    }

    showQuickSetupModal();
}

function showQuickSetupModal() {
    const modal = document.createElement('div');
    modal.className = 'setup-modal';
    modal.innerHTML = `
        <div class="setup-modal-content">
            <div class="setup-header">
                <h2>🚀 Quick Setup Wizard</h2>
                <p>Let's get you started with Despair Blocker!</p>
            </div>
            
            <div class="setup-steps">
                <div class="setup-step active" data-step="1">
                    <h3>Step 1: Choose Your Distractions</h3>
                    <p>Select the websites that distract you the most:</p>
                    <div class="quick-sites">
                        <label><input type="checkbox" value="youtube.com" checked> YouTube</label>
                        <label><input type="checkbox" value="facebook.com" checked> Facebook</label>
                        <label><input type="checkbox" value="twitter.com" checked> Twitter</label>
                        <label><input type="checkbox" value="instagram.com" checked> Instagram</label>
                        <label><input type="checkbox" value="reddit.com" checked> Reddit</label>
                        <label><input type="checkbox" value="tiktok.com" checked> TikTok</label>
                        <label><input type="checkbox" value="netflix.com"> Netflix</label>
                        <label><input type="checkbox" value="twitch.tv"> Twitch</label>
                    </div>
                </div>
                
                <div class="setup-step" data-step="2">
                    <h3>Step 2: Set Your Work Hours</h3>
                    <p>When do you need to stay focused?</p>
                    <div class="quick-schedule">
                        <label>Start Time: <input type="time" id="quickStartTime" value="09:00"></label>
                        <label>End Time: <input type="time" id="quickEndTime" value="17:00"></label>
                        <div class="quick-days">
                            <label><input type="checkbox" value="1" checked> Mon</label>
                            <label><input type="checkbox" value="2" checked> Tue</label>
                            <label><input type="checkbox" value="3" checked> Wed</label>
                            <label><input type="checkbox" value="4" checked> Thu</label>
                            <label><input type="checkbox" value="5" checked> Fri</label>
                            <label><input type="checkbox" value="6"> Sat</label>
                            <label><input type="checkbox" value="0"> Sun</label>
                        </div>
                    </div>
                </div>
                
                <div class="setup-step" data-step="3">
                    <h3>Step 3: Personalize Your Message</h3>
                    <p>Write a message from your future self:</p>
                    <textarea id="quickMessage" placeholder="Dear past me, I'm disappointed that you chose to procrastinate instead of..."></textarea>
                </div>
            </div>
            
            <div class="setup-navigation">
                <button id="setupPrev" class="btn btn-secondary" disabled>Previous</button>
                <button id="setupNext" class="btn btn-primary">Next</button>
                <button id="setupFinish" class="btn btn-success" style="display: none;">Finish Setup</button>
                <button id="setupSkip" class="btn btn-tertiary">Skip Setup</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup wizard navigation
    let currentStep = 1;
    const totalSteps = 3;

    function updateStep() {
        document.querySelectorAll('.setup-step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === currentStep);
        });

        document.getElementById('setupPrev').disabled = currentStep === 1;
        document.getElementById('setupNext').style.display = currentStep === totalSteps ? 'none' : 'inline-block';
        document.getElementById('setupFinish').style.display = currentStep === totalSteps ? 'inline-block' : 'none';
    }

    document.getElementById('setupNext').addEventListener('click', () => {
        if (currentStep < totalSteps) {
            currentStep++;
            updateStep();
        }
    });

    document.getElementById('setupPrev').addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateStep();
        }
    });

    document.getElementById('setupFinish').addEventListener('click', () => {
        finishQuickSetup(modal);
    });

    document.getElementById('setupSkip').addEventListener('click', () => {
        modal.remove();
        localStorage.setItem('despair-blocker-setup-complete', 'true');
    });
}

function finishQuickSetup(modal) {
    try {
        // Collect selected sites
        const selectedSites = Array.from(modal.querySelectorAll('.quick-sites input:checked'))
            .map(input => input.value);

        // Collect schedule
        const startTime = modal.querySelector('#quickStartTime').value;
        const endTime = modal.querySelector('#quickEndTime').value;
        const selectedDays = Array.from(modal.querySelectorAll('.quick-days input:checked'))
            .map(input => parseInt(input.value));

        // Collect custom message
        const customMessage = modal.querySelector('#quickMessage').value.trim();

        // Update configuration
        currentConfig.blockedSites = selectedSites;
        currentConfig.schedule.startTime = startTime;
        currentConfig.schedule.endTime = endTime;
        currentConfig.schedule.workDays = selectedDays;

        if (customMessage) {
            currentConfig.despairMessages.unshift(customMessage);
        }

        // Update UI and save
        updateUI();
        markUnsavedChanges();
        saveSettings();

        modal.remove();
        localStorage.setItem('despair-blocker-setup-complete', 'true');

        showStatus('Quick setup completed! Your Despair Blocker is ready to help you stay focused.', 'success');

    } catch (error) {
        console.error('Quick setup error:', error);
        showStatus('Error completing setup', 'error');
    }
}

// Check if this is first time and show setup
document.addEventListener('DOMContentLoaded', () => {
    const isFirstTime = !localStorage.getItem('despair-blocker-setup-complete');
    if (isFirstTime) {
        setTimeout(startQuickSetup, 1000); // Show after page loads
    }

    // Add setup button if it exists
    const setupBtn = document.getElementById('quickSetupBtn');
    if (setupBtn) {
        setupBtn.addEventListener('click', startQuickSetup);
    }
});

/**
 * Analytics and usage tracking (privacy-friendly)
 */
function trackUsage(action, data = {}) {
    try {
        const usage = JSON.parse(localStorage.getItem('despair-blocker-usage') || '{}');

        if (!usage[action]) {
            usage[action] = { count: 0, lastUsed: null };
        }

        usage[action].count++;
        usage[action].lastUsed = Date.now();

        if (data) {
            usage[action].data = data;
        }

        localStorage.setItem('despair-blocker-usage', JSON.stringify(usage));

    } catch (error) {
        // Ignore analytics errors
    }
}

// Track common actions
document.addEventListener('DOMContentLoaded', () => {
    trackUsage('optionsPageOpened');

    // Track button clicks
    elements.saveBtn?.addEventListener('click', () => trackUsage('settingsSaved'));
    elements.testBtn?.addEventListener('click', () => trackUsage('blockTested'));
    elements.addSiteBtn?.addEventListener('click', () => trackUsage('siteAdded'));
    elements.addMessageBtn?.addEventListener('click', () => trackUsage('messageAdded'));
});

/**
 * Final initialization and cleanup
 */
document.addEventListener('DOMContentLoaded', () => {
    // Add version info to footer
    const footer = document.querySelector('.footer');
    if (footer) {
        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.innerHTML = `
            <small>
                Despair Blocker v1.0 | 
                <a href="#" id="showUsageStats">Usage Stats</a> | 
                <a href="#" id="showBackupOptions">Backup</a>
            </small>
        `;
        footer.appendChild(versionInfo);

        // Add event listeners for footer links
        document.getElementById('showUsageStats')?.addEventListener('click', (e) => {
            e.preventDefault();
            showUsageStats();
        });

        document.getElementById('showBackupOptions')?.addEventListener('click', (e) => {
            e.preventDefault();
            showBackupOptions();
        });
    }

    // Final performance mark
    if (performance.mark) {
        performance.mark('options-page-ready');
    }
});

function showUsageStats() {
    const usage = JSON.parse(localStorage.getItem('despair-blocker-usage') || '{}');

    const statsModal = document.createElement('div');
    statsModal.className = 'stats-modal';
    statsModal.innerHTML = `
        <div class="stats-modal-content">
            <div class="stats-header">
                <h2>📊 Usage Statistics</h2>
                <button class="close-stats">×</button>
            </div>
            <div class="stats-content">
                ${Object.keys(usage).length === 0 ?
            '<p>No usage data available yet.</p>' :
            Object.entries(usage).map(([action, data]) => `
                        <div class="stat-row">
                            <span class="stat-action">${formatActionName(action)}</span>
                            <span class="stat-count">${data.count} times</span>
                            <span class="stat-last">${data.lastUsed ? new Date(data.lastUsed).toLocaleDateString() : 'Never'}</span>
                        </div>
                    `).join('')
        }
            </div>
            <div class="stats-footer">
                <button id="clearStats" class="btn btn-secondary">Clear Statistics</button>
                <button id="exportStats" class="btn btn-primary">Export Data</button>
            </div>
        </div>
    `;

    document.body.appendChild(statsModal);

    // Event listeners
    statsModal.querySelector('.close-stats').addEventListener('click', () => {
        statsModal.remove();
    });

    document.getElementById('clearStats')?.addEventListener('click', () => {
        if (confirm('Clear all usage statistics?')) {
            localStorage.removeItem('despair-blocker-usage');
            statsModal.remove();
            showStatus('Usage statistics cleared', 'info');
        }
    });

    document.getElementById('exportStats')?.addEventListener('click', () => {
        const dataStr = JSON.stringify(usage, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `despair-blocker-stats-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        showStatus('Statistics exported', 'success');
    });

    // Close on outside click
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            statsModal.remove();
        }
    });
}

function formatActionName(action) {
    const actionNames = {
        'optionsPageOpened': 'Options Page Opened',
        'settingsSaved': 'Settings Saved',
        'blockTested': 'Block Tested',
        'siteAdded': 'Site Added',
        'messageAdded': 'Message Added',
        'siteRemoved': 'Site Removed',
        'messageRemoved': 'Message Removed',
        'scheduleToggled': 'Schedule Toggled',
        'settingsReset': 'Settings Reset',
        'configExported': 'Config Exported',
        'configImported': 'Config Imported'
    };

    return actionNames[action] || action.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function showBackupOptions() {
    const backupModal = document.createElement('div');
    backupModal.className = 'backup-modal';
    backupModal.innerHTML = `
        <div class="backup-modal-content">
            <div class="backup-header">
                <h2>💾 Backup & Restore</h2>
                <button class="close-backup">×</button>
            </div>
            <div class="backup-content">
                <div class="backup-section">
                    <h3>Local Backup</h3>
                    <p>Create and restore backups stored in your browser</p>
                    <div class="backup-actions">
                        <button id="createBackup" class="btn btn-primary">Create Backup</button>
                        <button id="restoreBackup" class="btn btn-secondary">Restore Backup</button>
                    </div>
                </div>
                
                <div class="backup-section">
                    <h3>File Backup</h3>
                    <p>Export and import your settings as files</p>
                    <div class="backup-actions">
                        <button id="exportConfig" class="btn btn-primary">Export Settings</button>
                        <button id="importConfig" class="btn btn-secondary">Import Settings</button>
                    </div>
                </div>
                
                <div class="backup-section">
                    <h3>Reset Options</h3>
                    <p>Reset your configuration to defaults</p>
                    <div class="backup-actions">
                        <button id="resetToDefaults" class="btn btn-danger">Reset to Defaults</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(backupModal);

    // Event listeners
    backupModal.querySelector('.close-backup').addEventListener('click', () => {
        backupModal.remove();
    });

    document.getElementById('createBackup')?.addEventListener('click', () => {
        createConfigurationBackup();
    });

    document.getElementById('restoreBackup')?.addEventListener('click', () => {
        restoreConfigurationBackup();
    });

    document.getElementById('exportConfig')?.addEventListener('click', () => {
        exportSettings();
        trackUsage('configExported');
    });

    document.getElementById('importConfig')?.addEventListener('click', () => {
        importSettings();
        trackUsage('configImported');
    });

    document.getElementById('resetToDefaults')?.addEventListener('click', () => {
        backupModal.remove();
        resetSettings();
    });

    // Close on outside click
    backupModal.addEventListener('click', (e) => {
        if (e.target === backupModal) {
            backupModal.remove();
        }
    });
}

/**
 * Advanced search and filtering
 */
function setupAdvancedSearch() {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) return;

    const advancedSearchHTML = `
        <div class="advanced-search">
            <div class="search-filters">
                <select id="searchType">
                    <option value="all">Search All</option>
                    <option value="sites">Sites Only</option>
                    <option value="messages">Messages Only</option>
                </select>
                <input type="text" id="globalSearch" placeholder="Search settings...">
                <button id="clearSearch" class="btn btn-small">Clear</button>
            </div>
            <div class="search-results" id="searchResults" style="display: none;"></div>
        </div>
    `;

    searchContainer.innerHTML = advancedSearchHTML;

    const searchInput = document.getElementById('globalSearch');
    const searchType = document.getElementById('searchType');
    const searchResults = document.getElementById('searchResults');
    const clearSearch = document.getElementById('clearSearch');

    let searchTimeout;

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        const type = searchType.value;

        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        const results = [];

        // Search sites
        if (type === 'all' || type === 'sites') {
            currentConfig.blockedSites.forEach((site, index) => {
                if (site.toLowerCase().includes(query)) {
                    results.push({
                        type: 'site',
                        content: site,
                        index: index,
                        action: () => scrollToSite(index)
                    });
                }
            });
        }

        // Search messages
        if (type === 'all' || type === 'messages') {
            currentConfig.despairMessages.forEach((message, index) => {
                if (message.toLowerCase().includes(query)) {
                    results.push({
                        type: 'message',
                        content: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
                        index: index,
                        action: () => scrollToMessage(index)
                    });
                }
            });
        }

        displaySearchResults(results, query);
    }

    function displaySearchResults(results, query) {
        if (results.length === 0) {
            searchResults.innerHTML = `<div class="no-results">No results found for "${query}"</div>`;
        } else {
            searchResults.innerHTML = results.map(result => `
                <div class="search-result" data-type="${result.type}">
                    <span class="result-type">${result.type}</span>
                    <span class="result-content">${highlightQuery(result.content, query)}</span>
                    <button class="result-action" onclick="(${result.action.toString()})()">Go to</button>
                </div>
            `).join('');
        }

        searchResults.style.display = 'block';
    }

    function highlightQuery(text, query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function scrollToSite(index) {
        const siteItems = document.querySelectorAll('.site-item');
        if (siteItems[index]) {
            siteItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            siteItems[index].classList.add('highlight');
            setTimeout(() => siteItems[index].classList.remove('highlight'), 2000);
        }
        searchResults.style.display = 'none';
        searchInput.value = '';
    }

    function scrollToMessage(index) {
        const messageItems = document.querySelectorAll('.message-item');
        if (messageItems[index]) {
            messageItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageItems[index].classList.add('highlight');
            setTimeout(() => messageItems[index].classList.remove('highlight'), 2000);
        }
        searchResults.style.display = 'none';
        searchInput.value = '';
    }

    // Event listeners
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });

    searchType.addEventListener('change', performSearch);

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.style.display = 'none';
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

/**
 * Drag and drop functionality for reordering
 */
function setupDragAndDrop() {
    // Make sites list sortable
    const sitesList = document.getElementById('sitesList');
    if (sitesList) {
        new Sortable(sitesList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function (evt) {
                // Reorder sites array
                const movedSite = currentConfig.blockedSites.splice(evt.oldIndex, 1)[0];
                currentConfig.blockedSites.splice(evt.newIndex, 0, movedSite);
                markUnsavedChanges();
                showStatus('Sites reordered', 'info');
            }
        });
    }

    // Make messages list sortable
    const messagesList = document.getElementById('messagesList');
    if (messagesList) {
        new Sortable(messagesList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function (evt) {
                // Reorder messages array
                const movedMessage = currentConfig.despairMessages.splice(evt.oldIndex, 1)[0];
                currentConfig.despairMessages.splice(evt.newIndex, 0, movedMessage);
                markUnsavedChanges();
                showStatus('Messages reordered', 'info');
            }
        });
    }
}

/**
 * Contextual help system
 */
function setupContextualHelp() {
    const helpButton = document.getElementById('helpToggle');
    if (!helpButton) return;

    let helpMode = false;

    helpButton.addEventListener('click', () => {
        helpMode = !helpMode;
        document.body.classList.toggle('help-mode', helpMode);
        helpButton.textContent = helpMode ? '❌ Exit Help' : '❓ Help';

        if (helpMode) {
            showStatus('Click on any element to get help about it', 'info');
        }
    });

    // Add help data to elements
    const helpData = {
        'newSiteInput': 'Enter a website domain (like youtube.com) that you want to block during work hours.',
        'scheduleEnabled': 'Enable this to only block sites during specific hours and days.',
        'startTime': 'The time when blocking should start each day.',
        'endTime': 'The time when blocking should end each day.',
        'enableTTS': 'When enabled, blocked sites will speak the despair message aloud.',
        'newMessageInput': 'Write a personalized message from your future self to motivate you to stay focused.'
    };

    Object.entries(helpData).forEach(([id, helpText]) => {
        const element = document.getElementById(id);
        if (element) {
            element.setAttribute('data-help', helpText);
            element.addEventListener('click', (e) => {
                if (helpMode) {
                    e.preventDefault();
                    showHelpTooltip(e.target, helpText);
                }
            });
        }
    });
}

function showHelpTooltip(element, helpText) {
    // Remove existing help tooltip
    const existingTooltip = document.querySelector('.help-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'help-tooltip';
    tooltip.innerHTML = `
        <div class="help-content">
            <p>${helpText}</p>
            <button class="close-help">Got it!</button>
        </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = rect.bottom + 10 + 'px';

    // Close tooltip
    tooltip.querySelector('.close-help').addEventListener('click', () => {
        tooltip.remove();
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    }, 10000);
}

/**
 * Final initialization call
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all advanced features
    setupAdvancedSearch();
    setupContextualHelp();

    // Initialize drag and drop if Sortable library is available
    if (typeof Sortable !== 'undefined') {
        setupDragAndDrop();
    }

    // Add keyboard shortcuts info
    addKeyboardShortcutsInfo();

    // Initialize progressive enhancement features
    initializeProgressiveEnhancements();

    // Set up periodic auto-save reminder
    setupAutoSaveReminder();

    // Initialize accessibility announcements
    setupAccessibilityAnnouncements();
});

/**
 * Add keyboard shortcuts information
 */
function addKeyboardShortcutsInfo() {
    const shortcutsInfo = document.createElement('div');
    shortcutsInfo.className = 'shortcuts-info';
    shortcutsInfo.innerHTML = `
        <details>
            <summary>⌨️ Keyboard Shortcuts</summary>
            <div class="shortcuts-list">
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>S</kbd>
                    <span>Save settings</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>T</kbd>
                    <span>Test block message</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>R</kbd>
                    <span>Reset settings</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Enter</kbd>
                    <span>Add site/message (when in input field)</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                    <span>Add message (in message textarea)</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Esc</kbd>
                    <span>Close modals/overlays</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
                    <span>Emergency cleanup (if blocking gets stuck)</span>
                </div>
            </div>
        </details>
    `;

    const footer = document.querySelector('.footer');
    if (footer) {
        footer.appendChild(shortcutsInfo);
    }
}

/**
 * Progressive enhancement features
 */
function initializeProgressiveEnhancements() {
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add loading states to all buttons
    document.querySelectorAll('button').forEach(button => {
        const originalText = button.textContent;

        button.addEventListener('click', function () {
            if (!this.disabled && !this.classList.contains('loading')) {
                // Add subtle loading indication
                this.style.opacity = '0.8';
                setTimeout(() => {
                    this.style.opacity = '';
                }, 200);
            }
        });
    });

    // Add form validation enhancements
    enhanceFormValidation();

    // Add animation observers
    setupAnimationObservers();

    // Add focus management
    setupFocusManagement();
}

/**
 * Enhanced form validation
 */
function enhanceFormValidation() {
    // Real-time validation for site input
    elements.newSiteInput?.addEventListener('input', function () {
        const value = this.value.trim();
        const isValid = !value || isValidSiteUrl(value);

        this.classList.toggle('invalid', !isValid);

        if (!isValid && value) {
            this.setAttribute('aria-describedby', 'site-error');
            let errorMsg = document.getElementById('site-error');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.id = 'site-error';
                errorMsg.className = 'error-message';
                this.parentNode.appendChild(errorMsg);
            }
            errorMsg.textContent = 'Please enter a valid website domain (e.g., youtube.com)';
        } else {
            this.removeAttribute('aria-describedby');
            const errorMsg = document.getElementById('site-error');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
    });

    // Real-time validation for time inputs
    [elements.startTime, elements.endTime].forEach(input => {
        if (!input) return;

        input.addEventListener('change', function () {
            const startTime = elements.startTime.value;
            const endTime = elements.endTime.value;

            if (startTime && endTime && startTime >= endTime) {
                this.classList.add('invalid');
                showStatus('End time must be after start time', 'error');
            } else {
                elements.startTime.classList.remove('invalid');
                elements.endTime.classList.remove('invalid');
            }
        });
    });

    // Message length validation
    elements.newMessageInput?.addEventListener('input', function () {
        const length = this.value.trim().length;
        const isValid = length === 0 || (length >= 10 && length <= 500);

        this.classList.toggle('invalid', !isValid);

        // Update character counter
        let counter = this.parentNode.querySelector('.char-counter');
        if (!counter) {
            counter = document.createElement('div');
            counter.className = 'char-counter';
            this.parentNode.appendChild(counter);
        }

        counter.textContent = `${length}/500 characters`;
        counter.classList.toggle('warning', length > 450);
        counter.classList.toggle('error', length > 500);
    });
}

/**
 * Animation observers for performance
 */
function setupAnimationObservers() {
    if ('IntersectionObserver' in window) {
        const animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });

        // Observe elements that should animate in
        document.querySelectorAll('.settings-section, .site-item, .message-item').forEach(el => {
            animationObserver.observe(el);
        });
    }
}

/**
 * Focus management for accessibility
 */
function setupFocusManagement() {
    // Track focus for keyboard users
    let isUsingKeyboard = false;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            isUsingKeyboard = true;
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', () => {
        isUsingKeyboard = false;
        document.body.classList.remove('keyboard-navigation');
    });

    // Focus management for dynamic content
    const originalUpdateSitesList = updateSitesList;
    updateSitesList = function () {
        const focusedIndex = Array.from(document.querySelectorAll('.site-item')).findIndex(item =>
            item.contains(document.activeElement)
        );

        originalUpdateSitesList.call(this);

        // Restore focus after update
        if (focusedIndex >= 0 && isUsingKeyboard) {
            const newItems = document.querySelectorAll('.site-item');
            if (newItems[focusedIndex]) {
                const focusTarget = newItems[focusedIndex].querySelector('button') || newItems[focusedIndex];
                focusTarget.focus();
            }
        }
    };

    // Similar for messages list
    const originalUpdateMessagesList = updateMessagesList;
    updateMessagesList = function () {
        const focusedIndex = Array.from(document.querySelectorAll('.message-item')).findIndex(item =>
            item.contains(document.activeElement)
        );

        originalUpdateMessagesList.call(this);

        if (focusedIndex >= 0 && isUsingKeyboard) {
            const newItems = document.querySelectorAll('.message-item');
            if (newItems[focusedIndex]) {
                const focusTarget = newItems[focusedIndex].querySelector('button') || newItems[focusedIndex];
                focusTarget.focus();
            }
        }
    };
}

/**
 * Auto-save reminder system
 */
function setupAutoSaveReminder() {
    let reminderTimeout;

    const originalMarkUnsavedChanges = markUnsavedChanges;
    markUnsavedChanges = function () {
        originalMarkUnsavedChanges.call(this);

        // Clear existing reminder
        clearTimeout(reminderTimeout);

        // Set new reminder
        reminderTimeout = setTimeout(() => {
            if (hasUnsavedChanges) {
                showStatus('💡 Reminder: You have unsaved changes', 'info');

                // Pulse the save button
                elements.saveBtn.classList.add('pulse');
                setTimeout(() => {
                    elements.saveBtn.classList.remove('pulse');
                }, 2000);
            }
        }, 60000); // Remind after 1 minute
    };
}

/**
 * Accessibility announcements
 */
function setupAccessibilityAnnouncements() {
    // Create live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'live-announcements';
    document.body.appendChild(liveRegion);

    // Announce important changes
    const originalShowStatus = showStatus;
    showStatus = function (message, type) {
        originalShowStatus.call(this, message, type);

        // Announce to screen readers for important messages
        if (type === 'success' || type === 'error') {
            liveRegion.textContent = message;

            // Clear after announcement
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    };
}

/**
 * Data validation and sanitization utilities
 */
const ValidationUtils = {
    sanitizeUrl: function (url) {
        return url.replace(/[<>'"]/g, '').trim();
    },

    sanitizeMessage: function (message) {
        return message.replace(/[<>]/g, '').trim();
    },

    validateTimeRange: function (startTime, endTime) {
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return end > start;
    },

    validateWorkDays: function (days) {
        return Array.isArray(days) &&
            days.length > 0 &&
            days.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
    }
};

/**
 * Configuration migration utilities
 */
const MigrationUtils = {
    migrateFromV1: function (oldConfig) {
        // Handle migration from older versions
        if (oldConfig.version === '1.0') {
            return oldConfig;
        }

        // Add migration logic here for future versions
        return {
            ...getDefaultConfig(),
            ...oldConfig,
            version: '1.0'
        };
    },

    validateMigration: function (config) {
        const errors = validateCompleteConfiguration(config);
        if (errors.length > 0) {
            console.warn('Configuration migration issues:', errors);
            return getDefaultConfig();
        }
        return config;
    }
};

/**
 * Performance monitoring and optimization
 */
const PerformanceMonitor = {
    startTime: Date.now(),

    mark: function (label) {
        if (performance.mark) {
            performance.mark(`despair-blocker-${label}`);
        }
    },

    measure: function (name, startMark, endMark) {
        if (performance.measure) {
            try {
                performance.measure(name, `despair-blocker-${startMark}`, `despair-blocker-${endMark}`);
            } catch (e) {
                // Ignore measurement errors
            }
        }
    },

    logMetrics: function () {
        const loadTime = Date.now() - this.startTime;
        console.log(`Despair Blocker Options loaded in ${loadTime}ms`);

        if (performance.getEntriesByType) {
            const measures = performance.getEntriesByType('measure')
                .filter(entry => entry.name.startsWith('despair-blocker'));

            measures.forEach(measure => {
                console.log(`${measure.name}: ${measure.duration.toFixed(2)}ms`);
            });
        }
    }
};

// Initialize performance monitoring
PerformanceMonitor.mark('options-start');

// Log performance metrics when everything is loaded
window.addEventListener('load', () => {
    PerformanceMonitor.mark('options-complete');
    PerformanceMonitor.measure('total-load-time', 'options-start', 'options-complete');
    setTimeout(() => PerformanceMonitor.logMetrics(), 100);
});

/**
 * Error recovery and resilience
 */
window.addEventListener('error', (event) => {
    console.error('Despair Blocker Options Error:', event.error);

    // Attempt to recover from certain errors
    if (event.error.message.includes('storage')) {
        showStatus('Storage error detected. Attempting recovery...', 'error');

        // Try to reload configuration
        setTimeout(async () => {
            try {
                await loadConfiguration();
                updateUI();
                showStatus('Configuration recovered', 'success');
            } catch (recoveryError) {
                showStatus('Unable to recover. Please refresh the page.', 'error');
            }
        }, 1000);
    }
});

/**
 * Final cleanup and export
 */
// Export utilities for testing or external use
if (typeof window !== 'undefined') {
    window.DespairBlockerOptions = {
        ValidationUtils,
        MigrationUtils,
        PerformanceMonitor,
        // Export main functions for testing
        loadConfiguration,
        saveConfiguration,
        validateAndFixConfig,
        getDefaultConfig
    };
}

// Mark options.js as fully loaded
PerformanceMonitor.mark('options-js-complete');

console.log('Despair Blocker Options v1.0 loaded successfully');