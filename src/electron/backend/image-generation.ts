import { createCanvas } from "@napi-rs/canvas";
import { BrightSkyDataGatherer, OpenMeteoDataGatherer } from "./data-gathering";
import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import { sendWeatherGenerationProgressUpdate } from "../utils";

let cancelRequested = false;
const imagePixelSize = 512;

ipcMain.on('cancel-weather-image-generation', (_event) => cancelRequested = true);

export function generateWeatherImageForLocation(region: Region, dataGathererName: DataGathererName, weatherConditionId: string, forecast_length: number): Promise<{ date: string, filename: string }[]> {
  const dataGatherer = getDataGatherer(dataGathererName);

  return new Promise((resolve, reject) => {
    const weatherCondition = dataGatherer.listAvailableWeatherConditions().find((condition) => condition.id === weatherConditionId);

    if(!weatherCondition) {
      reject('Unknown weather condition id');
      return;
    }

    let progress = 0;
    sendWeatherGenerationProgressUpdate(true, progress, 'Deleting the old weather images');
    // check if the WeatherMap dir in the temp dir exists, if not create it
    // and if it exists, delete all files in it
    const dir = `${app.getPath('temp')}/WeatherMap`;
    if(!fs.existsSync(dir))
      fs.mkdirSync(dir);
    else
      fs.readdirSync(dir).forEach((file) => fs.unlinkSync(`${dir}/${file}`));

    if(cancelRequested) {
      sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
      reject('Cancelled by user.');
      cancelRequested = false;
    }

    // calculate the progress for the data gathering
    const numberOfLocations = region.region.resolution * region.region.resolution;
    const numberOfImages = forecast_length;
    const progressPerStep = 100 / (numberOfLocations + numberOfImages + 2); // how much progress is made per step (location or image); +2 for "finished data gathering"-message and for the final step

    // gather the data for the location
    dataGatherer.gatherData(region, weatherCondition, forecast_length, progressPerStep)
      .then((weatherData) => {
        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        progress += progressPerStep * numberOfLocations + progressPerStep;
        sendWeatherGenerationProgressUpdate(true, progress, 'Data gathering finished. Converting data now');

        // convert the data from weather over space in a time range to weather over time at a location
        const weatherDataOverTime: { [timeIndex: number]: { weatherCondition: WeatherCondition, weatherValue: number, error: boolean, location: SimpleLocation }[] } = {};

        const timeList: string[] = [];
        weatherData.forEach((data) => {
          if(!timeList.find((date) => date === data.date))
            timeList.push(data.date);
        });

        const imagesToReturn: { date: string, filename: string }[] = [];

        weatherData.forEach((data) => {
          const timeIndex = timeList.indexOf(data.date);

          if(!weatherDataOverTime[timeIndex])
            weatherDataOverTime[timeIndex] = [];

          weatherDataOverTime[timeIndex].push({
            weatherCondition: data.weatherCondition,
            weatherValue: data.weatherValue,
            location: data.coordinates,
            error: data.error
          });
        });

        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        // gather all coordinates
        const allCoordinates = weatherData.map((data) => data.coordinates).filter((value, index, self) => self.indexOf(value) === index);


        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        // sort the coordinates to a res x res grid
        const gridCoordinates: SimpleLocation[][] = [];
        const latitudes = allCoordinates
                            .map((coordinate) => coordinate.latitude)
                            .filter((value, index, self) => self.indexOf(value) === index);
        const longitudes = allCoordinates
                            .map((coordinate) => coordinate.longitude)
                            .filter((value, index, self) => self.indexOf(value) === index);

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

        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        // sort the grid
        gridCoordinates.forEach((row) => row.sort((a, b) => a.longitude - b.longitude));
        gridCoordinates.sort((a, b) => a[0].latitude - b[0].latitude);

        const maxWeatherValue = weatherCondition.max == -1 ? Math.max(...weatherData.map((data) => data.weatherValue)) : weatherCondition.max;
        const minWeatherValue = weatherCondition.min == -1 ? Math.min(...weatherData.map((data) => data.weatherValue)) : weatherCondition.min;

        // create the raster images
        for(let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
          if(cancelRequested) {
            sendWeatherGenerationProgressUpdate(false, 100, 'Cancelled by user');
            reject('Cancelled by user.');
            cancelRequested = false;
          }

          const canvas = createCanvas(region.region.resolution, region.region.resolution);
          const context = canvas.getContext('2d');

          if(!context) {
            reject('Failed to create image context');
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, `Creating image #${timeIndex + 1}`);

          canvas.width = region.region.resolution * imagePixelSize;
          canvas.height = region.region.resolution * imagePixelSize;

          // create the image square by square - without any labels
          for(const [rowIndex, row] of gridCoordinates.entries()) {
            for(const [columnIndex, coordinate] of row.entries()) {
              const weatherData = weatherDataOverTime[timeIndex]?.find((data) => data.location.latitude === coordinate.latitude && data.location.longitude === coordinate.longitude) || null;

              let color: number[]; // color to draw the square with
              if(!weatherData || weatherData.error) {
                color = [255, 255, 255, 255]; // no data or error -> no visible square
              } else {
                color = _mapValueToColor(weatherData.weatherValue, minWeatherValue, maxWeatherValue);
              }

              context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 200)`;
              context.fillRect(rowIndex * imagePixelSize, columnIndex * imagePixelSize, imagePixelSize, imagePixelSize); // draw squares that are imagePixelSize x imagePixelSize pixels
            }
          }

          // save the image to a file in the temp directory
          const buffer = canvas.toBuffer('image/png');
          const filename = `${app.getPath('temp')}/WeatherMap/weather_image_${timeIndex}_excluding_labels.png`;

          try {
            fs.writeFileSync(filename, buffer);
            imagesToReturn.push({date: timeList[timeIndex], filename: filename});
          } catch (error) {
            console.error('Failed to write file', error);
          }

          // add the labels to the image square by square
          for(const [rowIndex, row] of gridCoordinates.entries()) {
            for(const [columnIndex, coordinate] of row.entries()) {
              const weatherData = weatherDataOverTime[timeIndex]?.find((data) => data.location.latitude === coordinate.latitude && data.location.longitude === coordinate.longitude) || null;

              let value: string; // value to draw in the square as a label
              if(!weatherData || weatherData.error) {
                value = 'N/A'; // no data or error -> no visible square
              } else {
                value = weatherData.weatherValue.toString() + weatherCondition.unit;
              }

              context.fillStyle = 'rgba(0, 0, 0, 255)';
              context.font = '20px Arial';
              context.fillText(value, columnIndex * imagePixelSize + 10, rowIndex * imagePixelSize + 30); // add labels to the squares
            }
          }

          // save the image to a file in the temp directory
          const bufferWithLabels = canvas.toBuffer('image/png');
          const filenameWithLabels = `${app.getPath('temp')}/WeatherMap/weather_image_${timeIndex}_including_labels.png`;

          try {
            fs.writeFileSync(filenameWithLabels, bufferWithLabels);
          } catch (error) {
            console.error('Failed to write file', error);
          }
        }

        progress = 100;
        sendWeatherGenerationProgressUpdate(false, progress, 'Finished data gathering and image creation!');
        resolve(imagesToReturn);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function _mapValueToColor(value: number, min: number, max: number): number[] {
  // map the value from the range of the weather condition to the range of the color
  const colorValue = 0 + ((255 - 0) / (max - min)) * (value - min);

  // fade from white to blue using the color value
  return [255 - colorValue, 255 - colorValue, 255];
}

function getDataGatherer(dataGathererName: DataGathererName): DataGatherer {
  switch(dataGathererName) {
    case "OpenMeteo":
      return new OpenMeteoDataGatherer();
    case "BrightSky":
      return new BrightSkyDataGatherer();
    default:
      sendWeatherGenerationProgressUpdate(false, 100, 'Unknown data gatherer used!');
      throw new Error('Unknown data gatherer id');
  }
}

module.exports = {
  generateWeatherImageForLocation
};
