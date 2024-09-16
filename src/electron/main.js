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

ipcMain.handle('read-file', (event, path) => {
  try {
    return fs.readFileSync(path, 'base64').toString()
  } catch (err) {
    console.error('Error reading file:', err)
    throw err;
  }
})
