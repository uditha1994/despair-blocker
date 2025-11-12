// DOM elements
const elements = {
    newSiteInput: document.getElementById('newSiteInput'),
    addSiteBtn: document.getElementById('addSiteBtn'),
    sitesList: document.getElementById('sitesList'),

    scheduleEnabled: document.getElementById('scheduleEnabled'),
    scheduleSettings: document.getElementById('scheduleSettings'),
    startTime: document.getElementById('startTime'),
    endTime: document.getElementById('endTime'),
    workdayCheckboxes: document.getElementById('.workday-checkbox'),

    newMessageInput: document.getElementById('newMessageInput'),
    addMessageBtn: document.getElementById('addMessageBtn'),
    messageList: document.getElementById('messageList'),

    enableTTS: document.getElementById('enableTTS'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    testBtn: document.getElementById('testBtn'),

    statusMessage: document.getElementById('statusMessage'),
}

//current configation status
let currentConfig = null;

// Initialize the option page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadConfiguration();
        setupEventListeners();
        updateUI();
        showStatus('Settings loaded successfully', 'success');
    } catch (error) {
        console.error('Options initialization error:', error);
        showStatus('Error loading settings', 'error');
    }
});

/**
 * Load configurations from storage
 */
async function loadConfiguration() {
    try {
        const result = await chrome.storage.sync.get(['config']);
        if (result.config) {
            currentConfig = result.config;
        } else {
            currentConfig = getDefaultConfig();
            await saveConfiguration();
        }
    } catch (error) {
        console.error('Configurtion load error:', error);
        currentConfig = getDefaultConfig();
    }
}

function getDefaultConfig() {
    return {
        blockedSites: [
            'facebook.com',
            'tiktok.com',
            'youtube.com'
        ],
        schedule: {
            enable: true,
            startTime: '08:30',
            endTime: '16:40',
            workDays: [1, 2, 3, 4, 5]
        },
        despairMessage: [
            "Hello from 3 hours from now. I didn't finish the project. I'm tired. I have to ask for an extension. All because you needed to watch one... more... cat video. Close this tab and go back to work.",
            "It's me from the future. I'm sitting here at 11 PM, stressed and overwhelmed. The deadline is tomorrow and I'm nowhere near done. This could have been avoided if you just stayed focused.",
            "Future you here. I'm disappointed. We had such good intentions this morning, but here we are again,scrolling mindlessly while our dreams slip away. Please, just close this tab.",
            "Your future self is crying. Not literally, but emotionally. The presentation is in 2 hours and I'm frantically trying to put something together. Don't let this be our reality."
        ],
        enableTTS: true
    }
}

async function saveConfiguration() {
    try {
        await chrome.storage.sync.set({ config: currentConfig });
        chrome.runtime.sendMessage({ action: 'updateShedule' });
        return true;

    } catch (error) {
        console.error('Configuration save error:', error);
        return false;
    }
}

function setupEventListeners() {
    //sites management
    elements.addSiteBtn.addEventListener('click', addSite);
    elements.newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSite();
        }
    });

    //shedule management
    elements.scheduleEnabled.addEventListener('change', toggleSchedule);
    elements.startTime.addEventListener('change', updateScheduleTime);
    elements.endTime.addEventListener('change', updateScheduleTime);
    elements.workdayCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateWorkDays);
    });

    //messages management
    elements.addMessageBtn.addEventListener('click', addMessage);
    elements.workdayCheckboxes.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            addMessage();
        }
    });

    //additional settings
    elements.enableTTS.addEventListener('change', updateTTSSettings);

    //action buttons
    elements.saveBtn.addEventListener('click', saveSettings);
    elements.resetBtn.addEventListener('click', resetSettings);
    elements.testBtn.addEventListener('click', testBlockMessage);
}

function updateUI() {
    //update blocked sites
    updateSitesList();

    //update schedule settings
    elements.scheduleEnabled.checked = currentConfig.schedule.enable;
    elements.startTime.value = currentConfig.schedule.startTime;
    elements.endTime.value = currentConfig.schedule.endTime;

    //update work days
    elements.workdayCheckboxes.forEach(checkbox => {
        const day = parseInt(checkbox.value);
        checkbox.checked = currentConfig.schedule.workDays
            .includes(day);
    });

    toggleScheduleVisibility();
    updateMessagesList();

    elements.enableTTS.checked = currentConfig.enableTTS;
}

function updateSitesList() {
    elements.sitesList.innerHTML = '';
    if (currentConfig.blockedSites.length === 0) {
        elements.sitesList.innerHTML =
            '<div class="empty-state">No blocked sites yet.. Add some to get started!</div>';
        return;
    }

    currentConfig.blockedSites.forEach((site, index) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.innerHTML =
            `<span class="site-item">${escapeHtml(site)}</span>
        <button class="remove-site" data-index="${index}">Remove</button>
        `

        siteItem.querySelector('.remove-site')
            .addEventListener('click', () => {
                removeSite(index);
            });
    });

    elements.sitesList.appendChild(siteItem);
}

function updateMessagesList() {
    elements.messageList.innerHTML = '';

    if (currentConfig.despairMessage.length === 0) {
        elements.messageList.innerHTML =
            '<div class="empty-state">No despair messages yet..</div>';
        return;
    }

    currentConfig.despairMessage.forEach((message, index) => {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        messageItem.innerHTML = `
            <div class="message-text">${escapeHtml(message)}</div>
            <div class="message-action">
                <button class="remove-message" data-index="${index}">
                Remove</button>
            </div>
        `;
        messageItem.querySelector('.remove-message')
            .addEventListener('click', () => { removeMessage(index); });

        elements.messageList.appendChild(messageItem);
    });

}

function addSite() {
    const siteInput = elements.newSiteInput.value.trim();

    if (!siteInput) {
        showStatus('Please enter a website url', 'error');
        return;
    }

    //cleanup the input remove protocol, www, etc.
    const cleanSite = cleanSiteUrl(siteInput);

    //check if site already exists
    if (currentConfig.blockedSites.includes(cleanSite)) {
        showStatus('This site is already blocked', 'error');
        return;
    }

    currentConfig.blockedSites.push(cleanSite);

    updateUI();
    elements.newSiteInput.value('');

    showStatus(`Added ${cleanSite} to blocked sites`, 'success');
}

function removeSite(index) {
    const removedSite = currentConfig.blockedSites[index];
    currentConfig.blockedSites.splice(index, 1);
    updateSitesList();
    showStatus(`Removed ${removedSite} from blocked sites`, 'info');
}

function cleanSiteUrl(url) {
    return url
        .replace(/^https?:\/\//, '') //remove protocol
        .replace(/^www\./, '') //remove www
        .replace(/\/$/, '') // remove trailing slash
        .toLowerCase();
}

function toggleSchedule() {
    currentConfig.schedule.enabled = elements.scheduleEnabled.checked;
    toggleScheduleVisibility();
    showStatus(`Schedule ${currentConfig.schedule.enabled ?
        'enabled' : 'disabled'}`, 'info');
}

function toggleScheduleVisibility() {
    if (currentConfig.schedule.enabled) {
        elements.scheduleSettings.classList.remove('disabled');
    } else {
        elements.scheduleSettings.classList.add('disabled');
    }
}

function updateScheduleTime() {
    currentConfig.schedule.startTime = elements.startTime.value;
    currentConfig.schedule.endTime = elements.endTime.value;

    //validate time range
    if (elements.startTime.value >= elements.endTime.value) {
        showStatus('End time must be after start time', 'error');
        return;
    }

    showStatus('Schedule times updated', 'success');
}

function updateWorkDays() {
    const selectedDays = [];
    elements.workdayCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedDays.push(parseInt(checkbox.value));
        }
    });

    if (selectedDays.length === 0) {
        showStatus('Please select at least one work day', 'error');
        return;
    }

    currentConfig.schedule.workDays = selectedDays;
    showStatus('Work days updated', 'success');
}

function addMessage() {
    const messageInput = elements.newMessageInput.value.trim();

    if (!messageInput) {
        showStatus('Please enter a message', 'error');
        return;
    }

    if (messageInput.length < 10) {
        showStatus('Message should be at least 10 characters long');
        return;
    }

    currentConfig.despairMessage.push(messageInput);
    updateSitesList();
    elements.newMessageInput.value = '';
    showStatus('Despair message added successfully', 'success');
}

function removeMessage(index) {
    if (currentConfig.despairMessage.length <= 1) {
        showStatus('You must have at least one message', 'error');
        return;
    }

    currentConfig.despairMessage.splice(index, 1);
    updateMessagesList();
    showStatus('Despair message removed', 'info');
}

function updateTTSSettings() {
    currentConfig.enableTTS = elements.enableTTS.checked;
    showStatus(`Text-to-speech ${currentConfig.enableTTS ?
        'enabled' : 'disabled'}`, 'info');
}

async function saveSettings() {
    elements.saveBtn.classList.add('loading');

    try {
        const success = await saveConfiguration();
        if (success) {
            showStatus('Saving settings successfully', 'success');
        } else {
            showStatus('Error saving settings', 'error');
        }
    } catch (error) {
        console.error('save error:', error);
        showStatus('Error saving setting', 'error');
    } finally {
        elements.saveBtn.classList.remove('loading');
    }
}

async function resetSettings() {
    const confiemed = confirm('Are you sure want to reset settings?');

    if (!confiemed) return;

    elements.resetBtn.classList.add('loading');

    try {
        currentConfig = getDefaultConfig();
        await saveConfiguration();
        updateUI();
        showStatus('Settings reset to default', 'info');
    } catch (error) {
        console.error('Reset Error:', error);
        showStatus('Error resetting settings', 'error');
    } finally {
        elements.resetBtn.classList.remove('loading');
    }
}

function testBlockMessage() {
    const randomMessage = currentConfig.despairMessage[
        Math.floor(Math.random() * currentConfig.despairMessage.length)
    ];

    const textOverlay = document.createElement('div');
    textOverlay.innerHTML = `
        <div style="
            position: fixed;
            top:0;
            left:0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d1b2e 50%, #1a1a1a 100%);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ">
            <div style="
                text-align: center;
                max-width: 600px;
                padding: 40px;
                background: rgba(0,0,0,0.8);
                border-radius: 20px;
                border: 2px solid #ff6b6b;
                box-shadow: 0 20px 60px rgba(255,107,107,0.3);
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">💀</div>
                <h1 style="
                    color: #ff6b6b;
                    font-size: 2.5rem;
                    font-weight: bold;
                    margin: 0 0 30px 0;
                    text-shadow: 0 0 20px rgba(255,107,107, 0.5);
                    letter-spacing: 2px;
                ">TEST: BLOCKED BY DESPAIR</h1>
                <div style="
                    color: #ffffff;
                    font-size: 1.2rem;
                    line-height: 1.6;
                    margin-buttom: 20px;
                    padding: 20px;
                    background: rgba(255,107,107,0.1);
                    border-radius: 10px;
                    border-left: 4px solid #ff6b6b;
                ">
                    ${escapeHtml(randomMessage)}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
                    color: white;
                    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
                ">Close Test</button>
            </div>
        </div>
    `;
}

function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.add('show');

    setTimeout(() => {
        elements.statusMessage.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}