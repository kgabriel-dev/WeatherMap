import { ipcMain } from "electron";

function sendWeatherGenerationProgressUpdate(inProgress: boolean, progress: number, message: string) {
  ipcMain.emit('weather-generation-progress', undefined, inProgress, progress, message);
}

enum SizeUnits {
  KILOMETERS,
  MILES
}

export { sendWeatherGenerationProgressUpdate, SizeUnits };