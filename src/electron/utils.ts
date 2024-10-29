import { ipcMain } from "electron";

export function sendWeatherGenerationProgressUpdate(inProgress: boolean, progress: number, message: string) {
  ipcMain.emit('weather-generation-progress', inProgress, progress, message);
}
