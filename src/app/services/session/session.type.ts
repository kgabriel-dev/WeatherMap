import { SimpleLocation, Region } from "../../../types/location";
import { DataGathererName, WeatherCondition } from "../../../types/weather-data";
import { Settings } from "../settings/settings.service";

export type SessionData = {
  mainData: MainData;
}

export type MainData = {
  currentWeatherImageIndex: number;
  numberOfWeatherImages: number;
  selectedRegionIndex: number;
  usedLocation: SimpleLocation;
  regionResolution: number;
  regionSize: Region['region']['size'];
  forecastLength: Settings['forecastLength'];
  weatherDataSource: DataGathererName;
  weatherCondition: WeatherCondition | undefined;
  overriddenTimezoneCode: string;
  useOverriddenTimezone: boolean;
}
