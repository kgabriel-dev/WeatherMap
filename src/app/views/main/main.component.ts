import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { ProgressBar, ProgressBarModule } from 'primeng/progressbar';
import { LocationService } from '../../services/location/location.service';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { Settings, SettingsService } from '../../services/settings/settings.service';
import { combineLatestWith, map } from 'rxjs';
import { MapComponent } from '../../components/map/map.component';
import { SessionService } from '../../services/session/session.service';
import { MainData } from '../../services/session/session.type';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [FormsModule, ProgressBarModule, ButtonModule, ImageModule, DropdownModule, InputNumberModule, MapComponent, TooltipModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  latestMainSessionData: MainData;
  latestWeatherDataProgress?: WeatherDataResponse;
  selectedRegionIndex: number = -1;
  usedCoordinates: SimpleLocation = {
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

  regionInDropdown = this.customLocation;
  weatherImages: { date: Date, filename: string }[] = [];

  @ViewChild('locationDropdown') locationDropdown?: Dropdown;
  @ViewChild('mapComponent') mapComponent?: MapComponent

  constructor(
    public locationsService: LocationService,
    public settingsService: SettingsService,
    public sessionService: SessionService,
    private  changeDetectorRef: ChangeDetectorRef
  ) {
    this.latestMainSessionData = this.sessionService.getLatestSessionData().mainData;
    this.sessionService.getSessionDataObservable().subscribe((sessionData) => {
      this.latestMainSessionData = sessionData.mainData;
      this.selectedRegionIndex = sessionData.mainData.selectedRegionIndex;
      this.usedCoordinates = sessionData.mainData.usedLocation;

      if(this.selectedRegionIndex !== -1) {
        const selectedRegion = this.locationsService.getLocations()[this.selectedRegionIndex];
        this.regionInDropdown = selectedRegion ? selectedRegion : this.customLocation;
      }

      // check if the used coordinates are in the list of locations and update the selected region index
      // try to find a region that matches the used coordinates
      const selectedRegion = this.locationsService.getLocations().find((location) => this.compareCoordinates(location.coordinates, sessionData.mainData.usedLocation)) || undefined;
      // if the region is found and the index is different from the current one, update the index
      if(selectedRegion !== undefined && this.selectedRegionIndex != this.locationsService.getLocations().indexOf(selectedRegion)) {
        this.selectedRegionIndex = this.locationsService.getLocations().indexOf(selectedRegion);
        this.regionInDropdown = this.locationsService.getLocations()[this.selectedRegionIndex];

        this.sessionService.updateSessionData({
          mainData: {
            ...sessionData.mainData,
            selectedRegionIndex: this.selectedRegionIndex
          }
        });
      }
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
          selectedRegionIndex: this.selectedRegionIndex,
          regionResolution: selectedLocation.region.resolution,
          regionSize: selectedLocation.region.size
        }
      });
    });

    window.weather.onWeatherGenerationProgress((inProgress: boolean, progressValue: number, progressMessage: string) => {
      this.latestWeatherDataProgress = {
        inProgress,
        progress: progressValue,
        message: progressMessage
      };

      this.changeDetectorRef.detectChanges();
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
      let selectedRegionIndex = this.locationsService.getLocations()[settings.defaultLocationIndex] ? settings.defaultLocationIndex : -1;
      let selectedRegion = this.locationsService.getLocations()[selectedRegionIndex];

      this.applyLocation(selectedRegion);

      const sessionData = this.sessionService.getLatestSessionData();
      this.sessionService.updateSessionData({
        mainData: {
          ...sessionData.mainData,
          selectedRegionIndex: selectedRegionIndex,
          regionResolution: selectedRegion ? selectedRegion.region.resolution : sessionData.mainData.regionResolution,
          regionSize: selectedRegion ? selectedRegion.region.size : sessionData.mainData.regionSize,
          forecastLength: settings.forecastLength
        }
      });
    })
  }

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

    this.updateWeatherImageOnMap();
    this.changeDetectorRef.detectChanges();
  }

  setWeatherImageIndex(value: number): void {
    const sessionData = this.sessionService.getLatestSessionData();

    if(value < 0 || value >= sessionData.mainData.numberOfWeatherImages)
      value = 0;

    this.sessionService.updateSessionData({
      mainData: {
        ...sessionData.mainData,
        currentWeatherImageIndex: value
      }
    });

    this.updateWeatherImageOnMap();
    this.changeDetectorRef.detectChanges();
  }

  pauseWeatherImageAnimation(): void {}

  applyLocation(location?: Region): void {
    const sessionData = this.sessionService.getLatestSessionData();

    if(!location) {
      const locationFromIndex = this.locationsService.getLocations()[this.selectedRegionIndex];

      location = locationFromIndex !== undefined ? locationFromIndex : {
        ...this.customLocation,
        coordinates: sessionData.mainData.usedLocation,
        region: {
          resolution: sessionData.mainData.regionResolution,
          size: sessionData.mainData.regionSize
        }
      };
    }

    this.selectedRegionIndex = this.locationsService.getLocations().indexOf(location);

    this.sessionService.updateSessionData({
      mainData: {
        ...sessionData.mainData,
        selectedRegionIndex: this.selectedRegionIndex,
        usedLocation: JSON.parse(JSON.stringify(location.coordinates)),
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
    window.weather.sendWeatherGenerationProgress(true, 0, 'Starting weather image generation');

    const sessionData = this.sessionService.getLatestSessionData();

    const region: Region = {
      id: -1,
      coordinates: sessionData.mainData.usedLocation,
      name: '',
      region: {
        resolution: sessionData.mainData.regionResolution,
        size: sessionData.mainData.regionSize
      },
      timezoneCode: this.locationsService.getLocations().find((location) => location.id === sessionData.mainData.selectedRegionIndex)?.timezoneCode || 'UTC'
    }

    const dataGathererName = sessionData.mainData.weatherDataSource;
    const weatherConditionId = sessionData.mainData.weatherCondition.id;
    const forecast_length = this.convertTimelengthToHours(sessionData.mainData.forecastLength.value, sessionData.mainData.forecastLength.unit);

    window.weather.generateWeatherImagesForRegion(region, dataGathererName, weatherConditionId, forecast_length)
      .then((images) => {

        this.sessionService.updateSessionData({
          mainData: {
            ...sessionData.mainData,
            numberOfWeatherImages: images.length
          }
        });

        this.weatherImages = images;
        this.setWeatherImageIndex(0);
        this.updateWeatherImageOnMap();
      })
      .catch((error) => {
        console.error('Error generating images:', error);
      });
  }

  updateSessionData(): void {
    const selectedRegion = this.locationsService.getLocations().find((location) => this.compareCoordinates(location.coordinates, this.usedCoordinates)) || undefined;
    this.selectedRegionIndex = selectedRegion ? this.locationsService.getLocations().indexOf(selectedRegion) : -1;

    if(this.selectedRegionIndex == -1)
      this.regionInDropdown = this.customLocation;
    else
      this.regionInDropdown = this.locationsService.getLocations()[this.selectedRegionIndex];

    this.sessionService.updateSessionData({
      mainData: {
        currentWeatherImageIndex: this.latestMainSessionData.currentWeatherImageIndex,
        numberOfWeatherImages: this.latestMainSessionData.numberOfWeatherImages,
        selectedRegionIndex: this.selectedRegionIndex,
        usedLocation: this.usedCoordinates,
        regionResolution: this.latestMainSessionData.regionResolution,
        regionSize: this.latestMainSessionData.regionSize,
        forecastLength: this.latestMainSessionData.forecastLength,
        weatherDataSource: this.latestMainSessionData.weatherDataSource,
        weatherCondition: this.latestMainSessionData.weatherCondition
      }
    })
  }

  updateWeatherImageOnMap(): void {
    let sessionData = this.sessionService.getLatestSessionData();

    if(sessionData.mainData.currentWeatherImageIndex >= sessionData.mainData.numberOfWeatherImages)
      this.setWeatherImageIndex(0);
      sessionData = this.sessionService.getLatestSessionData();

    this.mapComponent?.overlayWeatherImage(this.weatherImages[sessionData.mainData.currentWeatherImageIndex].filename);
  }

  getDataSourcesList(): string[] {
    return ['OpenMeteo', 'BrightSky'];
  }

  mapPanToLocation(): void {
    if(this.mapComponent)
      this.mapComponent.fitRegionToScreen();
  }

  private compareCoordinates(a: SimpleLocation, b: SimpleLocation): boolean {
    return a.latitude == b.latitude && a.longitude == b.longitude;
  }

  openProgressInfoWindow(): void {
    window.app.openProgressInfoWindow();
  }

  cancelWeatherImageGeneration(): void {
    window.weather.cancelWeatherImageGeneration();
  }

  getWeatherConditionsList(): WeatherCondition[] {
    if(this.latestMainSessionData.weatherDataSource == 'OpenMeteo')
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

    return [];
  }

  private convertTimelengthToHours(value: Settings['forecastLength']['value'], unit: Settings['forecastLength']['unit']): number {
    if(unit == 'hours')
      return value;

    if(unit == 'days')
      return value * 24;

    return 0;
  }
}
