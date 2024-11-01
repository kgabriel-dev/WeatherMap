import { sendWeatherGenerationProgressUpdate } from './../utils';

export class OpenMeteoDataGatherer implements DataGatherer {
  readonly API_URL = "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly={category}&forecast_hours={hours}&timezone={timezone}";
  readonly REQUEST_DELAY = 300; // time in ms to wait between two requests

  gatherData(region: Region, condition: WeatherCondition, forecast_hours: number, progressPerStep: number): Promise<WeatherData[]> {
    if(!this.listAvailableWeatherConditions().find((availableCondition) => availableCondition.id === condition.id))
      throw new Error('The selected Weather Condition not available');

    return new Promise((resolve, reject) => {
      const regionSizeInKm = convertToKm(region.region.size.length, region.region.size.unit);
      const stepSize = regionSizeInKm / region.region.resolution;
      const latStepSize = stepSize / 110.574; // 1° latitude is 110.574 km
      const lonStepSize = stepSize / (111.320 * Math.cos(region.coordinates.latitude * Math.PI / 180)); // 1° longitude is 111.320 km at the equator
      const locationOffset = -Math.floor(region.region.resolution/2) + (region.region.resolution % 2 === 0 ? 0.5 : 1);

      const requests: { lat: number, lon: number, api: string, hours: number, tz: string }[] = [];

      for(let latIndex = 0; latIndex < region.region.resolution; latIndex++) {
        for(let lonIndex = 0; lonIndex < region.region.resolution; lonIndex++) {
          const lat = region.coordinates.latitude + locationOffset + latIndex * latStepSize;
          const lon = region.coordinates.longitude + locationOffset + lonIndex * lonStepSize;

          requests.push({ lat, lon, api: condition.api, hours: forecast_hours, tz: region.timezoneCode });
        }
      }

      this.requestApiUrls(requests, progressPerStep)
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private async requestApiUrls(dataList: { lat: number, lon: number, api: string, hours: number, tz: string }[], progressPerStep: number): Promise<WeatherData[]> {
    const weatherData: WeatherData[] = [];

    // get the current progress
    let progress = 0;

    for(const data of dataList) {
      const url = this.API_URL
        .replace('{lat}', data.lat.toString())
        .replace('{lon}', data.lon.toString())
        .replace('{category}', data.api)
        .replace('{hours}', data.hours.toString())
        .replace('{timezone}', data.tz);

      try {
        const response = await fetch(url);

        if(!response.ok) {
          console.error(`Request failed with status code ${response.status}`);
          throw new Error(`REQUEST FAILED - Request failed with status code ${response.status}`);
        }

        const json = await response.json();
        const time_values = json['hourly']['time'];

        for(let i = 0; i < time_values.length; i++) {
          const date = new Date(time_values[i]);
          const value = json['hourly'][data.api][i];

          weatherData.push({
            coordinates: { latitude: data.lat, longitude: data.lon },
            weatherCondition: this.listAvailableWeatherConditions().find((condition) => condition.api === data.api)!,
            weatherValue: value,
            date: date.toISOString()
          });
        }

        progress += progressPerStep;
        sendWeatherGenerationProgressUpdate(true, progress, `Request for location #${dataList.indexOf(data) + 1} successful`);

        await delay(this.REQUEST_DELAY);
      }
      catch(error) {
        console.error(error);
      }
    }

    return weatherData;
  }

  getName(): string {
    return 'OpenMeteo';
  }

  listAvailableWeatherConditions(): WeatherCondition[] {
    return [
      { condition: 'Temperature (°C)', id: 'temperature_c', api: 'temperature_2m', min: -1, max: -1 },
      { condition: 'Cloud Coverage', id: 'cloud_cover', api: 'cloud_cover', min: 0, max: 100 },
      { condition: 'Relative Humidity', id: 'relative_humidity', api: 'relative_humidity_2m', min: 0, max: 100 },
      { condition: 'Cloud Coverage (low)', id: 'cloud_cover_low', api: 'cloud_cover_low', min: 0, max: 100 },
      { condition: 'Cloud Coverage (mid)', id: 'cloud_cover_mid', api: 'cloud_cover_mid', min: 0, max: 100 },
      { condition: 'Cloud Coverage (high)', id: 'cloud_cover_high', api: 'cloud_cover_high', min: 0, max: 100 },
      { condition: 'Dew Point (°C)', id: 'dew_point_c', api: 'dew_point_2m', min: -1, max: -1 },
      { condition: 'Air Pressure (msl)', id: 'air_pressure', api: 'pressure_msl', min: -1, max: -1 },
      { condition: 'Precipitation', id: 'precipitation_value', api: 'precipitation', min: 0, max: -1 },
      { condition: 'Precipitation Probability', id: 'precipitation_probability', api: 'precipitation_probability', min: 0, max: 100 },
      { condition: 'Visibility (m)', id: 'visibility', api: 'visibility', min: -1, max: -1 },
      { condition: 'UV Index', id: 'uv_index', api: 'uv_index', min: 0, max: 11 }
    ];
  }
}

function convertToKm(number: number, unit: Region['region']['size']['unit']): number {
  return unit === 'km' ? number : number * 1.60934;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
