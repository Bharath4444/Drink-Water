// Default settings
const DEFAULT_SETTINGS = {
  interval: 30, // Default 30 minutes
  enableSound: true,
  darkMode: true,
  drinkCount: 0,
  lastDrinkDate: new Date().toDateString(),
  lastDrinkTime: new Date().getTime(), // Track the last time user drank water
  drinkHistory: [], // Array to store drink history
  notificationCount: 0, // Track how many notifications have been shown without response
  maxNotifications: 5  // Maximum number of notifications before pausing
};

// Array of reminder messages
const REMINDER_MESSAGES = [
  "Time to drink water! Stay hydrated 💧",
  "Hydration check! Grab some water 💧",
  "Water break! Your body needs it 💧",
  "Don't forget to drink water! 💧",
  "Staying hydrated helps you focus better! 💧"
];

// Use a global scope variable instead of window
let soundPlayedSuccessfully = false;

// Create a global variable for notification timeout
let notificationReminderTimeout = null;
let checkReminderInterval = null;

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(['waterSettings'], (result) => {
    if (!result.waterSettings) {
      // Initialize with default settings including lastDrinkTime
      chrome.storage.sync.set({ 
        waterSettings: {
          ...DEFAULT_SETTINGS,
          lastDrinkTime: new Date().getTime()
        } 
      });
    } else {
      // Check if it's a new day, reset drink count if necessary
      const today = new Date().toDateString();
      if (result.waterSettings.lastDrinkDate !== today) {
        result.waterSettings.drinkCount = 0;
        result.waterSettings.lastDrinkDate = today;
        chrome.storage.sync.set({ waterSettings: result.waterSettings });
      }
      
      // Make sure lastDrinkTime exists
      if (!result.waterSettings.lastDrinkTime) {
        result.waterSettings.lastDrinkTime = new Date().getTime();
        chrome.storage.sync.set({ waterSettings: result.waterSettings });
      }
      
      // Initialize notification count if it doesn't exist
      if (result.waterSettings.notificationCount === undefined) {
        result.waterSettings.notificationCount = 0;
        result.waterSettings.maxNotifications = 5;
        chrome.storage.sync.set({ waterSettings: result.waterSettings });
      }
    }
  });
  
  // Start the reminder check interval immediately
  startReminderCheck();
  
  // Create a midnight reset alarm
  createMidnightResetAlarm();
});

// Start checking for reminders based on time since last drink
function startReminderCheck() {
  // Clear any existing interval
  if (checkReminderInterval) {
    clearInterval(checkReminderInterval);
  }
  
  // Check frequently (every 10 seconds) to ensure we don't miss short intervals
  checkReminderInterval = setInterval(() => {
    checkTimeSinceLastDrink();
  }, 10000); // Check every 10 seconds instead of every minute
  
  // Also check immediately
  checkTimeSinceLastDrink();
  
  console.log('Started reminder check interval - checking every 10 seconds');
}

// Check if enough time has passed since last drink to trigger a reminder
function checkTimeSinceLastDrink() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || DEFAULT_SETTINGS;
    const now = new Date().getTime();
    const lastDrinkTime = settings.lastDrinkTime;
    const intervalMs = settings.interval * 60 * 1000; // Convert minutes to milliseconds
    
    // Calculate time since last drink
    const timeSinceLastDrink = now - lastDrinkTime;
    
    console.log(`Time since last drink: ${Math.floor(timeSinceLastDrink / 60000)} minutes, Interval: ${settings.interval} minutes`);
    
    // Check if we've already shown the maximum number of notifications
    if (settings.notificationCount >= settings.maxNotifications) {
      console.log(`Maximum notifications (${settings.maxNotifications}) reached without response.`);
      
      // If it's been another full interval since the last max notifications
      // Reset the count to allow notifications again
      if (timeSinceLastDrink >= intervalMs * 2) {
        console.log('Full interval passed after max notifications, resetting count');
        settings.notificationCount = 0;
        chrome.storage.sync.set({ waterSettings: settings });
      } else {
        // Still waiting for the full interval after max notifications
        return;
      }
    }
    
    // If time since last drink exceeds the interval, show a notification
    if (timeSinceLastDrink >= intervalMs) {
      console.log('Time to show a reminder notification - interval exceeded');
      
      // For debugging, log exact times
      console.log(`Last drink: ${new Date(lastDrinkTime).toLocaleTimeString()}`);
      console.log(`Now: ${new Date(now).toLocaleTimeString()}`);
      console.log(`Interval: ${intervalMs / 60000} minutes (${intervalMs}ms)`);
      console.log(`Time since last drink: ${timeSinceLastDrink / 60000} minutes (${timeSinceLastDrink}ms)`);
      
      // Show notification
      showNotification();
      
      // Increment the notification count
      settings.notificationCount++;
      chrome.storage.sync.set({ waterSettings: settings });
    }
  });
}

// Create a midnight reset alarm
function createMidnightResetAlarm() {
  // Calculate time until next midnight
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0); // Set to next midnight
  
  // Calculate minutes until midnight
  let minutesUntilMidnight = Math.floor((midnight - now) / 1000 / 60);
  
  // Create the midnight alarm
  chrome.alarms.create('midnightReset', {
    delayInMinutes: minutesUntilMidnight,
    periodInMinutes: 24 * 60 // Repeat every 24 hours
  });
  
  console.log(`Midnight reset alarm set for ${minutesUntilMidnight} minutes from now`);
}

// Handle alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'midnightReset') {
    resetDrinkCountAtMidnight();
  }
});

// Reset drink count at midnight
function resetDrinkCountAtMidnight() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    if (result.waterSettings) {
      // Update the date and reset count
      const today = new Date().toDateString();
      result.waterSettings.drinkCount = 0;
      result.waterSettings.lastDrinkDate = today;
      
      // Save the updated settings
      chrome.storage.sync.set({ waterSettings: result.waterSettings });
      console.log('Drink counter reset at midnight');
    }
  });
}

// Create/update a notification with proper settings to ensure it appears as a popup
function showNotification() {
  try {
    console.log('showNotification function called');
    
    // Don't play sound when showing notification (sound only on "I drank water" button)
    
    // Clear any existing notification
    chrome.notifications.clear('waterReminderNotification', (wasCleared) => {
      console.log('Previous notification cleared:', wasCleared);
      
      // Clear any existing notification timeout
      if (notificationReminderTimeout) {
        clearTimeout(notificationReminderTimeout);
        console.log('Previous notification timeout cleared');
      }
      
      // Select a random message
      const randomIndex = Math.floor(Math.random() * REMINDER_MESSAGES.length);
      const message = REMINDER_MESSAGES[randomIndex];
      
      // Create notification options optimized for pop-up visibility
      const notificationOptions = {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Drink Water Reminder',
        message: message,
        requireInteraction: true,  // Ensures notification stays until user interacts
        priority: 2,               // High priority
        silent: true,              // Don't play system sound (we handle sound separately)
        isClickable: true          // Make the entire notification clickable
      };
      
      // Try to add buttons (they might not be supported on all platforms)
      try {
        notificationOptions.buttons = [
          { title: '✅ I drank water' },
          { title: '⏰ Remind me in 5 minutes' }
        ];
      } catch (e) {
        console.warn('Notification buttons not supported:', e);
      }
      
      console.log('Creating notification with options:', JSON.stringify(notificationOptions));
      
      // Create the notification
      chrome.notifications.create('waterReminderNotification', notificationOptions, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification creation error:', chrome.runtime.lastError);
          
          // Try simpler notification as fallback
          setTimeout(() => {
            console.log('Trying simplified notification');
            
            const simpleOptions = {
              type: 'basic',
              iconUrl: 'images/icon128.png',
              title: 'Drink Water Reminder',
              message: 'Time to drink water!',
              requireInteraction: true,
              priority: 2
            };
            
            chrome.notifications.create('waterReminderNotification', simpleOptions, (simpleId) => {
              if (chrome.runtime.lastError) {
                console.error('Simplified notification error:', chrome.runtime.lastError);
              } else {
                console.log('Simplified notification created:', simpleId);
              }
            });
          }, 500);
          
          return;
        }
        
        console.log('Notification created successfully:', notificationId);
        
        // Set reminder timeout to check if notification was interacted with
        // This helps ensure the notification is seen and not stacked
        notificationReminderTimeout = setTimeout(() => {
          chrome.notifications.getAll((notifications) => {
            // If the notification still exists and hasn't been interacted with
            if (notifications['waterReminderNotification']) {
              console.log('Notification reminder timeout triggered - renewing notification');
              
              // For more noticeable repeat notifications, use TTS for audio alert
              chrome.tts.speak('Please drink water', {
                'rate': 0.9,
                'volume': 1.0
              });
              
              // Clear and recreate to bring it to front again
              chrome.notifications.clear('waterReminderNotification', () => {
                // Small delay before recreating
                setTimeout(() => showNotification(), 500);
              });
            }
          });
        }, 15000); // Check after 15 seconds (more frequent for testing short intervals)
      });
    });
  } catch (error) {
    console.error('Error in showNotification:', error);
    
    // Emergency fallback notification system
    setTimeout(() => {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'Drink Water Reminder',
          message: 'Time to drink water!',
          requireInteraction: true,
          priority: 2
        });
      } catch (e) {
        console.error('Emergency notification failed:', e);
      }
    }, 1000);
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'waterReminderNotification') {
    if (buttonIndex === 0) {
      // "I drank water" button
      console.log('User clicked "I drank water" from notification');
      
      // Get current timestamp once
      const now = new Date().getTime();
      
      // First update storage directly to ensure consistent changes
      chrome.storage.sync.get(['waterSettings'], (result) => {
        const settings = result.waterSettings || DEFAULT_SETTINGS;
        
        // Update drink count directly in this transaction
        settings.drinkCount++;
        settings.lastDrinkTime = now;
        settings.notificationCount = 0;
        settings.lastDrinkDate = new Date().toDateString();
        
        // Calculate time since last drink (for history)
        let timeSinceLastDrink = null;
        if (settings.lastDrinkTime && settings.lastDrinkTime < now) {
          timeSinceLastDrink = Math.floor((now - settings.lastDrinkTime) / (1000 * 60)); // in minutes
        }
        
        // Initialize history array if needed
        if (!settings.drinkHistory) {
          settings.drinkHistory = [];
        }
        
        // Add to drink history
        const timestamp = new Date().toISOString();
        const formattedTime = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        
        settings.drinkHistory.unshift({
          timestamp: timestamp,
          formattedTime: formattedTime,
          timeSinceLastDrink: timeSinceLastDrink
        });
        
        // Keep only the last 50 entries
        if (settings.drinkHistory.length > 50) {
          settings.drinkHistory = settings.drinkHistory.slice(0, 50);
        }
        
        // Update average interval
        settings.averageDrinkInterval = calculateAverageInterval(settings.drinkHistory);
        
        // Update all values in one storage transaction
        chrome.storage.sync.set({ waterSettings: settings }, () => {
          console.log('Directly updated storage from notification button click');
          console.log('Drink count increased to:', settings.drinkCount);
          console.log('Timer reset to:', new Date(now).toLocaleTimeString());
          
          // Broadcast changes to any open popups
          chrome.runtime.sendMessage({ 
            action: 'timerReset',
            timestamp: now,
            fullUpdate: true
          });
          
          // Play sound after successful update
          playDrinkWaterSound();
        });
      });
      
      // Clear notification
      chrome.notifications.clear('waterReminderNotification');
      if (notificationReminderTimeout) {
        clearTimeout(notificationReminderTimeout);
      }
    } else if (buttonIndex === 1) {
      // "Remind me in 5 minutes" button
      console.log('User clicked "Remind me in 5 minutes"');
      // Don't reset notification count - user just postponed
      
      // Set a temporary 5-minute reminder
      setTimeout(() => {
        showNotification();
      }, 5 * 60 * 1000);
      
      // Clear current notification
      chrome.notifications.clear('waterReminderNotification');
      if (notificationReminderTimeout) {
        clearTimeout(notificationReminderTimeout);
      }
    }
  }
});

// Handle notification clicks (user clicks on the notification body)
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'waterReminderNotification') {
    console.log('User clicked on notification');
    // Open the popup when the notification is clicked
    chrome.action.openPopup();
    
    // Don't clear notification yet - let user decide action in popup
  }
});

// Reset the last drink time to now
function resetLastDrinkTime() {
  const now = new Date().getTime();
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || DEFAULT_SETTINGS;
    // Update the timestamp to current time
    settings.lastDrinkTime = now;
    settings.notificationCount = 0; // Reset notification count when user drinks water
    
    // Save the updated settings
    chrome.storage.sync.set({ waterSettings: settings }, () => {
      console.log('Last drink time reset to now:', new Date(now).toLocaleTimeString());
      
      // Force update any open popup UI immediately
      chrome.runtime.sendMessage({ 
        action: 'timerReset', 
        timestamp: now 
      });
    });
  });
}

// Play sound when user drinks water
function playDrinkWaterSound() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || DEFAULT_SETTINGS;
    
    if (settings.enableSound) {
      console.log('Playing drink water sound');
      
      // Try to play sound via popup
      chrome.runtime.sendMessage({ action: 'playDrinkSound' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          console.log('Popup not available, playing sound in background');
          // Try to play directly (limited in service worker)
          try {
            // Use TTS as fallback in service worker
            chrome.tts.speak('Water logged', {
              'rate': 0.9,
              'volume': 1.0
            });
          } catch (e) {
            console.error('Error playing sound:', e);
          }
        }
      });
    }
  });
}

// Update drinking log function
function updateDrinkingLog() {
  const now = new Date();
  const timestamp = now.toISOString();
  const formattedTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || DEFAULT_SETTINGS;
    
    // Initialize history array if it doesn't exist
    if (!settings.drinkHistory) {
      settings.drinkHistory = [];
    }
    
    // Calculate time since last drink (for average tracking)
    let timeSinceLastDrink = null;
    if (settings.lastDrinkTime && settings.lastDrinkTime < now.getTime()) {
      timeSinceLastDrink = Math.floor((now.getTime() - settings.lastDrinkTime) / (1000 * 60)); // in minutes
    }
    
    // Add new drink record (limit to last 50 entries to avoid storage limits)
    settings.drinkHistory.unshift({
      timestamp: timestamp,
      formattedTime: formattedTime,
      timeSinceLastDrink: timeSinceLastDrink // Store time since last drink
    });
    
    // Keep only the last 50 entries
    if (settings.drinkHistory.length > 50) {
      settings.drinkHistory = settings.drinkHistory.slice(0, 50);
    }
    
    // Update count and date
    settings.drinkCount++;
    settings.lastDrinkDate = now.toDateString();
    // We no longer update lastDrinkTime here since it's already updated in resetLastDrinkTime()
    
    // Calculate average time between drinks
    settings.averageDrinkInterval = calculateAverageInterval(settings.drinkHistory);
    
    // Save updated settings
    chrome.storage.sync.set({ waterSettings: settings }, () => {
      console.log('Drinking log updated');
      // Update any open popup
      chrome.runtime.sendMessage({ action: 'updateUI' });
    });
  });
}

// Calculate average time between drinks
function calculateAverageInterval(history) {
  if (!history || history.length < 2) {
    return null; // Need at least 2 entries to calculate average
  }
  
  // Calculate average of all non-null intervals
  let totalInterval = 0;
  let count = 0;
  
  for (let i = 0; i < history.length; i++) {
    if (history[i].timeSinceLastDrink) {
      totalInterval += history[i].timeSinceLastDrink;
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalInterval / count) : null;
}

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'resetCounter') {
    chrome.storage.sync.get(['waterSettings'], (result) => {
      const settings = result.waterSettings || DEFAULT_SETTINGS;
      settings.drinkCount = 0;
      chrome.storage.sync.set({ waterSettings: settings });
      sendResponse({ success: true });
    });
    return true; // Keep the messaging channel open for the async response
  } else if (request.action === 'drinkWater') {
    // Reset timer first for immediate effect
    const now = new Date().getTime();
    resetLastDrinkTime();
    // Then update log
    updateDrinkingLog();
    playDrinkWaterSound(); // Play sound when user drinks water
    sendResponse({ success: true, timestamp: now });
    return true;
  } else if (request.action === 'getCurrentStats') {
    chrome.storage.sync.get(['waterSettings'], (result) => {
      const settings = result.waterSettings || DEFAULT_SETTINGS;
      const now = new Date().getTime();
      const timeSinceLastDrink = now - settings.lastDrinkTime;
      const timeSinceLastDrinkMinutes = Math.floor(timeSinceLastDrink / 60000);
      
      sendResponse({ 
        success: true, 
        stats: {
          drinkCount: settings.drinkCount,
          timeSinceLastDrink: timeSinceLastDrinkMinutes,
          interval: settings.interval,
          enableSound: settings.enableSound,
          notificationCount: settings.notificationCount,
          maxNotifications: settings.maxNotifications
        }
      });
    });
    return true;
  } else if (request.action === 'playDrinkSound') {
    // Only for user-initiated drink logging
    playDrinkWaterSound();
    sendResponse({ success: true });
    return true;
  }
  
  return true; // Keep the message channel open for async response
});

// Make sure the timer is correctly set up when the extension is initialized
chrome.runtime.onStartup.addListener(function() {
  console.log('Extension started');
  startReminderCheck();
}); 