require('ts-node').register();

const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('node:path')
const url = require('node:url')
const fs = require('node:fs')
const { generateWeatherImageForLocation } = require('./backend/image-generation');
const { OpenMeteoDataGatherer, BrightSkyDataGatherer } = require('./backend/data-gathering');

let mainWindow, progressWindow, settingsWindow;
let latestProgressMessages = [];

let locale = 'en-US';

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
    label: 'Settings',
    submenu: [
      {
        label: 'Open Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => openSettingsModal()
      }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      ...(isMac
        ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ]
        : [
            { role: 'close' }
          ])
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = require('electron')
          await shell.openExternal('https://github.com/kgabriel-dev/WeatherMap')
        }
      },
      {
        role: 'about',
        label: 'About'
      },
      {
        'label': 'Dev. Tools',
        'accelerator': 'CmdOrCtrl+Shift+I',
        'click': async () => {
          mainWindow.webContents.toggleDevTools();
        }
      }
    ]
  }];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // maximize the window and show it
  mainWindow.maximize()
  mainWindow.show()

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'weather-map', 'browser', locale, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // function to open the settings modal; called from the menu bar
  function openSettingsModal() {
    settingsWindow = new BrowserWindow({
      parent: mainWindow,
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
    });

    settingsWindow.on('closed', () => {
      settingsWindow = null;

      // send a message to the main window to update the settings
      mainWindow.webContents.send('settings-modal-closed');
    });
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('read-file', (_event, filePath, encoding) => {
  return readFile(filePath, encoding);
})

ipcMain.handle('read-app-file', (_event, filePath, encoding) => {
  // use the app's path and the read-file function to read the file
  return readFile(path.join(app.getAppPath(), filePath), encoding);
});

ipcMain.handle('check-app-file-exists', (_event, filePath) => {
  return fs.existsSync(path.join(app.getAppPath(), filePath));
});

ipcMain.handle('write-app-file', (_event, filePath, data, encoding) => {
  try {
    fs.writeFileSync(path.join(app.getAppPath(), filePath), data, { encoding, flag: 'w' });
    return true;
  } catch (err) {
    console.error('Error writing file:', err);
    return false;
  }
});

ipcMain.handle('generate-weather-images-for-region', (_event, region, dataGatherer, weatherCondition, forecastLength, valueLabels) => {
  return generateWeatherImageForLocation(region, dataGatherer, weatherCondition, forecastLength, valueLabels);
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
  ipcMain.emit('weather-generation-progress', false, 100, 'Weather image generation cancelled by user.');
});


ipcMain.handle('list-weather-conditions', (_event) => {
  const weatherConditions = {};

  weatherConditions['OpenMeteo'] = new OpenMeteoDataGatherer().listAvailableWeatherConditions();
  weatherConditions['BrightSky'] = new BrightSkyDataGatherer().listAvailableWeatherConditions();

  return weatherConditions;
});

ipcMain.handle('set-locale', (_event, locale) => {
  this.locale = locale;

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
  return this.locale;
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
