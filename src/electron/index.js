import { app, BrowserWindow, ipcMain, Menu, shell, dialog, nativeTheme } from 'electron';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import { generateWeatherImageForLocation } from './backend/image-generation.js';
import { OpenMeteoDataGatherer, BrightSkyDataGatherer } from './backend/data-gathering.js';
import { fileURLToPath } from 'node:url';

import pkg from 'electron-updater';
const { autoUpdater } = pkg;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let mainWindow, progressWindow, settingsWindow;
let latestProgressMessages = [];

let locale = 'en-US';
let translations = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ipcMain.on('translations-changed', (_event, newTranslations) => {
  translations = newTranslations;
  createAndSetMenu();
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Create the application menu
  createAndSetMenu();

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.once('ready-to-show', () => {
    // wait until the locale is set and the translations are loaded before showing the window
    let checkInterval = setInterval(() => {
      if(Object.keys(translations).length > 0) {
        clearInterval(checkInterval);

        // maximize the window and show it
        mainWindow.maximize();
        mainWindow.show();
      }
    }, 200);

    // get the translations from the renderer process
    mainWindow.webContents.send('request-translations');

    openSettingsModal();
  });
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

autoUpdater.on('update-not-available', () => {
  console.log('No updates available');
});

// function to open the settings modal; called from the menu bar
function openSettingsModal() {
  settingsWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
    protocol: 'file:',
    slashes: true,
    hash: '#/settings'
  }))

  let menuTemplate = [];
  let menu = Menu.buildFromTemplate(menuTemplate);
  settingsWindow.setMenu(menu);

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();

    settingsWindow.toggleDevTools();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;

    // send a message to the main window to update the settings
    mainWindow.webContents.send('settings-modal-closed');
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('read-file', (_event, filePath, encoding) => {
  return readFile(filePath, encoding);
})

ipcMain.handle('read-app-file', (_event, filePath, encoding) => {
  // use the app's path and the read-file function to read the file
  return readFile(path.join(app.getPath("userData"), filePath), encoding);
});

ipcMain.handle('check-app-file-exists', (_event, filePath) => {
  return fs.existsSync(path.join(app.getPath("userData"), filePath));
});

ipcMain.handle('write-app-file', (_event, filePath, data, encoding) => {
  try {
    fs.writeFileSync(path.join(app.getPath("userData"), filePath), data, { encoding, flag: 'w' });
    return true;
  } catch (err) {
    console.error('Error writing file:', err);
    return false;
  }
});

ipcMain.handle('generate-weather-images-for-region', (_event, region, dataGatherer, weatherCondition, forecastLength, valueLabels) => {
  return generateWeatherImageForLocation(region, dataGatherer, weatherCondition, forecastLength, valueLabels, translations);
});

ipcMain.on('weather-generation-progress', (_event, inProgress, progressValue, progressMessage) => {
  if(progressValue === 0) {
    latestProgressMessages = [];
  }
  latestProgressMessages.push({ inProgress, progress: progressValue, message: progressMessage });

  if(mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send('weather-generation-progress-update', inProgress, progressValue, progressMessage);

  if(progressWindow && !progressWindow.isDestroyed())
    progressWindow.webContents.send('weather-generation-progress-update', inProgress, progressValue, progressMessage);
});

ipcMain.handle('get-latest-progress-messages', (_event) => {
  return latestProgressMessages;
});

ipcMain.handle('open-progress-info-window', (_event) => {
  progressWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  progressWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
    protocol: 'file:',
    slashes: true,
    hash: '#/progress'
  }));

  progressWindow.once('ready-to-show', () => {
    progressWindow.show();
  });

  progressWindow.on('closed', () => {
    progressWindow = null;
  });
});

ipcMain.handle('cancel-weather-image-generation', (_event) => {
  ipcMain.emit('cancel-weather-image-generation');
});
ipcMain.on('canceled-weather-image-generation', (_event) => {
  ipcMain.emit('weather-generation-progress', false, 100, translations.imageGenerationCanceledByUser);
});


ipcMain.handle('list-weather-conditions', (_event) => {
  const weatherConditions = {};

  weatherConditions['OpenMeteo'] = new OpenMeteoDataGatherer().listAvailableWeatherConditions(translations);
  weatherConditions['BrightSky'] = new BrightSkyDataGatherer().listAvailableWeatherConditions(translations);

  return weatherConditions;
});

ipcMain.handle('set-locale', (_event, newLocale) => {
  locale = newLocale;

  if(mainWindow && !mainWindow.isDestroyed())
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
      protocol: 'file:',
      slashes: true
    }));

  if(progressWindow && !progressWindow.isDestroyed())
    progressWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
      protocol: 'file:',
      slashes: true,
      hash: '#/progress'
    }));

  if(settingsWindow && !settingsWindow.isDestroyed())
    settingsWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
      protocol: 'file:',
      slashes: true,
      hash: '#/settings'
    }));
});

ipcMain.handle('get-locale', (_event) => {
  return locale;
});

ipcMain.handle('trigger-update-check', (_event) => {
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  const dialogOpts = {
    type: 'info',
    buttons: [translations.updateAvailableDialogButtonYes, translations.updateAvailableDialogButtonNo],
    title: translations.updateAvailableDialogTitle,
    message: translations.updateAvailableDialogMessage
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      shell.openExternal('https://github.com/kgabriel-dev/WeatherMap/releases/latest')
    }
  });
});

ipcMain.handle('close-settings', (_event) => {
  if(settingsWindow && !settingsWindow.isDestroyed())
    settingsWindow.close();
});

ipcMain.handle('toggle-dark-mode', (_event, value) => {
  nativeTheme.themeSource = value ? 'dark' : 'light';
});

// Helper functions
function readFile(filePath, encoding) {
  try {
    return fs.readFileSync(filePath, { encoding }).toString()
  } catch (err) {
    console.error('Error reading file:', err)
    throw err;
  }
}

function createAndSetMenu() {
  const isMac = process.platform === 'darwin';
  const menuTemplate = [
    ...(isMac
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }]
    : []),
  // { role: 'settingsMenu' }
  {
    label: translations.menuSettingsTitle,
    submenu: [
      {
        label: translations.menuOpenSettings,
        accelerator: 'CmdOrCtrl+,',
        click: () => openSettingsModal()
      }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: translations.menuWindowTitle,
    submenu: [
      { role: 'minimize', label: translations.menuMinimizeWindow },
      ...(isMac
        ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ]
        : [
            { role: 'close', label: translations.menuCloseWindow }
          ])
    ]
  },
  {
    role: 'help',
    label: translations.menuHelpTitle,
    submenu: [
      {
        label: translations.menuLearnMore,
        click: async () => {
          await shell.openExternal('https://github.com/kgabriel-dev/WeatherMap')
        }
      },
      {
        role: 'about',
        label: translations.menuAbout
      },
      {
        'label': translations.menuDevTools,
        'accelerator': 'CmdOrCtrl+Shift+I',
        'click': async () => {
          mainWindow.webContents.toggleDevTools();
        }
      }
    ]
  }];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}
