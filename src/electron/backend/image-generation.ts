import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { OpenMeteoDataGatherer, BrightSkyDataGatherer } from "./data-gathering.js";
import { app, ipcMain } from 'electron';
import { sendWeatherGenerationProgressUpdate } from "../utils.js";
import { Region, SimpleLocation } from "../../types/location";
import { DataGathererName, DataGatherer, WeatherCondition } from "../../types/weather-data";
import * as fs from 'fs';
import path from "path";

let cancelRequested = false;
const imagePixelSize = 512;

GlobalFonts.registerFromPath(path.join(app.getPath("userData"), "Poppins-Regular.ttf"), 'Poppins');

ipcMain.on('cancel-weather-image-generation', (_event) => cancelRequested = true);

function generateWeatherImageForLocation(region: Region, dataGathererName: DataGathererName, weatherConditionId: string, forecast_length: number, valueLabels: boolean, translations: {[key: string]: string}): Promise<{ date: string, filename: string }[]> {
  const dataGatherer: DataGatherer = getDataGatherer(dataGathererName, translations);

  return new Promise((resolve, reject) => {
    const weatherCondition = dataGatherer.listAvailableWeatherConditions(translations).find((condition: WeatherCondition) => condition.id === weatherConditionId);

    if(!weatherCondition) {
      reject('Unknown weather condition id');
      return;
    }

    let progress = 0;
    sendWeatherGenerationProgressUpdate(true, progress, translations["imgGenerationDelOldImages"]);
    // check if the WeatherMap dir in the temp dir exists, if not create it
    // and if it exists, delete all files in it
    const dir = `${app.getPath('temp')}/WeatherMap`;
    if(!fs.existsSync(dir))
      fs.mkdirSync(dir);
    else
      fs.readdirSync(dir).forEach((file) => fs.unlinkSync(`${dir}/${file}`));

    if(cancelRequested) {
      sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
      reject('Cancelled by user.');
      cancelRequested = false;
    }

    // calculate the progress for the data gathering
    const numberOfLocations = region.region.resolution * region.region.resolution;
    const numberOfImages = forecast_length;
    const progressPerStep = 100 / (numberOfLocations + numberOfImages + 2); // how much progress is made per step (location or image); +2 for "finished data gathering"-message and for the final step

    // gather the data for the location
    dataGatherer.gatherData(region, weatherCondition, forecast_length, progressPerStep, translations)
      .then((weatherData) => {
        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        progress += progressPerStep * numberOfLocations + progressPerStep;
        sendWeatherGenerationProgressUpdate(true, progress, translations["imgGenerationDataGatheringFinished"]);

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
          sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        // gather all coordinates
        const allCoordinates = weatherData.map((data) => data.coordinates).filter((value, index, self) => self.indexOf(value) === index);


        if(cancelRequested) {
          sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
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
          sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
          reject('Cancelled by user.');
          cancelRequested = false;
        }

        // sort the grid coordinates by latitude and longitude (most northern and western first)
        gridCoordinates.sort((row1, row2) => row2[0].latitude - row1[0].latitude);
        gridCoordinates.forEach((row) => row.sort((coord1, coord2) => coord1.longitude - coord2.longitude));

        const maxWeatherValue = weatherCondition.max == -1 ? Math.max(...weatherData.map((data) => data.weatherValue)) : weatherCondition.max;
        const minWeatherValue = weatherCondition.min == -1 ? Math.min(...weatherData.map((data) => data.weatherValue)) : weatherCondition.min;

        // create the raster images
        for(let timeIndex = 0; timeIndex < timeList.length; timeIndex++) {
          if(cancelRequested) {
            sendWeatherGenerationProgressUpdate(false, 100, translations["canceledByUser"]);
            reject('Cancelled by user.');
            cancelRequested = false;
          }

          const canvas = createCanvas(region.region.resolution * imagePixelSize, region.region.resolution * imagePixelSize);
          const context = canvas.getContext('2d', { alpha: true });

          if(!context) {
            reject('Failed to create image context');
          }

          progress += progressPerStep;
          sendWeatherGenerationProgressUpdate(true, progress, translations["imgGenerationStartingCreationImageIndex"].replace('$index$', (timeIndex + 1).toString()));

            // create the image square by square starting from the most northern and western coordinate
            gridCoordinates.forEach((row, rowIndex) => {
              row.forEach((coordinate, columnIndex) => {
                const weatherData = weatherDataOverTime[timeIndex]?.find((data) => data.location.latitude === coordinate.latitude && data.location.longitude === coordinate.longitude) || null;

                let color: number[]; // color to draw the square with
                if(!weatherData || weatherData.error) {
                  color = [255, 255, 255, 255]; // no data or error -> no visible square
                } else {
                  color = _mapValueToColor(weatherData.weatherValue, minWeatherValue, maxWeatherValue);
                }

                context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
                context.fillRect(columnIndex * imagePixelSize, rowIndex * imagePixelSize, imagePixelSize, imagePixelSize); // draw squares that are imagePixelSize x imagePixelSize pixels

                if(valueLabels) {
                  let value: string; // value to draw in the square as a label
                  if(!weatherData || weatherData.error) {
                    value = 'N/A'; // no data or error -> no visible square
                  } else {
                    value = weatherData.weatherValue.toString() + (weatherCondition.unit == '%' ? '' : ' ') + weatherCondition.unit;
                  }

                  context.fillStyle = 'rgba(0, 0, 0, 255)';
                  context.font = `${imagePixelSize / 8}px Poppins`;
                  context.textAlign = 'center';
                  context.textBaseline = 'middle';
                  context.fillText(value, columnIndex * imagePixelSize + imagePixelSize / 2, rowIndex * imagePixelSize + imagePixelSize / 2, imagePixelSize); // add labels to the squares
                }
              })
            });

            // save the image to a file in the temp directory
            const buffer = canvas.encodeSync('png');
            const filename = `${app.getPath('temp')}/WeatherMap/weather_image_${timeIndex}.png`;

            try {
              fs.writeFileSync(filename, buffer);
              imagesToReturn.push({date: timeList[timeIndex], filename: filename});
            } catch (error) {
              console.error('Failed to write file', error);
            }
        }

        progress = 100;
        sendWeatherGenerationProgressUpdate(false, progress, translations["imgGenerationFinished"]);
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

function getDataGatherer(dataGathererName: DataGathererName, translations: {[key: string]: string}): DataGatherer {
  switch(dataGathererName) {
    case "OpenMeteo":
      return new OpenMeteoDataGatherer();
    case "BrightSky":
      return new BrightSkyDataGatherer();
    default:
      sendWeatherGenerationProgressUpdate(false, 100, translations["imgGenerationUnknownDataGatherer"].replace('$dataGathererName$', dataGathererName));
      throw new Error('Unknown data gatherer id');
  }
}

export { generateWeatherImageForLocation };
