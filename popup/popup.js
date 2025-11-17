//DOM elements
const elements = {
    blockingStatus: document.getElementById('blockingStatus'),
    blockingCount: document.getElementById('blockedCount'),
    scheduleStatus: document.getElementById('scheduleStatus'),
    toggleBlocking: document.getElementById('toggleBlocking'),
    toggleText: document.getElementById('toggleText'),
    openOption: document.getElementById('openOption'),
    testBlock: document.getElementById('testBlock'),
    quickSiteInput: document.getElementById('quickSiteInput'),
    quickAddBtn: document.getElementById('quickAddBtn')
};

//current configuration
let currentConfig = null;
let isBlocking = true;

/**
 * initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadStatus();
        setupEventListeners();
    } catch (error) {
        console.error("Popup initialization error:", error);
    }
});

/**
 * Load current status and configurations
 */
async function loadStatus() {
    try {
        const result = await chrome.storage.sync.get
            (['config', 'temperaryDisabled']);
        currentConfig = result.config;
        isBlocking = !result.temperaryDisabled;

        updateStateDisplay();
    } catch (error) {
        console.error('Status load error:', error);
        elements.blockingStatus.textContent = 'Error';
        elements.blockingStatus.className = 'status-value error';
    }
}

function updateStateDisplay() {
    if (!currentConfig) {
        elements.blockingStatus.textContent = "Not Configured";
        elements.blockingStatus.className = 'status-value inactive';
        elements.blockingCount.textContent = '0';
        elements.scheduleStatus.textContent = 'Disable Blocking';
        return;
    }

    //Blocking status
    if (isBlocking) {
        elements.blockingStatus.textContent = 'Active';
        elements.blockingStatus.className = 'status-value active';
        elements.toggleText.textContent = 'Disable Blocking';
    } else {
        elements.blockingStatus.textContent = 'Disable';
        elements.blockingStatus.className = 'status-value inactive';
        elements.toggleText.textContent = 'Enable Blocking';
    }

    //blocking sites count
    elements.blockingCount.textContent =
        currentConfig.blockedSites?.length || 0;

    //schedule status
    if (currentConfig.schedule?.enable) {
        const now = new Date();
        const currentDay = now.getDay();
        const isWorkDay = currentConfig.schedule.
            workDays?.include(currentDay);

        if (isWorkDay) {
            elements.scheduleStatus.textContent =
                `${currentConfig.schedule.startTime} - ${currentConfig.schedule.endTime}`;
            elements.scheduleStatus.className = 'status-value active';
        } else {
            elements.scheduleStatus.textContent = 'Off Day';
            elements.scheduleStatus.className = 'status-value inactive';
        }
    } else {
        elements.scheduleStatus.textContent = 'Disable';
        elements.scheduleStatus.className = 'status-value inactive';
    }
}

function setupEventListeners() {
    //toggle blocking
    elements.toggleBlocking.addEventListener('click', toggleBlocking);

    //open full options
    elements.openOption.addEventListener('click', openOption);

    //Test block
    elements.testBlock.addEventListener('click', testBlock);

    //Quick site add
    elements.quickAddBtn.addEventListener('click', quickAddSite);
    elements.quickSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            quickAddSite();
        }
    })

}

function toggleBlocking() { }

function openOption() { }

function testBlock() { }

function quickAddSite() { }