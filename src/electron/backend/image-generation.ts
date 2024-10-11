import { Region } from "../../app/services/location/location.type";
import { DataGatherer, WeatherCondition } from "./weather-data.type";

function generateWeatherImageForLocation(location: Region, dataGatherer: DataGatherer, weatherCondition: WeatherCondition, forecast_length: number): void {
  // gather the data for the location
  dataGatherer.gatherData(location, weatherCondition, forecast_length)
    .then((weatherData) => {

    })
    .catch((error) => {
      console.error('Error gathering data!', error);
    });


}
