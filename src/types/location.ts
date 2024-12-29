export type Region = {
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

export type SimpleLocation = {
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
      unitId: SizeUnits;
    },
    resolution: number;
  },
  timezoneCode: string;
}

export enum SizeUnits {
  KILOMETERS,
  MILES
}
