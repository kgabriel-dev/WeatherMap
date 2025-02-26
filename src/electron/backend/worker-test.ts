import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { OpenMeteoDataGatherer, BrightSkyDataGatherer } from "./data-gathering.js";
import { app, ipcMain } from 'electron';
import { sendWeatherGenerationProgressUpdate } from "../utils.js";
import { Region, SimpleLocation } from "../../types/location.js";
import { DataGathererName, DataGatherer, WeatherCondition } from "../../types/weather-data.js";
import * as fs from 'fs';
import path from "node:path";
import { parentPort, workerData, isMainThread, Worker } from "worker_threads";

if (!isMainThread) {
    parentPort!.postMessage(workerData);
    // const dataGatherer: DataGatherer = getDataGatherer(workerData.dataGathererName, workerData.translations);
    printTest();
}

function printTest() {
    return new OpenMeteoDataGatherer();
}

// function getDataGatherer(dataGathererName: DataGathererName, translations: {[key: string]: string}): DataGatherer {
//     // switch(dataGathererName) {
//     //   case "OpenMeteo":
//     //     return new OpenMeteoDataGatherer();
//     //   case "BrightSky":
//     //     return new BrightSkyDataGatherer();
//     //   default:
//     //     // sendWeatherGenerationProgressUpdate(false, 100, translations["imgGenerationUnknownDataGatherer"].replace('$dataGathererName$', dataGathererName));
//     //     throw new Error('Unknown data gatherer id');
//     // }

//     return new OpenMeteoDataGatherer();
//   }