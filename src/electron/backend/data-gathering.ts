import { sendWeatherGenerationProgressUpdate } from './../utils';
import { ipcMain } from 'electron';

let cancelRequested = false;

ipcMain.on('cancel-weather-image-generation', (_event) => cancelRequested = true);

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
      const locationOffset = Math.floor(-region.region.resolution/2) + (region.region.resolution % 2 === 0 ? 0.5 : 1); // how many steps to the left and top from the center
      console.log(locationOffset);
      const requests: { lat: number, lon: number, api: string, hours: number, tz: string }[] = [];

      if(cancelRequested) {
        sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
        reject('Cancelled by user.');
        cancelRequested = false;
      }

      for(let latIndex = 0; latIndex < region.region.resolution; latIndex++) {
        for(let lonIndex = 0; lonIndex < region.region.resolution; lonIndex++) {
          const lat = region.coordinates.latitude + (locationOffset + latIndex) * latStepSize;
          const lon = region.coordinates.longitude + (locationOffset + lonIndex) * lonStepSize;

          requests.push({ lat, lon, api: condition.api, hours: forecast_hours + 1, tz: region.timezoneCode });
        }
      }

      if(cancelRequested) {
        sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
        reject('Cancelled by user.');
        cancelRequested = false;
      }

      this.requestApiUrls(requests, progressPerStep)
        .then((data) => {
          resolve(data);
          cancelRequested = false;
        })
        .catch((error) => {
          reject(error);
          cancelRequested = false;
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

      console.log(url);

      try {
        const response = await fetch(url);

        if(cancelRequested) {
          throw new Error('Cancelled by user.');
        }

        // create an error entry for each hour if the request failed
        if(!response.ok) {
          for(let i = 0; i < data.hours; i++) {
            const date = new Date(Date.now() + i * 3600000);

            weatherData.push({
              coordinates: { latitude: data.lat, longitude: data.lon },
              weatherCondition: this.listAvailableWeatherConditions().find((condition) => condition.api === data.api)!,
              weatherValue: 0,
              error: true,
              date: date.toISOString()
            });
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, `Request for location #${dataList.indexOf(data) + 1} failed`);
        }

        // if the request was successful add the data to the weatherData array
        else {
          const json = await response.json();
          const time_values = json['hourly']['time'];

          for(let i = 0; i < time_values.length; i++) {
            const date = new Date(time_values[i]);
            const value = json['hourly'][data.api][i];

            weatherData.push({
              coordinates: { latitude: data.lat, longitude: data.lon },
              weatherCondition: this.listAvailableWeatherConditions().find((condition) => condition.api === data.api)!,
              weatherValue: value,
              error: false,
              date: date.toISOString()
            });
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, `Request for location #${dataList.indexOf(data) + 1} successful`);
        }

        if(cancelRequested)
          throw new Error('Cancelled by user.');

        await delay(this.REQUEST_DELAY);
      }
      catch(error) {
        return [];
      }
    }
    return weatherData;
  }

  getName(): string {
    return 'OpenMeteo';
  }

  listAvailableWeatherConditions(): WeatherCondition[] {
    return [
      { condition: 'Temperature (°C)', id: 'temperature_c', api: 'temperature_2m', min: -1, max: -1, unit: '°C' },
      { condition: 'Cloud Coverage (%)', id: 'cloud_cover', api: 'cloud_cover', min: 0, max: 100, unit: '%' },
      { condition: 'Relative Humidity (%)', id: 'relative_humidity', api: 'relative_humidity_2m', min: 0, max: 100, unit: '%' },
      { condition: 'Cloud Coverage (%, low)', id: 'cloud_cover_low', api: 'cloud_cover_low', min: 0, max: 100, unit: '%' },
      { condition: 'Cloud Coverage (%, mid)', id: 'cloud_cover_mid', api: 'cloud_cover_mid', min: 0, max: 100, unit: '%' },
      { condition: 'Cloud Coverage (%, high)', id: 'cloud_cover_high', api: 'cloud_cover_high', min: 0, max: 100, unit: '%' },
      { condition: 'Dew Point (°C)', id: 'dew_point_c', api: 'dew_point_2m', min: -1, max: -1, unit: '°C' },
      { condition: 'Air Pressure (hPa)', id: 'air_pressure', api: 'pressure_msl', min: -1, max: -1, unit: 'hPa' },
      { condition: 'Precipitation (mm)', id: 'precipitation_value', api: 'precipitation', min: 0, max: -1, unit: 'mm' },
      { condition: 'Precipitation Probability (%)', id: 'precipitation_probability', api: 'precipitation_probability', min: 0, max: 100, unit: '%' },
      { condition: 'Visibility (m)', id: 'visibility', api: 'visibility', min: -1, max: -1, unit: 'm' },
      { condition: 'UV Index', id: 'uv_index', api: 'uv_index', min: 0, max: 11, unit: '' },
    ];
  }
}

export class BrightSkyDataGatherer implements DataGatherer {
  readonly API_URL = "https://api.brightsky.dev/weather?date={date}&last_date={last_date}&lat={lat}&lon={lon}&tz={timezone}";
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
      const startDate = new Date(); // current date
      startDate.setMinutes(0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + forecast_hours, 0, 0, 0);

      const requests: { lat: number, lon: number, api: string, startDate: Date, endDate: Date, tz: string }[] = [];

      if(cancelRequested) {
        sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
        reject('Cancelled by user.');
        cancelRequested = false;
      }

      for(let latIndex = 0; latIndex < region.region.resolution; latIndex++) {
        for(let lonIndex = 0; lonIndex < region.region.resolution; lonIndex++) {
          const lat = region.coordinates.latitude + locationOffset + latIndex * latStepSize;
          const lon = region.coordinates.longitude + locationOffset + lonIndex * lonStepSize;

          requests.push({ lat, lon, api: condition.api, startDate, endDate, tz: region.timezoneCode });
        }
      }

      if(cancelRequested) {
        sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
        reject('Cancelled by user.');
        cancelRequested = false;
      }

      this.requestApiUrls(requests, progressPerStep)
        .then((data) => {
          resolve(data);
          cancelRequested = false;
        })
        .catch((error) => {
          reject(error);
          cancelRequested = false;
        });
    });
  }

  private async requestApiUrls(dataList: { lat: number, lon: number, api: string, startDate: Date, endDate: Date, tz: string }[], progressPerStep: number): Promise<WeatherData[]> {
    const weatherData: WeatherData[] = [];

    // get the current progress
    let progress = 0;

    for(const data of dataList) {
      const url = this.API_URL
        .replace('{lat}', data.lat.toString())
        .replace('{lon}', data.lon.toString())
        .replace('{category}', data.api)
        .replace('{date}', encodeURIComponent(data.startDate.toISOString()))
        .replace('{last_date}', encodeURIComponent(data.endDate.toISOString()))
        .replace('{timezone}', encodeURIComponent(data.tz));

      try {
        const response = await fetch(url);

        if(cancelRequested) {
          throw new Error('Cancelled by user.');
        }

        if(!response.ok) { // if the request failed
          for(let i = 0; i < (data.endDate.getTime() - data.startDate.getTime()); i += 3600000) {
            const date = new Date(data.startDate.getTime() + i);

            weatherData.push({
              coordinates: { latitude: data.lat, longitude: data.lon },
              weatherCondition: this.listAvailableWeatherConditions().find((condition) => condition.api === data.api)!,
              weatherValue: 0,
              error: true,
              date: date.toISOString()
            });
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, `Request for location #${dataList.indexOf(data) + 1} failed`);
        }

        // if the request was successful
        else {
          const json = await response.json();
          const dataArray = json['weather'];

          for(let i = 0; i < dataArray.length; i++) {
            const currWeatherData = dataArray[i];

            weatherData.push({
              coordinates: { latitude: data.lat, longitude: data.lon },
              weatherCondition: this.listAvailableWeatherConditions().find((condition) => condition.api === data.api)!,
              weatherValue: currWeatherData[data.api],
              error: false,
              date: new Date(currWeatherData.timestamp).toISOString()
            });
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, `Request for location #${dataList.indexOf(data) + 1} successful`);
        }

        if(cancelRequested)
          throw new Error('Cancelled by user.');

        await delay(this.REQUEST_DELAY);
      }
      catch(error) {
        console.error(error);
        return [];
      }
    }

    return weatherData;
  }

  getName(): string {
    return 'BrightSky';
  }

  listAvailableWeatherConditions(): WeatherCondition[] {
    return [
      { condition: 'Cloud Coverage (%)', id: 'cloud_cover', api: 'cloud_cover', min: 0, max: 100, unit: '%' },
      { condition: 'Dew Point (°C)', id: 'dew_point_c', api: 'dew_point', min: -1, max: -1, unit: '°C' },
      { condition: 'Precipitation Probability (%)', id: 'precipitation_probability', api: 'precipitation_probability', min: 0, max: 100 , unit: '%' },
      { condition: 'Air Pressure (hPa)', id: 'air_pressure', api: 'pressure_msl', min: -1, max: -1, unit: 'hPa' },
      { condition: 'Relative Humidity (%)', id: 'relative_humidity', api: 'relative_humidity', min: 0, max: 100, unit: '%' },
      { condition: 'Temperature (°C)', id: 'temperature_c', api: 'temperature', min: -1, max: -1, unit: '°C' },
      { condition: 'Visibility (m)', id: 'visibility', api: 'visibility', min: -1, max: -1, unit: 'm' },
      { condition: 'Wind speed (km/h)', id: 'wind_speed', api: 'wind_speed', min: 0, max: -1, unit: 'km/h' },
    ];
  }
}

function convertToKm(number: number, unit: Region['region']['size']['unit']): number {
  return unit === 'km' ? number : number * 1.60934;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
