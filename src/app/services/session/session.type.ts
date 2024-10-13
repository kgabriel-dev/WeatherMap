export type SessionData = {
  mainData: MainData;
}

export type MainData = {
  currentWeatherImageIndex: number;
  numberOfWeatherImages: number;
  selectedRegion: Region | undefined;
  usedLocation: SimpleLocation;
  regionResolution: number;
  regionSize: Region['region']['size'];
  forecastLength: number;
  weatherDataSource: DataGathererName;
}
