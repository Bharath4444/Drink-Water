document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const intervalSelect = document.getElementById('intervalSelect');
  const customIntervalGroup = document.getElementById('customIntervalGroup');
  const customInterval = document.getElementById('customInterval');
  const soundToggle = document.getElementById('soundToggle');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  // Load current settings
  loadSettings();
  
  // Event listeners
  intervalSelect.addEventListener('change', () => {
    if (intervalSelect.value === 'custom') {
      customIntervalGroup.style.display = 'block';
    } else {
      customIntervalGroup.style.display = 'none';
    }
  });
  
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
  
  // Apply dark mode immediately if needed
  applyTheme();
  
  // Add dark mode toggle listener
  darkModeToggle.addEventListener('change', () => {
    applyTheme(darkModeToggle.checked);
  });
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const settings = result.waterSettings || {
      interval: 30,
      enableSound: true,
      darkMode: false,
      drinkCount: 0
    };
    
    // Set interval dropdown
    const intervalSelect = document.getElementById('intervalSelect');
    const customIntervalGroup = document.getElementById('customIntervalGroup');
    const customInterval = document.getElementById('customInterval');
    
    // Common interval options
    const standardIntervals = [15, 30, 45, 60, 90, 120];
    
    if (standardIntervals.includes(settings.interval)) {
      intervalSelect.value = settings.interval;
      customIntervalGroup.style.display = 'none';
    } else {
      intervalSelect.value = 'custom';
      customIntervalGroup.style.display = 'block';
      customInterval.value = settings.interval;
    }
    
    // Set toggle switches
    document.getElementById('soundToggle').checked = settings.enableSound;
    document.getElementById('darkModeToggle').checked = settings.darkMode;
    
    // Set drink count
    document.getElementById('totalDrinks').textContent = settings.drinkCount;
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
  
  // Retrieve current drink count to preserve it
  chrome.storage.sync.get(['waterSettings'], (result) => {
    const currentSettings = result.waterSettings || {};
    
    const settings = {
      interval: intervalValue,
      enableSound: soundToggle.checked,
      darkMode: darkModeToggle.checked,
      drinkCount: currentSettings.drinkCount || 0,
      lastDrinkDate: currentSettings.lastDrinkDate || new Date().toDateString()
    };
    
    // Save to storage
    chrome.storage.sync.set({ waterSettings: settings }, () => {
      // Show saved feedback
      const saveBtn = document.getElementById('saveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✓ Saved';
      saveBtn.disabled = true;
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 1000);
    });
  });
}

// Reset to default settings
function resetSettings() {
  const defaultSettings = {
    interval: 30,
    enableSound: true,
    darkMode: false,
    drinkCount: 0,
    lastDrinkDate: new Date().toDateString()
  };
  
  chrome.storage.sync.set({ waterSettings: defaultSettings }, () => {
    loadSettings();
    
    // Show reset feedback
    const resetBtn = document.getElementById('resetBtn');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = '✓ Reset';
    resetBtn.disabled = true;
    
    setTimeout(() => {
      resetBtn.textContent = originalText;
      resetBtn.disabled = false;
    }, 1000);
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