import { Location, Region } from "../../app/services/location/location.type";
import { DataGathererId, WeatherCondition } from "../../app/views/main/weather-data.type";
import { createCanvas } from "canvas";
import { OpenMeteoDataGatherer } from "./data-gathering";

const { app } = require('electron');
const fs = require('fs');

export function generateWeatherImageForLocation(region: Region, dataGathererId: DataGathererId, weatherCondition: WeatherCondition, forecast_length: number): Promise<{ date: Date, filename: string }[]> {
  const dataGatherer = getDataGatherer(dataGathererId);

  return new Promise((resolve, reject) => {
    // gather the data for the location
    dataGatherer.gatherData(region, weatherCondition, forecast_length)
      .then((weatherData) => {
        // convert the data from weather over space in a time range to weather over time at a location
        const weatherDataOverTime: { [timeIndex: number]: { weatherCondition: WeatherCondition, weatherValue: number, location: Location }[] } = {};
        const timeList: Date[] = weatherData.map((data) => data.date);

        const imagesToReturn: { date: Date, filename: string }[] = [];

        weatherData.forEach((data) => {
          const timeIndex = timeList.indexOf(data.date);

          if(!weatherDataOverTime[timeIndex])
            weatherDataOverTime[timeIndex] = [];

          weatherDataOverTime[timeIndex].push({
            weatherCondition: data.weatherCondition,
            weatherValue: data.weatherValue,
            location: data.coordinates
          });
        });

        // create the raster images
        for(let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
          const canvas = createCanvas(region.region.resolution, region.region.resolution);
          const context = canvas.getContext('2d');

          if(!context) {
            reject('Failed to create context');
          }

          canvas.width = region.region.resolution;
          canvas.height = region.region.resolution;

          for(let latIndex = 0; latIndex < region.region.resolution; latIndex++) {
            for(let lonIndex = 0; lonIndex < region.region.resolution; lonIndex++) {
              const lat = region.coordinates.latitude + region.region.size.length * (latIndex / region.region.resolution);
              const lon = region.coordinates.longitude + region.region.size.length * (lonIndex / region.region.resolution);

              const weatherData = weatherDataOverTime[timeIndex].find((data) => data.location.latitude === lat && data.location.longitude === lon);

              if(weatherData) {
                const color = _mapValueToColor(weatherData.weatherValue, weatherCondition.min, weatherCondition.max);

                context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
                context.fillRect(latIndex, lonIndex, 1, 1);
              } else {
                console.error('No data found for location', lat, lon);

                const color = [255, 0, 0, 200];

                context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
                context.fillRect(latIndex, lonIndex, 1, 1);
              }

              // save the image to a file in the temp directory
              const buffer = canvas.toBuffer('image/png');
              const filename = `${app.getPath('temp')}/weather_image_${timeIndex}.png`;

              try {
                fs.writeFileSync(filename, buffer);
                imagesToReturn.push({date: timeList[timeIndex], filename: filename});
              } catch (error) {
                console.error('Failed to write file', error);
              }
            }
          }
        }

        resolve(imagesToReturn);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function _mapValueToColor(value: number, min: number, max: number): number[] {
  const colorValue = 0 + (255 - 0) / (max - min) * (value - min);

  // fade from white to blue using the color value
  return [255, 255, colorValue, 200];
}

function getDataGatherer(dataGathererId: DataGathererId) {
  switch(dataGathererId) {
    case DataGathererId.OpenMeteo:
      return new OpenMeteoDataGatherer();
    case DataGathererId.BrightSky:
      // TODO: return new BrightSkyDataGatherer();
      throw new Error('BrightSky data gatherer is not implemented yet');
    default:
      throw new Error('Unknown data gatherer id');
  }
}

module.exports = {
  generateWeatherImageForLocation
};
