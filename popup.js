// Add global timer variables to track time directly
let lastResetTime = null;
let timerInterval = null;

document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log('DOM fully loaded');
    initializeUI();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

// Initialize all UI elements with error handling
function initializeUI() {
  try {
    // Load and display current settings and stats
    loadSettings();
    
    // Get the last drink time from storage
    chrome.storage.sync.get(['waterSettings'], (result) => {
      if (result.waterSettings && result.waterSettings.lastDrinkTime) {
        // Initialize the global timer variable
        lastResetTime = result.waterSettings.lastDrinkTime;
      } else {
        // If no lastDrinkTime exists, set it to now
        lastResetTime = new Date().getTime();
      }
      
      // Initialize the timer display
      updateTimeSinceLastDrink();
      
      // Set interval to update time display
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      timerInterval = setInterval(updateTimeSinceLastDrink, 1000);
    });
    
    // Find drinking button with fallback
    const drinkButton = document.getElementById('drankWaterButton') || 
                        document.getElementById('drinkNowBtn');
    
    if (drinkButton) {
      drinkButton.addEventListener('click', function() {
        recordDrinkAndResetTimer();
      });
    }
    
    // Settings button
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', function() {
        showView('settings-view');
        loadSettingsView();
      });
    }
    
    // Back from settings button
    const backToMainBtn = document.getElementById('backToMainBtn');
    if (backToMainBtn) {
      backToMainBtn.addEventListener('click', function() {
        showView('main-view');
      });
    }
    
    // History button
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    if (viewHistoryBtn) {
      viewHistoryBtn.addEventListener('click', function() {
        showView('history-view');
        loadHistoryView();
      });
    }
    
    // Back from history button
    const backFromHistoryBtn = document.getElementById('backFromHistoryBtn');
    if (backFromHistoryBtn) {
      backFromHistoryBtn.addEventListener('click', function() {
        showView('main-view');
      });
    }
    
    // Reset settings button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        resetSettings();
      });
    }
    
    // Check if interval select exists (might be in settings view)
    const intervalSelect = document.getElementById('intervalSelect');
    if (intervalSelect) {
      intervalSelect.addEventListener('change', function() {
        if (intervalSelect.value === 'custom') {
          document.getElementById('customIntervalGroup').style.display = 'block';
        } else {
          document.getElementById('customIntervalGroup').style.display = 'none';
        }
      });
    }
    
    // Save settings button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveSettings();
      });
    }
    
    // Check if sound toggle exists
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
      soundToggle.addEventListener('change', function() {
        saveSettings();
      });
    }
    
    // Check if dark mode toggle exists
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', function() {
        applyTheme(darkModeToggle.checked);
      });
    }
    
    // Set up message listener for actions
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'playDrinkSound') {
        console.log('Received playDrinkSound message in popup');
        playDrinkWaterSound();
        sendResponse({ success: true });
        return true;
      } else if (message.action === 'updateUI') {
        // Refresh UI elements
        loadSettings();
        updateTimeSinceLastDrink();
        updateStatistics();
        sendResponse({ success: true });
        return true;
      } else if (message.action === 'timerReset') {
        console.log('Received timer reset message with timestamp:', new Date(message.timestamp).toLocaleTimeString());
        
        // If this is a full update from notification, ensure we update everything completely
        if (message.fullUpdate) {
          console.log('Full update requested - refreshing all UI elements');
          // First update the timer for immediate feedback
          updateTimeSinceLastDrinkWithTimestamp(message.timestamp);
          
          // Force a complete reload of all data from storage
          setTimeout(() => {
            loadSettings();
            updateStatistics();
            
            // Force visual refresh of timer again to ensure it's at 00:00:00
            const countdownTimer = document.getElementById('countdownTimer');
            if (countdownTimer) {
              countdownTimer.textContent = '00:00:00';
              countdownTimer.classList.add('reset-flash');
              setTimeout(() => countdownTimer.classList.remove('reset-flash'), 500);
            }
          }, 100);
        } else {
          // Regular timer reset
          updateTimeSinceLastDrinkWithTimestamp(message.timestamp);
          loadSettings();
          updateStatistics();
        }
        
        sendResponse({ success: true });
        return true;
      } else if (message.action === 'playSound') {
        // For notification sound playback
        playNotificationSound();
        sendResponse({ success: true });
        return true;
      }
    });
    
  } catch (error) {
    console.error('Error in UI initialization:', error);
  }
}

// Helper function to show the specified view and hide others
function showView(viewId) {
  // Hide all views
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('settings-view').style.display = 'none';
  document.getElementById('history-view').style.display = 'none';
  
  // Show the requested view
  document.getElementById(viewId).style.display = 'block';
}

// Load settings view with current values
function loadSettingsView() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || {
      interval: 30,
      enableSound: true,
      darkMode: false
    };
    
    // Set interval dropdown
    const intervalSelect = document.getElementById('intervalSelect');
    const customIntervalGroup = document.getElementById('customIntervalGroup');
    const customInterval = document.getElementById('customInterval');
    
    // Standard intervals
    const standardIntervals = [15, 30, 45, 60, 90, 120];
    
    if (standardIntervals.includes(settings.interval)) {
      intervalSelect.value = settings.interval.toString();
      customIntervalGroup.style.display = 'none';
    } else {
      intervalSelect.value = 'custom';
      customIntervalGroup.style.display = 'block';
      customInterval.value = settings.interval;
    }
    
    // Set sound toggle
    document.getElementById('soundToggle').checked = settings.enableSound;
    
    // Set dark mode toggle
    document.getElementById('darkModeToggle').checked = settings.darkMode;
    
    // Update total drinks
    if (document.getElementById('totalDrinks')) {
      document.getElementById('totalDrinks').textContent = settings.drinkCount || 0;
    }
    
    // Update average interval
    if (document.getElementById('averageInterval')) {
      document.getElementById('averageInterval').textContent = 
        settings.averageDrinkInterval || '--';
    }
  });
}

// Load history view
function loadHistoryView() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || {
      drinkCount: 0,
      drinkHistory: [],
      averageDrinkInterval: null
    };
    
    // Update drink count in history view
    if (document.getElementById('todayDrinkCount')) {
      document.getElementById('todayDrinkCount').textContent = settings.drinkCount || 0;
    }
    
    // Update average interval
    if (document.getElementById('averageInterval')) {
      document.getElementById('averageInterval').textContent = 
        settings.averageDrinkInterval || '--';
    }
    
    // Update history list
    const historyList = document.getElementById('historyList');
    if (historyList) {
      // Clear existing entries
      historyList.innerHTML = '';
      
      // Check if there's history data
      if (!settings.drinkHistory || settings.drinkHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No drinking records found.</div>';
        return;
      }
      
      // Add each history entry
      settings.drinkHistory.forEach(entry => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-entry';
        
        // Split formatted time into date and time parts
        const parts = entry.formattedTime.split(' ');
        const datePart = parts[0];
        const timePart = parts.slice(1).join(' ');
        
        // Determine interval class (short, normal, long)
        let intervalClass = 'interval-normal';
        let intervalText = 'on schedule';
        
        if (entry.timeSinceLastDrink) {
          if (entry.timeSinceLastDrink < (settings.interval * 0.8)) {
            intervalClass = 'interval-short';
            intervalText = 'early';
          } else if (entry.timeSinceLastDrink > (settings.interval * 1.2)) {
            intervalClass = 'interval-long';
            intervalText = 'late';
          }
        }
        
        // Create HTML for the history entry
        historyItem.innerHTML = `
          <div>
            <div class="history-time">${timePart}</div>
            <div class="history-date">${datePart}</div>
          </div>
          <div>
            ${entry.timeSinceLastDrink ? 
              `<div class="interval-indicator ${intervalClass}">
                ${entry.timeSinceLastDrink} min (${intervalText})
              </div>` : ''}
          </div>
        `;
        
        historyList.appendChild(historyItem);
      });
    }
  });
}

// Reset settings to defaults
function resetSettings() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || {};
    
    // Preserve drink history but reset other settings
    const newSettings = {
      ...settings,
      interval: 30,
      enableSound: true,
      darkMode: false
    };
    
    chrome.storage.sync.set({ waterSettings: newSettings }, () => {
      // Reload settings view
      loadSettingsView();
      
      // Show feedback
      const resetBtn = document.getElementById('resetBtn');
      if (resetBtn) {
        const originalText = resetBtn.textContent;
        resetBtn.textContent = '✓ Reset';
        resetBtn.disabled = true;
        
        setTimeout(() => {
          resetBtn.textContent = originalText;
          resetBtn.disabled = false;
        }, 1000);
      }
    });
  });
}

// Load and display settings in main view
function loadSettings() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || {
      interval: 30,
      enableSound: true,
      darkMode: false,
      drinkCount: 0,
      lastDrinkTime: new Date().getTime(),
      notificationCount: 0,
      maxNotifications: 5
    };
    
    // Update drink count display
    const drinkCountElement = document.getElementById('drinkCount');
    if (drinkCountElement) {
      drinkCountElement.textContent = settings.drinkCount;
    }
    
    // Update interval display
    const intervalDisplayElement = document.getElementById('intervalDisplay');
    if (intervalDisplayElement) {
      intervalDisplayElement.textContent = `${settings.interval} min`;
    }
    
    // Update sound display
    const soundDisplayElement = document.getElementById('soundDisplay');
    if (soundDisplayElement) {
      soundDisplayElement.textContent = settings.enableSound ? 'On' : 'Off';
    }
    
    // Update notification count display - shows progress toward max notifications
    const notificationCountElement = document.getElementById('notificationCount');
    if (notificationCountElement) {
      notificationCountElement.textContent = `${settings.notificationCount || 0}/${settings.maxNotifications || 5}`;
    }
    
    // Store last drink time for direct timer calculation
    lastResetTime = settings.lastDrinkTime;
    
    // Debug information - show exact times for troubleshooting
    console.log('Settings loaded:');
    console.log(`Last drink time: ${new Date(settings.lastDrinkTime).toLocaleTimeString()}`);
    console.log(`Interval: ${settings.interval} minutes`);
    console.log(`Notification count: ${settings.notificationCount || 0}/${settings.maxNotifications || 5}`);
    
    // Apply dark mode if enabled
    applyTheme(settings.darkMode);
  });
}

// Update the display of time since last drink
function updateTimeSinceLastDrink() {
  // If we have a local reset time, use that for immediate updates
  if (lastResetTime) {
    const now = new Date().getTime();
    const elapsedMs = now - lastResetTime;
    const elapsedMinutes = elapsedMs / 60000;
    
    // Get interval from DOM to avoid storage call
    const intervalText = document.getElementById('intervalDisplay');
    const interval = intervalText ? parseInt(intervalText.textContent) : 30;
    
    // Create stats object for display
    const stats = {
      timeSinceLastDrink: elapsedMinutes,
      interval: interval,
      notificationCount: 0,
      maxNotifications: 5
    };
    
    updateTimerDisplay(stats);
  } else {
    // Fall back to storage-based timing if no local time
    chrome.runtime.sendMessage({ action: 'getCurrentStats' }, (response) => {
      if (response && response.success) {
        const stats = response.stats;
        // Store the last drink time for future direct updates
        lastResetTime = new Date().getTime() - (stats.timeSinceLastDrink * 60000);
        updateTimerDisplay(stats);
      }
    });
  }
}

// Update timer with specific timestamp (for immediate updates)
function updateTimeSinceLastDrinkWithTimestamp(timestamp) {
  if (!timestamp) return;
  
  // Save the reset time globally
  lastResetTime = timestamp;
  
  // Create a visual "reset" effect first
  const countdownTimer = document.getElementById('countdownTimer');
  const countdownRing = document.getElementById('countdownRing');
  
  if (countdownTimer && countdownRing) {
    // Flash the timer briefly to indicate reset
    countdownTimer.classList.add('reset-flash');
    countdownRing.style.strokeDashoffset = '113'; // Reset to empty
    
    // Update to 00:00:00 immediately
    countdownTimer.textContent = '00:00:00';
    
    // Remove flash effect after a short delay
    setTimeout(() => {
      countdownTimer.classList.remove('reset-flash');
    }, 500);
  }
  
  // Ensure we have a timer interval running
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(updateTimeSinceLastDrink, 1000);
  
  // Get the current interval setting
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || { interval: 30 };
    
    // Force lastDrinkTime update in storage to ensure consistency
    settings.lastDrinkTime = timestamp;
    chrome.storage.sync.set({ waterSettings: settings }, () => {
      console.log('Timer reset in UI, timestamp updated in storage');
      
      // Create a stats object with zeros for immediate display
      const stats = {
        timeSinceLastDrink: 0, // Start from zero
        interval: settings.interval,
        notificationCount: 0,
        maxNotifications: settings.maxNotifications
      };
      
      // Update the display with zeros first
      updateTimerDisplay(stats);
    });
  });
}

// Separate function to update the timer display
function updateTimerDisplay(stats) {
  // Get countdown display elements
  const countdownTimer = document.getElementById('countdownTimer');
  const countdownRing = document.getElementById('countdownRing');
  
  if (!countdownTimer || !countdownRing) {
    console.warn('Countdown elements not found');
    return;
  }
  
  // Calculate time in hours, minutes and seconds
  const totalMinutes = stats.timeSinceLastDrink;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);
  
  // Format display
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');
  
  // Update the display in HH:MM:SS format
  countdownTimer.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  
  // Update progress ring (fill up over time, complete when interval is reached)
  const intervalMinutes = stats.interval;
  const totalSeconds = intervalMinutes * 60;
  const elapsedSeconds = (hours * 3600) + (minutes * 60) + seconds;
  
  // Calculate the progress value (0-113 for the circle circumference)
  let progress = (elapsedSeconds / totalSeconds) * 113;
  
  // Cap at 113 (completely filled) when exceeding the interval
  if (progress > 113) {
    progress = 113;
  }
  
  // Update progress ring - fill more as time passes
  countdownRing.style.strokeDashoffset = 113 - progress;
  
  // Change color when time exceeds interval
  if (totalMinutes >= intervalMinutes) {
    countdownTimer.classList.add('overdue');
    countdownRing.classList.add('overdue');
  } else {
    countdownTimer.classList.remove('overdue');
    countdownRing.classList.remove('overdue');
  }
  
  // Update notification count display if it exists
  const notificationCountElement = document.getElementById('notificationCount');
  if (notificationCountElement) {
    notificationCountElement.textContent = `${stats.notificationCount}/${stats.maxNotifications}`;
  }
}

// Record drink and reset timer
function recordDrinkAndResetTimer() {
  const now = new Date().getTime();
  
  // First update the UI immediately to show the reset timer
  updateTimeSinceLastDrinkWithTimestamp(now);
  
  // Then send message to background to record the drink
  chrome.runtime.sendMessage({ action: 'drinkWater' }, function(response) {
    if (response && response.success) {
      console.log('Drinking recorded and timer reset');
      // Play water drinking sound
      playDrinkWaterSound();
      // Refresh UI
      loadSettings();
      updateStatistics();
    }
  });
}

// Play sound only when user drinks water (not when timer expires)
function playDrinkWaterSound() {
  console.log('Playing water drinking sound');
  
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || { enableSound: true };
    
    if (settings.enableSound === false) {
      console.log('Sound disabled in settings, not playing');
      return;
    }
    
    try {
      // Try to play using the audio element first
      const audioElement = document.getElementById('notificationSound');
      if (!audioElement) {
        console.warn('Audio element not found');
        return;
      }
      
      console.log('Found audio element, playing drink water sound');
      
      // Reset any existing playback
      audioElement.pause();
      audioElement.currentTime = 0;
      
      // Make sure volume is up
      audioElement.volume = 1.0;
      
      // Play the sound
      audioElement.play()
        .then(() => {
          console.log('Sound played successfully');
        })
        .catch(error => {
          console.error('Error playing sound:', error);
        });
    } catch (error) {
      console.error('Error in sound playback:', error);
    }
  });
}

// Update statistics
function updateStatistics() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || { drinkCount: 0, drinkHistory: [] };
    
    // Update any statistics display elements
    if (document.getElementById('totalDrinks')) {
      document.getElementById('totalDrinks').textContent = settings.drinkCount;
    }
    
    if (document.getElementById('todayDrinkCount')) {
      document.getElementById('todayDrinkCount').textContent = settings.drinkCount;
    }
    
    // Calculate average interval
    if (settings.drinkHistory && settings.drinkHistory.length > 1) {
      const totalInterval = settings.drinkHistory.reduce((total, entry) => {
        if (entry.timeSinceLastDrink !== null) {
          return total + entry.timeSinceLastDrink;
        }
        return total;
      }, 0);
      const averageInterval = (totalInterval / (settings.drinkHistory.length - 1)).toFixed(2);
      
      if (document.getElementById('averageInterval')) {
        document.getElementById('averageInterval').textContent = averageInterval;
      }
    }
  });
}

// Save settings
function saveSettings() {
  // Get values from form
  const intervalSelect = document.getElementById('intervalSelect');
  const customInterval = document.getElementById('customInterval');
  const soundToggle = document.getElementById('soundToggle');
  const darkModeToggle = document.getElementById('darkModeToggle');
  
  // Determine interval value
  let intervalValue = parseInt(intervalSelect.value);
  if (intervalSelect.value === 'custom') {
    intervalValue = parseInt(customInterval.value);
    // Make sure the custom value is valid
    if (isNaN(intervalValue) || intervalValue < 1) {
      intervalValue = 30; // Default to 30 if invalid
    }
  }
  
  // Retrieve current settings to preserve other values
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const currentSettings = result.waterSettings || {};
    
    const settings = {
      ...currentSettings,
      interval: intervalValue,
      enableSound: soundToggle.checked,
      darkMode: darkModeToggle.checked
    };
    
    // Save to storage
    chrome.storage.sync.set({ waterSettings: settings }, () => {
      // Show saved feedback
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved';
        saveBtn.disabled = true;
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 1000);
      }
      
      // Update UI
      loadSettings();
      updateTimeSinceLastDrink();
    });
  });
}

// Apply theme based on settings
function applyTheme(isDarkMode) {
  if (isDarkMode === undefined) {
    // If no param passed, get from storage
    chrome.storage.sync.get(['waterSettings'], (result) => {
      const settings = result.waterSettings || { darkMode: false };
      applyThemeClass(settings.darkMode);
    });
  } else {
    // Use the param passed
    applyThemeClass(isDarkMode);
  }
}

function applyThemeClass(isDarkMode) {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Play notification sound
function playNotificationSound() {
  try {
    console.log('Playing notification sound');
    
    chrome.storage.sync.get(['waterSettings'], (result) => {
      const settings = result.waterSettings || { enableSound: true };
      
      if (settings.enableSound === false) {
        console.log('Sound disabled in settings, not playing');
        return;
      }
      
      // Try to play using the audio element
      const audioElement = document.getElementById('notificationSound');
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = 1.0;
        audioElement.play()
          .then(() => console.log('Notification sound played successfully'))
          .catch(error => console.error('Error playing notification sound:', error));
      } else {
        console.warn('Audio element not found for notification sound');
      }
    });
  } catch (error) {
    console.error('Error in notification sound playback:', error);
  }
} 