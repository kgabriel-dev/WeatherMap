const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const url = require('node:url')
const fs = require('node:fs')

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'weather-map', 'browser', 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
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
ipcMain.handle('read-file', (event, filePath, encoding) => {
  return readFile(filePath, encoding);
})

ipcMain.handle('read-app-file', (event, filePath, encoding) => {
  // use the app's path and the read-file function to read the file
  return readFile(path.join(app.getAppPath(), filePath), encoding);
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
