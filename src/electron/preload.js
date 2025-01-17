var { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('files', {
  readFile: (filePath, encoding) => ipcRenderer.invoke('read-file', filePath, encoding),
  readAppFile: (filePath, encoding) => ipcRenderer.invoke('read-app-file', filePath, encoding),
  checkAppFileExists: (filePath) => ipcRenderer.invoke('check-app-file-exists', filePath),
  writeAppFile: (filePath, data, encoding) => ipcRenderer.invoke('write-app-file', filePath, data, encoding)
});

contextBridge.exposeInMainWorld('app', {
  onSettingsModalClosed: (callback) => ipcRenderer.on('settings-modal-closed', callback),
  openProgressInfoWindow: () => ipcRenderer.invoke('open-progress-info-window'),
  setLocale: (locale) => ipcRenderer.invoke('set-locale', locale),
  getLocale: () => ipcRenderer.invoke('get-locale'),
  sendTranslations: (translations) => ipcRenderer.send('translations-changed', translations),
  triggerUpdateCheck: () => ipcRenderer.invoke('trigger-update-check'),
});

contextBridge.exposeInMainWorld('weather', {
  generateWeatherImagesForRegion: (region, dataGatherer, weatherCondition, forecastLength, valueLabels) => ipcRenderer.invoke('generate-weather-images-for-region', region, dataGatherer, weatherCondition, forecastLength, valueLabels),
  onWeatherGenerationProgress: (callback) => ipcRenderer.on('weather-generation-progress-update', (_event, inProgress, progressValue, progressMessage) => callback(inProgress, progressValue, progressMessage)),
  sendWeatherGenerationProgress: (inProgress, progressValue, progressMessage) => ipcRenderer.send('weather-generation-progress', inProgress, progressValue, progressMessage),
  getLatestProgressMessages: () => ipcRenderer.invoke('get-latest-progress-messages'),
  cancelWeatherImageGeneration: () => ipcRenderer.invoke('cancel-weather-image-generation'),
  listWeatherConditions: () => ipcRenderer.invoke('list-weather-conditions')
});
