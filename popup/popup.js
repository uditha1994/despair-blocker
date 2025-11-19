//DOM elements
const elements = {
    blockingStatus: document.getElementById('blockingStatus'),
    blockingCount: document.getElementById('blockedCount'),
    scheduleStatus: document.getElementById('scheduleStatus'),
    toggleBlocking: document.getElementById('toggleBlocking'),
    toggleText: document.getElementById('toggleText'),
    openOptions: document.getElementById('openOptions'),
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
        const result = await chrome.storage.sync.get(['config', 'temperaryDisabled']);
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
    elements.blockingCount.textContent = currentConfig.blockedSites?.length || 0;

    //schedule status
    if (currentConfig.schedule?.enable) {
        const now = new Date();
        const currentDay = now.getDay();
        const isWorkDay = currentConfig.schedule.workDays?.includes(currentDay);

        if (isWorkDay) {
            elements.scheduleStatus.textContent = `${currentConfig.schedule.startTime} - ${currentConfig.schedule.endTime}`;
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
    elements.openOptions.addEventListener('click', openOption);

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

/**
 * Toggle blocking on/off
 */
async function toggleBlocking() {
    try {
        elements.toggleBlocking.classList.add('loading');
        isBlocking = !isBlocking;

        //store temporary disable state
        await chrome.storage.sync.set({ temporaryDisabled: !isBlocking });

        updateStateDisplay();
        showFeedback(isBlocking ? 'Blocking Enable' : 'Blocking Disable');

    } catch (error) {
        console.error('Blocking toggle error:', error);
        showFeedback('Error toggling blocking', 'error');
    } finally {
        elements.toggleBlocking.classList.remove('loading');
    }
}

/**
 * Open full options page
 */
function openOption() {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    window.close();
}

/**
 * Test block functionality
 */
async function testBlock() {
    try {
        //get current tabs
        const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs) {
            //inject test block
            await chrome.scripting.executeScript({
                target: { tabId: tabs.id },
                func: showTestBlock
            });
            window.close();
        }
    } catch (error) {
        console.error('Test block error:', error);
        showFeedback('Error testing block:', error);
    }
}

/**
 * Quick add site funtionality
 */
async function quickAddSite() {
    const siteInput = elements.quickSiteInput.value.trim();

    if (!siteInput) {
        showFeedback('Please Enter a website', true);
        return;
    }

    try {
        elements.quickAddBtn.classList.add('loading');

        //clean up the site
        const cleanSite = cleanSiteUrl(siteInput);

        //check if site already exists
        if (currentConfig.blockedSites.includes(cleanSite)) {
            showFeedback('Site already blocked', true);
            return;
        }

        //add to configuration
        currentConfig.blockedSites.push(cleanSite);

        //save configs
        await chrome.storage.sync.set({ config: currentConfig });

        //update ui
        elements.blockingCount.textContent = currentConfig.blockedSites.length;
        elements.quickSiteInput.value = '';

        showFeedback(`Added ${cleanSite}`);

    } catch (error) {
        console.error('Quick add error:', error);
        showFeedback('Error adding site', true);
    } finally {
        elements.quickAddBtn.classList.remove('loading');
    }
}

function cleanSiteUrl(url) {
    return url
        .replace(/^https?:\/\//, '') //remove protocol
        .replace(/^www\./, '') //remove www\
        .replace(/\/$/, '') //remove trailing slash
        .toLowerCase();
}

function showFeedback(message, isError = false) {
    //create feedback element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        border-radius: 5px;
        color: white:
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 10000;
        trasform: translateX(100%);
        transition: transform 0.3 ease;
        ${isError ? 'background: linear-gradient(45deg, #dc3545, #e74c3c)'
            : 'background: linear-gradient(45deg, #28a745, #34ce57)'
        } 
    `

    document.body.appendChild(feedback);

    //animate feedback
    setTimeout(() => {
        feedback.style.transform = 'translateX(0)';
    }, 10);

    //remove after delay
    setTimeout(() => {
        feedback.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 2000);
}

/**
 * function to inject for test block
 */
function showTestBlock() {
    //remove existing test overlay
    const existing = document.getElementById('despaire-test-overlay');
    if (existing) {
        existing.remove();
    }

    const testMessage = `This is a test of the Despaire Blocker. 
    Your future self wanted you to see how this work, Now get back to work!!`;

    const overlay = document.createElement('div');
    overlay.id = 'despaire-test-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d1b2e 50%, #1a1a1a 100%);
            z-index: 99999;
            display:flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="
                text-align: center;
                max-width: 600px;
                padding: 40px
                background: rgba(0,0,0,0.8);
                border-radius: 20px;
                border: 2px solid #ff6b6b;
                box-shadow: 0 20px 60px rgba(255,107,107,0.3);
                animation: testFadeIn 0.4c ease-out;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px">💀</div>
                <h1 style="
                    color: #ff6b6b;
                    font-size: 2.5rem;
                    letter-spacing: 2px;
                    font-weight: bold;
                    text-shadow: 0 0 20px rgba(255,107, 107, 0.5);
                    margin: 0 0 30px 0;
                ">TEST: Blocked by Despair</h1>
                <div style="
                    color: #ffff;
                    font-size: 1.2rem;
                    line-height: 1.6;
                    margin-bottom: 40px;
                    padding: 20px;
                    background: rgba(255,107,107,0.1);
                    border-radius: 10px;
                    border-left: 4px solid #ff6b6b;
                ">${testMessage}</div>
                <button style="
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    font-size: 1rem;
                    cursor: pointer;
                    color: white;
                    font-weight: bold;
                    background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
                    box-shadow: 0 5px 15px rgba(255,107,107,0.4);
                    trasition: all 0.3s ease;
                "
                onmouseover="this.style.trasform='translateY(-2px)'"
                onmouseout="this.style.transform='translateY(0)'"
                onClick="this.parentElement.parentElement.remove()"
                >Close Test</button>
            </div>
        </div>
        <style>
            @keyframes testFadeIn {
                from {opacity: 0; transform: scale(0.8);}
                to {opacity: 1; transform: scale(1);}
            }
        </style>
    `;
    document.body.appendChild(overlay);
}