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
    public sessionService: SessionService
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
    const sessionData = this.sessionService.getLatestSessionData();

    const region: Region = {
      id: -1,
      coordinates: sessionData.mainData.usedLocation,
      name: '',
      region: {
        resolution: sessionData.mainData.regionResolution,
        size: sessionData.mainData.regionSize
      },
      timezoneCode: this.settingsService.getSettings().timezoneCode
    }
    const dataGathererName: DataGathererName = "OpenMeteo";
    const weatherConditionId = "temperature_c";
    const forecast_length = 12;

    window.weather.generateWeatherImagesForRegion(region, dataGathererName, weatherConditionId, forecast_length)
      .then((images) => {
        console.log('Images generated:', images);

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
    console.log('Selected region index:', this.selectedRegionIndex, 'Used coordinates:', this.usedCoordinates);

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
        weatherDataSource: this.latestMainSessionData.weatherDataSource
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
}
