import { resolve } from "path";
import { Location, Region } from "../../app/services/location/location.type";
import { DataGatherer, WeatherCondition, WeatherData } from "./weather-data.type";

import * as https from 'https';

class OpenMeteoDataGatherer implements DataGatherer {
  readonly API_URL = "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly={category}&forecast_hours={hours}&timezone={timezone}";
  readonly REQUEST_DELAY = 300; // time in ms to wait between two requests

  gatherData(region: Region, condition: WeatherCondition, forecast_hours: number): Promise<WeatherData[]> {
    if(!this.listAvailableWeatherConditions().includes(condition))
      throw new Error('Condition not available');

    return new Promise((resolve, reject) => {
      const regionSizeInKm = convertToKm(region.region.size.length, region.region.size.unit);
      const stepSize = regionSizeInKm / region.region.resolution;
      const locationOffset = -Math.floor(region.region.resolution/2) + (region.region.resolution % 2 === 0 ? 0.5 : 1);

      for(let latIndex = 0; latIndex < region.region.resolution; latIndex++) {
        for(let lonIndex = 0; lonIndex < region.region.resolution; lonIndex++) {
          const lat = region.coordinates.latitude + locationOffset + latIndex * stepSize;
          const lon = region.coordinates.longitude + locationOffset + lonIndex * stepSize;

          // request data for the current location
          const url = this.API_URL
            .replace('{lat}', lat.toString())
            .replace('{lon}', lon.toString())
            .replace('{category}', condition.api)
            .replace('{hours}', forecast_hours.toString())
            .replace('{timezone}', region.timezoneCode);

            const request = https.request(url, (response) => {
              response.setEncoding('utf8');

              let data = '';

              response.on('data', (chunk) => {
                data += chunk;
              });

              response.on('end', () => {
                if(response.statusCode !== 200) {
                  console.error(`Request failed with status code ${response.statusCode}`);
                  reject(`REQUEST FAILED - Request failed with status code ${response.statusCode}`)
                }

                const json = JSON.parse(data);
                const time_values = json['hourly']['time'];

                const weatherData: WeatherData[] = [];

                for(let i = 0; i < time_values.length; i++) {
                  const date = new Date(time_values[i]);
                  const value = json['hourly'][condition.api][i];

                  weatherData.push({
                    coordinates: { latitude: lat, longitude: lon },
                    weatherCondition: condition,
                    weatherValue: value,
                    date: date
                  });
                }

                resolve(weatherData);
              });
            });

            request.on('error', (error) => {
              console.error(error);
              reject(error);
            });

            request.end();
          }
        }
      });
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
