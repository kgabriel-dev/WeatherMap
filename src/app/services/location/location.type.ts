export type Region = {
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
  },
  timezoneCode: string;
}

export type Location = {
  latitude: number;
  longitude: number;
}

export type RegionAddingData = {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  region: {
    size: {
      length: number,
      unit: 'km' | 'mi';
    },
    resolution: number;
  },
  timezoneCode: string;
}
