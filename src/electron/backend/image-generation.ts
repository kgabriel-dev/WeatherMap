import { createCanvas } from "@napi-rs/canvas";
import { OpenMeteoDataGatherer } from "./data-gathering";

const { app } = require('electron');
const fs = require('fs');

export function generateWeatherImageForLocation(region: Region, dataGathererName: DataGathererName, weatherConditionId: string, forecast_length: number): Promise<{ date: Date, filename: string }[]> {
  const dataGatherer = getDataGatherer(dataGathererName);

  return new Promise((resolve, reject) => {
    const weatherCondition = dataGatherer.listAvailableWeatherConditions().find((condition) => condition.id === weatherConditionId);

    if(!weatherCondition)
      reject('Unknown weather condition id');

    // gather the data for the location
    dataGatherer.gatherData(region, weatherCondition!, forecast_length)
      .then((weatherData) => {
        // convert the data from weather over space in a time range to weather over time at a location
        const weatherDataOverTime: { [timeIndex: number]: { weatherCondition: WeatherCondition, weatherValue: number, location: SimpleLocation }[] } = {};
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

        // gather all coordinates
        const allCoordinates: SimpleLocation[] = [];
        weatherData.forEach((data) => {
          if(!allCoordinates.find((coordinate) => coordinate.latitude === data.coordinates.latitude && coordinate.longitude === data.coordinates.longitude))
            allCoordinates.push(data.coordinates);
        });

        // sort the coordinates to a 2x2 grid
        const gridCoordinates: SimpleLocation[][] = [];
        const latitudes = allCoordinates.map((coordinate) => coordinate.latitude).sort();
        const longitudes = allCoordinates.map((coordinate) => coordinate.longitude).sort();

        for(let latIndex = 0; latIndex < latitudes.length; latIndex++) {
          for(let lonIndex = 0; lonIndex < longitudes.length; lonIndex++) {
            const coordinate = allCoordinates.find((coordinate) => coordinate.latitude === latitudes[latIndex] && coordinate.longitude === longitudes[lonIndex]);

            if(coordinate) {
              if(!gridCoordinates[latIndex])
                gridCoordinates[latIndex] = [];

              gridCoordinates[latIndex][lonIndex] = coordinate;
            }
          }
        }

        console.log(gridCoordinates);

        // sort the grid
        gridCoordinates.forEach((row) => row.sort((a, b) => a.longitude - b.longitude));
        gridCoordinates.sort((a, b) => a[0].latitude - b[0].latitude);

        console.log(gridCoordinates);

        // create the raster images
        for(let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
          const canvas = createCanvas(region.region.resolution, region.region.resolution);
          const context = canvas.getContext('2d');

          if(!context) {
            reject('Failed to create context');
          }

          canvas.width = region.region.resolution;
          canvas.height = region.region.resolution;

          for(const row of gridCoordinates) {
            for(const coordinate of row) {
              const weatherData = weatherDataOverTime[timeIndex].find((data) => data.location.latitude === coordinate.latitude && data.location.longitude === coordinate.longitude);

              const latIndex = gridCoordinates.indexOf(row);
              const lonIndex = row.indexOf(coordinate);

              if(weatherData) {
                const color = _mapValueToColor(weatherData.weatherValue, weatherCondition!.min, weatherCondition!.max);

                context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
                context.fillRect(latIndex, lonIndex, 1, 1);
              } else {
                console.error('No data found for location', coordinate.latitude, coordinate.longitude, 'at time', timeList[timeIndex]);

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

function getDataGatherer(dataGathererName: DataGathererName): DataGatherer {
  switch(dataGathererName) {
    case "OpenMeteo":
      return new OpenMeteoDataGatherer();
    case "BrightSky":
      // TODO: return new BrightSkyDataGatherer();
      throw new Error('BrightSky data gatherer is not implemented yet');
    default:
      throw new Error('Unknown data gatherer id');
  }
}

module.exports = {
  generateWeatherImageForLocation
};
