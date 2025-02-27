type Region = {
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

type SimpleLocation = {
  latitude: number;
  longitude: number;
}

type RegionAddingData = {
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

enum SizeUnits {
  KILOMETERS,
  MILES
}
