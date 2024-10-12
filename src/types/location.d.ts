declare type Region = {
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

declare type SimpleLocation = {
  latitude: number;
  longitude: number;
}

declare type RegionAddingData = {
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
