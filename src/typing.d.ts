declare var module: NodeModule;
declare var electron: any;

interface NodeModule {
  id: string;
}

interface Window {
  versions: {
    chrome: () => string;
    electron: () => string;
    node: () => string;
  },
  files: {
    readFile: (filePath: string, encoding: string) => Promise<string>
    readAppFile: (filePath: string, encoding: string) => Promise<string>,
    checkAppFileExists: (filePath: string) => Promise<boolean>,
    writeAppFile: (filePath: string, data: string, encoding: string) => Promise<boolean>
  },
  app: {
    onSettingsModalClosed: (callback) => void,
    openProgressInfoWindow: () => void
  },
  weather: {
    generateWeatherImagesForRegion: (region: Region, dataGatherer: DataGathererName, weatherConditionId: string, forecast_length: number, valueLabels: boolean) => Promise<{ date: Date, filename: string }[]>,
    onWeatherGenerationProgress: (callback: CallableFunction) => void,
    sendWeatherGenerationProgress: (inProgress: boolean, progressValue: number, progressMessage: string) => void,
    getLatestProgressMessages: () => Promise<WeatherDataResponse[]>,
    cancelWeatherImageGeneration: () => void,
    listWeatherConditions: () => Promise<{[key: string]: WeatherCondition[]}>
  }
}

type AppPathContext = "home" | "appData" | "userData" | "sessionData" | "temp" | "exe" | "module" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | "recent" | "logs" | "crashDumps"
