const { contextBridge, ipcRenderer, app } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

contextBridge.exposeInMainWorld('files', {
  readFile: (filePath, encoding) => ipcRenderer.invoke('read-file', filePath, encoding),
  readAppFile: (filePath, encoding) => ipcRenderer.invoke('read-app-file', filePath, encoding)
});
