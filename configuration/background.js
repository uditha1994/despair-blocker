// Background service for extension
// handle alarm management, tab monitoring and content script injection

//default configurations for new instalation
const DEFAULT_CONFIG = {
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

chrome.runtime.onStartup.addListener(async () => {
    await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async () => {
    await initializeExtension();
})

//initialize settings with default settings
async function initializeExtension() {
    try {
        const result = await chrome.storage.sync.get(['config']);
        if (!result.config) {
            //firstime instalation set default configurations
            await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
            console.log('Default configuration set!');
        }

        //setup blocking shedule
        await setupBlockingSchedule();

    } catch (error) {
        console.error('Despair blocker: initialize erro:', error);
    }
}

async function setupBlockingSchedule() {
    try {
        const { config } = await chrome.storage.sync.get(['config']);

        if (!config || !config.schedule.enabled) {
            return;
        }

        //clear existing
        await chrome.alarms.clearAll();

        //create alarms for start and end time
        const now = new Date();
        const startTime = parseTime(config.schedule.startTime);
        const endTime = parseTime(config.schedule.endTime);

        //set daily recurring alarm
        chrome.alarms.create('blockingStart', {
            when: getNextAlarmTime(startTime),
            periodInMinutes: 24 * 60 //daily
        });

        chrome.alarms.create('blockingEnd', {
            when: getNextAlarmTime(endTime),
            periodInMinutes: 24 * 60 //daily
        });

        console.log('Blocking schedule setup');

    } catch (error) {
        console.error('Schedule setup error:', error);
    }
}

// Parse time string (HH:MM) to hours and minutes
function parseTime(timeString) {
    const [hours, minutes] = timeString.splite(':').map(Number);
    return { hours, minutes };
}

// get nex alarm time for given time
function getNextAlarmTime(time) {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(time.hours, time.minutes, 0, 0);

    //if time has passed today, set for tomorrow
    if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate + 1);
    }
    return alarmTime.getTime();
}

//handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('alarm triggered:', alarm.name);
});

//monitor tab updates and inject blocking script when needed
chrome.tabs.onUpdate.addListener(async (tabId, changeInfo, tab) => {
    //only process when page is loading or complete
    if (changeInfo.status !== 'loading' && changeInfo.status !== 'complete') {
        return;
    }

    //skip non-http(s) URLs
    if (!tab.url || (!tab.url.startsWith('http://')
        && !tab.url.startsWith('https://'))) {
        return;
    }

    try {
        const shouldBlock = await shoudBlockCurrentSite(tab.url);

        if (shouldBlock) {
            //inject blocking content script
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: blockPage,
                args: [await getRandomDespairMessage(), await getTTSEnable()]
            });
        }

    } catch (error) {
        console.error('Tab update error', error);
    }
});