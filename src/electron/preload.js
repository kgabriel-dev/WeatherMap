const { contextBridge, ipcRenderer } = require('electron');
const { on } = require('events');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

contextBridge.exposeInMainWorld('files', {
  readFile: (filePath, encoding) => ipcRenderer.invoke('read-file', filePath, encoding),
  readAppFile: (filePath, encoding) => ipcRenderer.invoke('read-app-file', filePath, encoding),
  checkAppFileExists: (filePath) => ipcRenderer.invoke('check-app-file-exists', filePath),
  writeAppFile: (filePath, data, encoding) => ipcRenderer.invoke('write-app-file', filePath, data, encoding)
});

contextBridge.exposeInMainWorld('app', {
  onSettingsModalClosed: (callback) => ipcRenderer.on('settings-modal-closed', callback),
  openProgressInfoWindow: () => ipcRenderer.invoke('open-progress-info-window'),
});

contextBridge.exposeInMainWorld('weather', {
  generateWeatherImagesForRegion: (region, dataGatherer, weatherCondition, forecastLength) => ipcRenderer.invoke('generate-weather-images-for-region', region, dataGatherer, weatherCondition, forecastLength),
  onWeatherGenerationProgress: (callback) => ipcRenderer.on('weather-generation-progress-update', (_event, inProgress, progressValue, progressMessage) => callback(inProgress, progressValue, progressMessage)),
  sendWeatherGenerationProgress: (inProgress, progressValue, progressMessage) => ipcRenderer.send('weather-generation-progress', inProgress, progressValue, progressMessage),
  getLatestProgressMessages: () => ipcRenderer.invoke('get-latest-progress-messages')
});
