import { Location, Region } from "../../services/location/location.type";

export interface DataGatherer {
  getName: () => string;
  gatherData: (region: Region, condition: WeatherCondition, forecast_hours: number) => Promise<WeatherData[]>;
  listAvailableWeatherConditions: () => WeatherCondition[];
}

export type WeatherData = {
  coordinates: Location,
  weatherCondition: WeatherCondition,
  weatherValue: number,
  date: Date
}

export type WeatherCondition = {
  condition: string; // name to display in the UI
  id: string; // key to identify the condition on a change of the DataGatherer
  api: string; // value to use in the API request
  min: number; // -1 represents a dynamic minimum value
  max: number; // -1 represents a dynamic maximum value
}

export enum DataGathererId {
  OpenMeteo = 'openmeteo',
  BrightSky = 'brightsky'
}

export const WeatherConditions: { [key in DataGathererId]: { condition: string; id: string; api: string }[] } = {
  [DataGathererId.OpenMeteo]: [
    { condition: 'Temperature (°C)', id: 'temperature_c', api: 'temperature_2m' },
    { condition: 'Cloud Coverage', id: 'cloud_cover', api: 'cloud_cover' },
    { condition: 'Relative Humidity', id: 'relative_humidity', api: 'relative_humidity_2m' },
    { condition: 'Cloud Coverage (low)', id: 'cloud_cover_low', api: 'cloud_cover_low' },
    { condition: 'Cloud Coverage (mid)', id: 'cloud_cover_mid', api: 'cloud_cover_mid' },
    { condition: 'Cloud Coverage (high)', id: 'cloud_cover_high', api: 'cloud_cover_high' },
    { condition: 'Dew Point (°C)', id: 'dew_point_c', api: 'dew_point_2m' },
    { condition: 'Air Pressure (msl)', id: 'air_pressure', api: 'pressure_msl' },
    { condition: 'Precipitation', id: 'precipitation_value', api: 'precipitation' },
    { condition: 'Precipitation Probability', id: 'precipitation_probability', api: 'precipitation_probability' },
    { condition: 'Visibility (m)', id: 'visibility', api: 'visibility' },
    { condition: 'UV Index', id: 'uv_index', api: 'uv_index' }
  ],
  [DataGathererId.BrightSky]: []
}
