import { ipcMain } from "electron";

function sendWeatherGenerationProgressUpdate(inProgress: boolean, progress: number, message: string, callback: any) {
  ipcMain.emit('weather-generation-progress', undefined, inProgress, progress, message);
  callback();
}

enum SizeUnits {
  KILOMETERS,
  MILES
}

// export { sendWeatherGenerationProgressUpdate, SizeUnits };

module.exports = {
  sendWeatherGenerationProgressUpdate,
  SizeUnits
};