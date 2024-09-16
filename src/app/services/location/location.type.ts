export type Location = {
  name: string;
  id: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  region: {
    size: {
      length: number;
      unit: 'km' | 'mi';
    };
    resolution: number;
  }
}
