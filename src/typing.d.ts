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
    readFile: (filePath: string) => Promise<string>
  }
}
