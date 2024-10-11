import { Region } from "../../app/services/location/location.type";

export interface DataGatherer {
  getName: () => string;
  gatherData: (region: Region, condition: WeatherCondition, forecast_hours: number) => Promise<WeatherData[]>;
  listAvailableWeatherConditions: () => WeatherCondition[];
}

export type WeatherData = {
  coordinates: {
    latitude: number,
    longitude: number
  },
  weatherCondition: WeatherCondition,
  weatherValue: number
}

export type WeatherCondition = {
  condition: string; // name to display in the UI
  id: string; // key to identify the condition on a change of the DataGatherer
  api: string; // value to use in the API request
  min: number; // -1 represents a dynamic minimum value
  max: number; // -1 represents a dynamic maximum value
}
