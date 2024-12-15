declare type Region = {
  name: string;
  id: number;
  coordinates: SimpleLocation;
  region: {
    size: {
      length: number;
      unitId: SizeUnits;
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
      unitId: SizeUnits;
    },
    resolution: number;
  },
  timezoneCode: string;
}

declare enum SizeUnits {
  KILOMETERS,
  MILES
}
