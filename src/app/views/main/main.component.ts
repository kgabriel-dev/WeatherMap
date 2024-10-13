import { Component, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { ProgressBarModule } from 'primeng/progressbar';
import { LocationService } from '../../services/location/location.service';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SettingsService } from '../../services/settings/settings.service';
import { combineLatestWith, map } from 'rxjs';
import { MapComponent } from '../../components/map/map.component';
import { SessionService } from '../../services/session/session.service';
import { MainData } from '../../services/session/session.type';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [FormsModule, ProgressBarModule, ButtonModule, ImageModule, DropdownModule, InputNumberModule, MapComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  readonly filePath = 'D:\\Programmieren\\Electron\\WeatherMap\\image_0.png';

  latestMainSessionData: MainData;
  selectedRegion: Region | undefined;
  usedLocation: SimpleLocation = {
    latitude: 0,
    longitude: 0
  }

  readonly customLocation: Region = {
    id: -1,
    coordinates: {
      latitude: 0,
      longitude: 0
    },
    name: 'Custom Location',
    region: {
      resolution: 0,
      size: {
        length: 0,
        unit: 'km'
      }
    },
    timezoneCode: 'UTC'
  }

  @ViewChild('locationDropdown') locationDropdown?: Dropdown;

  constructor(
    public locationsService: LocationService,
    public settingsService: SettingsService,
    public sessionService: SessionService
  ) {
    this.latestMainSessionData = this.sessionService.getLatestSessionData().mainData;
    this.sessionService.getSessionDataObservable().subscribe((sessionData) => {
      this.latestMainSessionData = sessionData.mainData;
    });

    this.customLocation.coordinates = this.latestMainSessionData.usedLocation;
    this.customLocation.region = {
      resolution: this.latestMainSessionData.regionResolution,
      size: this.latestMainSessionData.regionSize
    }

    window.app.onSettingsModalClosed(() => {
      const settings = this.settingsService.getSettings();
      let selectedLocation = this.locationsService.getLocations()[settings.defaultLocationIndex];

      if(!selectedLocation)
        selectedLocation = this.customLocation;

      this.applyLocation(selectedLocation);

      if(this.locationDropdown)
        this.locationDropdown.focus(); // this triggers the update of the label to the selected location

      const sessionData = this.sessionService.getLatestSessionData();
      this.sessionService.updateSessionData({
        mainData: {
          ...sessionData.mainData,
          selectedRegion: selectedLocation,
          regionResolution: selectedLocation.region.resolution,
          regionSize: selectedLocation.region.size
        }
      });
    });

    // set the default location to the one saved in the settings
    // --> first create an observable that combines the location file read and the settings file read
    const combinedReadiness$ = this.locationsService.isServiceReady().pipe(
      combineLatestWith(this.settingsService.isServiceReady()),
      map(([isLocationReady, isSettingsReady]) => isLocationReady && isSettingsReady)
    );
    // --> subscribe to the observable
    combinedReadiness$.subscribe((isReady: boolean) => {
      if(!isReady) return; // wait until both files are read

      const settings = this.settingsService.getSettings();
      let selectedLocation = this.locationsService.getLocations()[settings.defaultLocationIndex];

      if(!selectedLocation)
        selectedLocation = this.customLocation;

      this.applyLocation();

      const sessionData = this.sessionService.getLatestSessionData();
      this.sessionService.updateSessionData({
        mainData: {
          ...sessionData.mainData,
          selectedRegion: selectedLocation,
          regionResolution: selectedLocation.region.resolution,
          regionSize: selectedLocation.region.size
        }
      });
    })
  }

  ngOnInit(): void { }

  changeWeatherImageIndex(amount: number): void {
    const sessionData = this.sessionService.getLatestSessionData();

    let currentWeatherImageIndex = sessionData.mainData.currentWeatherImageIndex + amount;

    if(currentWeatherImageIndex >= sessionData.mainData.numberOfWeatherImages)
      currentWeatherImageIndex = sessionData.mainData.numberOfWeatherImages - currentWeatherImageIndex

    else if(currentWeatherImageIndex < 0)
      currentWeatherImageIndex = sessionData.mainData.numberOfWeatherImages + currentWeatherImageIndex

    if(currentWeatherImageIndex < 0 || currentWeatherImageIndex >= sessionData.mainData.numberOfWeatherImages)
      currentWeatherImageIndex = 0;

    this.sessionService.updateSessionData({
      mainData: {
        ...sessionData.mainData,
        currentWeatherImageIndex
      }
    });
  }

  pauseWeatherImageAnimation(): void {}

  applyLocation(location?: Region): void {
    const sessionData = this.sessionService.getLatestSessionData();
    location = location || sessionData.mainData.selectedRegion || this.customLocation;

    if(!location)
      return;

    this.sessionService.updateSessionData({
      mainData: {
        ...sessionData.mainData,
        selectedRegion: location,
        regionResolution: location.region.resolution,
        regionSize: location.region.size
      }
    });
  }

  getLocationsList(): Region[] {
    return [
      ...this.locationsService.getLocations(),
      this.customLocation
    ];
  }

  startWeatherImageGeneration(): void {
    const sessionData = this.sessionService.getLatestSessionData();

    const region = sessionData.mainData.selectedRegion || this.customLocation;
    const dataGathererName: DataGathererName = "OpenMeteo";
    const weatherConditionId = "temperature_c";
    const forecast_length = 12;

    window.weather.generateWeatherImagesForRegion(region, dataGathererName, weatherConditionId, forecast_length)
      .then((images) => {
        console.log('Images generated:', images);
      })
      .catch((error) => {
        console.error('Error generating images:', error);
      });
  }

  updateSessionData(): void {
    this.sessionService.updateSessionData({
      mainData: {
        currentWeatherImageIndex: this.latestMainSessionData.currentWeatherImageIndex,
        numberOfWeatherImages: this.latestMainSessionData.numberOfWeatherImages,
        selectedRegion: this.selectedRegion,
        usedLocation: this.usedLocation,
        regionResolution: this.latestMainSessionData.regionResolution,
        regionSize: this.latestMainSessionData.regionSize,
        forecastLength: this.latestMainSessionData.forecastLength,
        weatherDataSource: this.latestMainSessionData.weatherDataSource
      }
    })
  }

  getDataSourcesList(): string[] {
    return ['OpenMeteo', 'BrightSky'];
  }
}
