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
    writeAppFile: (filePath: string, data: string, encoding: string) => Promise<boolean>,
  },
  app: {
    onSettingsModalClosed: (callback) => void
  }
}

type AppPathContext = "home" | "appData" | "userData" | "sessionData" | "temp" | "exe" | "module" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | "recent" | "logs" | "crashDumps"
