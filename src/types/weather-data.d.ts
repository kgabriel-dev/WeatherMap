declare interface DataGatherer {
  getName: () => string;
  gatherData: (region: Region, condition: WeatherCondition, forecast_hours: number, progressPerStep: number, translations: {[key: string]: string}) => Promise<WeatherData[]>;
  listAvailableWeatherConditions: (translations: {[key: string]: string}) => WeatherCondition[];
}

declare type WeatherData = {
  coordinates: SimpleLocation,
  weatherCondition: WeatherCondition,
  weatherValue: number,
  error: boolean,
  date: string
}

declare type WeatherCondition = {
  condition: string; // name to display in the UI
  id: string; // key to identify the condition on a change of the DataGatherer
  api: string; // value to use in the API request
  min: number; // -1 represents a dynamic minimum value
  max: number; // -1 represents a dynamic maximum value
  unit: string; // unit to display in the UI
}

declare type DataGathererName = 'OpenMeteo' | 'BrightSky';

declare type WeatherDataResponse = {
  inProgress: boolean;
  progress: number;
  message: string;
}
