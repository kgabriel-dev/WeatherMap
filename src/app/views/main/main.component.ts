import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { ProgressBar, ProgressBarModule } from 'primeng/progressbar';
import { LocationService } from '../../services/location/location.service';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { Settings, SettingsService } from '../../services/settings/settings.service';
import { combineLatestWith, debounceTime, map, Subject } from 'rxjs';
import { MapComponent } from '../../components/map/map.component';
import { SessionService } from '../../services/session/session.service';
import { MainData } from '../../services/session/session.type';
import { TooltipModule } from 'primeng/tooltip';
import { getTimeZones, TimeZone } from '@vvo/tzdb';
import { TimezoneList } from '../settings/settings.component';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [FormsModule, ProgressBarModule, ButtonModule, ImageModule, DropdownModule, InputNumberModule, MapComponent, TooltipModule, CheckboxModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  readonly localizedTexts = {
    mapPanToLocationTooltip: $localize`Click to center the map on the selected location.`,
    selectionHours : $localize`@@hours:hours`,
    selectionDays : $localize`@@days:days`,
    useOverriddenTimezoneLabel: $localize`Override location's timezone`,
    buttonGenerateImages: $localize`Generate Images`,
    buttonCancelImgGeneration: $localize`Cancel`,
    buttonGenerationProgressInfo: $localize`Info`
  }

  lastReadMainSessionData: MainData;
  mainSessionDataForUpdate: MainData;
  latestWeatherDataProgress?: WeatherDataResponse;
  selectedRegionIndex: number = -1;
  usedCoordinates: SimpleLocation = {
    latitude: 0,
    longitude: 0
  }

  lastWeatherGatheringTime: Date = new Date();

  imageAnimationInterval: number | undefined;

  updateSessionDebounce$ = new Subject<void>();

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

  weatherConditions: WeatherCondition[] = [];

  timezoneList = this.buildTimezoneList();

  initialDataReceived = false;

  disableLocationDropdown = false;

  @ViewChild('locationDropdown') locationDropdown?: Dropdown;
  @ViewChild('mapComponent') mapComponent?: MapComponent

  constructor(
    public locationsService: LocationService,
    public settingsService: SettingsService,
    public sessionService: SessionService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    window.app.sendTranslations(this.getTranslations());

    settingsService.isServiceReady().subscribe((isReady) => {
      if(!isReady) return;

      const settings = settingsService.getSettings();

      window.app.getLocale()
        .then((currentLocale) => {
          if(currentLocale !== settings.languageCode) {
            window.app.setLocale(settings.languageCode);
          }
        })
    });

    this.lastReadMainSessionData = this.sessionService.getLatestSessionData().mainData;
    this.mainSessionDataForUpdate = this.sessionService.getLatestSessionData().mainData;

    this.sessionService.getSessionDataObservable().subscribe((sessionData) => {
      const oldMainSessionData = JSON.parse(JSON.stringify(this.lastReadMainSessionData));
      this.lastReadMainSessionData = JSON.parse(JSON.stringify(sessionData.mainData));
      this.mainSessionDataForUpdate = JSON.parse(JSON.stringify(sessionData.mainData));
      this.selectedRegionIndex = this.mainSessionDataForUpdate.selectedRegionIndex;
      this.usedCoordinates = this.mainSessionDataForUpdate.usedLocation;

      if(this.selectedRegionIndex > -1) {
        const selectedRegion = this.locationsService.getLocations()[this.selectedRegionIndex];
        this.regionInDropdown = selectedRegion ? selectedRegion : this.customLocation;
      } else {
        this.regionInDropdown = this.customLocation;
      }

      // enforce the use of the overridden timezone if the selected region is the custom location
      // also only do this if this was not the initial setup
      if(this.initialDataReceived && this.selectedRegionIndex === -1 && !this.mainSessionDataForUpdate.useOverriddenTimezone) {
        this.mainSessionDataForUpdate.useOverriddenTimezone = true;
        this.updateSessionData();
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

      this.updateWeatherConditionsList(oldMainSessionData.weatherDataSource, oldMainSessionData.weatherCondition);

      // update the override timezone to the selected region's timezone if the dropdown is disabled
      // used to show the current timezone so the user can decide if they want to override it
      if(this.initialDataReceived && !this.lastReadMainSessionData.useOverriddenTimezone && this.lastReadMainSessionData.overriddenTimezoneCode !== this.regionInDropdown.timezoneCode) {
        this.mainSessionDataForUpdate.overriddenTimezoneCode = this.regionInDropdown.timezoneCode;
        this.updateSessionData();
      }

      this.initialDataReceived = true;
    });

    this.customLocation.coordinates = this.mainSessionDataForUpdate.usedLocation;
    this.customLocation.region = {
      resolution: this.mainSessionDataForUpdate.regionResolution,
      size: this.mainSessionDataForUpdate.regionSize
    }

    this.updateWeatherConditionsList();

    window.app.onSettingsModalClosed(() => {
      this.disableLocationDropdown = true;

      this.locationsService.rereadLocationsFile()
        .then(() => {
          const settings = this.settingsService.getSettings();
          let selectedLocation = this.locationsService.getLocations()[settings.defaultLocationIndex];

          if(!selectedLocation)
            selectedLocation = this.customLocation;

          this.applyLocation(selectedLocation);

          this.disableLocationDropdown = false;
          this.mapComponent?.createMarkers();

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
        })
        .catch((error) => {
          throw Error('Error rereading locations file: ' + error);
        });


        // re-read the settings
        this.settingsService.rereadSettingsFile()
          .then(() => {
            // update the locale if it has changed
            window.app.getLocale()
            .then((currentLocale) => {
              const newLocale = this.settingsService.getSettings().languageCode;

              if(currentLocale !== newLocale) {
                window.app.setLocale(newLocale);
              }
            })
            .catch((error) => {
              console.error('Error getting locale:', error);
            });
          })
          .catch((error) => {
            console.error('Error re-reading settings file:', error);
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

      this.setInitialWeatherCondition()
        .then((weatherCondition) => {
          this.sessionService.updateSessionData({
            mainData: {
              ...sessionData.mainData,
              selectedRegionIndex: selectedRegionIndex,
              regionResolution: selectedRegion ? selectedRegion.region.resolution : sessionData.mainData.regionResolution,
              regionSize: selectedRegion ? selectedRegion.region.size : sessionData.mainData.regionSize,
              forecastLength: settings.forecastLength,
              weatherCondition
            }
          });
        })
        .catch((error) => {
          console.error('Error setting initial weather condition:', error);

          this.sessionService.updateSessionData({
            mainData: {
              ...sessionData.mainData,
              selectedRegionIndex: selectedRegionIndex,
              regionResolution: selectedRegion ? selectedRegion.region.resolution : sessionData.mainData.regionResolution,
              regionSize: selectedRegion ? selectedRegion.region.size : sessionData.mainData.regionSize,
              forecastLength: settings.forecastLength
            }
          });
        });
    })

    this.updateSessionDebounce$
      .pipe(debounceTime(300))
      .subscribe(() => this.updateSessionData());
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

  toggleWeatherImageAnimation(): void {
    if(this.imageAnimationInterval) {
      clearInterval(this.imageAnimationInterval);
      this.imageAnimationInterval = undefined;
    } else {
      this.imageAnimationInterval = window.setInterval(() => {
        this.changeWeatherImageIndex(1);
      }, 2000);
      this.changeWeatherImageIndex(1);
    }

    // detect changes to update the button icon
    this.changeDetectorRef.detectChanges();
  }

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
      timezoneCode: sessionData.mainData.useOverriddenTimezone ?
        sessionData.mainData.overriddenTimezoneCode :   // use the overridden timezone if it is enabled, otherwise use the timezone of the selected region (fallback to overridden timezone)
        this.locationsService.getLocations().find((_location, index) => index === sessionData.mainData.selectedRegionIndex)?.timezoneCode || sessionData.mainData.overriddenTimezoneCode
    }

    const dataGathererName = sessionData.mainData.weatherDataSource;
    const weatherConditionId = sessionData.mainData.weatherCondition?.id;

    if(!weatherConditionId) {
      console.error('No weather condition selected!');
      return;
    }

    const forecast_length = this.convertTimelengthToHours(sessionData.mainData.forecastLength.value, sessionData.mainData.forecastLength.unit);

    window.weather.generateWeatherImagesForRegion(region, dataGathererName, weatherConditionId, forecast_length, this.settingsService.getSettings().labeledImages)
      .then((images) => {
        const sessionData = this.sessionService.getLatestSessionData();

        this.sessionService.updateSessionData({
          mainData: {
            ...sessionData.mainData,
            numberOfWeatherImages: images.length
          }
        });

        this.lastWeatherGatheringTime = new Date();
        this.lastWeatherGatheringTime.setMinutes(0, 0, 0);

        this.weatherImages = images;
        this.setWeatherImageIndex(0);
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
        ...this.mainSessionDataForUpdate,
        selectedRegionIndex: this.selectedRegionIndex,
        usedLocation: this.usedCoordinates
      }
    });
  }

  debouncedUpdateSessionData() {
    this.updateSessionDebounce$.next();
  }

  updateWeatherImageOnMap(): void {
    let sessionData = this.sessionService.getLatestSessionData();

    if(sessionData.mainData.currentWeatherImageIndex >= sessionData.mainData.numberOfWeatherImages)
      this.setWeatherImageIndex(0);
      sessionData = this.sessionService.getLatestSessionData();

    // update the weather image on the map and fit region to screen (except when the image is being animated)
    this.mapComponent?.overlayWeatherImage(this.weatherImages[sessionData.mainData.currentWeatherImageIndex].filename, false);
    this.mapComponent?.updateDataInfo(this.lastWeatherGatheringTime);
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

  private updateWeatherConditionsList(oldDataGathererName?: DataGathererName, oldWeatherCondition?: WeatherCondition): void {
    window.weather.listWeatherConditions()
      .then((conditions) => {
        if(!conditions[this.lastReadMainSessionData.weatherDataSource]) {
          console.error('No weather conditions found for the selected data source:', this.lastReadMainSessionData.weatherDataSource);

          this.weatherConditions = [];
          this.changeDetectorRef.detectChanges();

          return;
        }

        this.weatherConditions = conditions[this.lastReadMainSessionData.weatherDataSource];

        // try to select the same weather condition as before just for the new data source; only if the data source has changed
        if(oldDataGathererName && oldDataGathererName !== this.lastReadMainSessionData.weatherDataSource && oldWeatherCondition) {
          const newWeatherCondition = this.weatherConditions.find((condition) => condition.id == oldWeatherCondition.id);

          if(newWeatherCondition) {
            this.sessionService.updateSessionData({
              mainData: {
                ...this.mainSessionDataForUpdate,
                weatherCondition: newWeatherCondition
              }
            });
          } else {
            this.sessionService.updateSessionData({
              mainData: {
                ...this.mainSessionDataForUpdate,
                weatherCondition: this.weatherConditions[0]
              }
            });
          }
        }

        this.changeDetectorRef.detectChanges();
      })
      .catch((error) => {
        console.error('Error getting weather conditions:', error);
        this.weatherConditions = [];
        this.changeDetectorRef.detectChanges();
      });
  }

  private setInitialWeatherCondition(): Promise<WeatherCondition> {
    return new Promise((resolve, reject) => {
      window.weather.listWeatherConditions()
        .then((conditions) => {
          if(!conditions[this.lastReadMainSessionData.weatherDataSource]) {
            console.error('No weather conditions found for the selected data source:', this.lastReadMainSessionData.weatherDataSource);

            this.weatherConditions = [];
            this.changeDetectorRef.detectChanges();

            reject('No weather conditions found for the selected data source');
            return;
          }

          this.weatherConditions = conditions[this.lastReadMainSessionData.weatherDataSource];

          if(!this.lastReadMainSessionData.weatherCondition) {
            this.sessionService.updateSessionData({
              mainData: {
                ...this.mainSessionDataForUpdate,
                weatherCondition: this.weatherConditions[0]
              }
            });
          }

          resolve(this.weatherConditions[0]);
        })
        .catch((error) => {
          console.error('Error getting weather conditions:', error);
          this.weatherConditions = [];
          this.changeDetectorRef.detectChanges();

          reject(error);
        });
    });
  }

  private convertTimelengthToHours(value: Settings['forecastLength']['value'], unit: Settings['forecastLength']['unit']): number {
    if(unit == 'hours')
      return value;

    if(unit == 'days')
      return value * 24;

    return 0;
  }

  private buildTimezoneList(): TimezoneList {
    const timezoneGroups: { label: string, timezones: TimeZone[] }[] = [];
    getTimeZones().forEach(timezone => {
      const continent = timezone.continentName

      let continentGroup = timezoneGroups.find(group => group.label === continent);

      if (!continentGroup) {
        continentGroup = { label: continent, timezones: [] };
        timezoneGroups.push(continentGroup);
      }

      continentGroup.timezones.push(timezone);
    });

    return timezoneGroups.map(group => ({
      label: group.label,
      value: group.label,
      items: group.timezones
    }));
  }

  // translate the texts from the electron main process here so the translation is done in the Angular locale files
  // this is necessary because the translation files are not available in the main process
  getTranslations(): { [key: string]: string } {
    return {
      imageGenerationCanceledByUser: $localize`Image generation canceled by user`,
      menuLearnMore: $localize`Learn more`,
      menuAbout: $localize`About`,
      menuDevTools: $localize`Developer Tools`,
      menuOpenSettings: $localize`Open Settings`,
      menuSettingsTitle: $localize`Settings`,
      menuWindowTitle: $localize`Window`,
      menuHelpTitle: $localize`Help`,
      menuMinimizeWindow: $localize`Minimize`,
      menuCloseWindow: $localize`Close`,
      imgGenerationDelOldImages: $localize`Deleting the old weather images`,
      canceledByUser: $localize`Canceled by the user`,
      imgGenerationDataGatheringFinished: $localize`Data gathering finished. Converting the data now.`,
      imgGenerationStartingCreationImageIndex: $localize`Starting creation of image $index$.`,
      imgGenerationFinished: $localize`Finished creating the weather images.`,
      imgGenerationUnknownDataGatherer: $localize`Unknown data gatherer: $dataGathererName$`,
      dataGatheringIndexSuccess: $localize`Request for location #$index$ succeeded.`,
      dataGatheringIndexFailed: $localize`Request for location #$index$ failed.`,
      dataGathererCategoryTempC: $localize`Temperature (°C)`,
      dataGathererCategoryCloudCover: $localize`Cloud Coverage (%)`,
      dataGathererCategoryRelHumidity: $localize`Relative Humidity (%)`,
      dataGathererCategoryCloudsLow: $localize`Cloud Coverage Low (%)`,
      dataGathererCategoryCloudsMid: $localize`Cloud Coverage Mid (%)`,
      dataGathererCategoryCloudsHigh: $localize`Cloud Coverage High (%)`,
      dataGathererCategoryDewPointC: $localize`Dew Point (°C)`,
      dataGathererCategoryAirPressure: $localize`Air Pressure (hPa)`,
      dataGathererCategoryPrecipitation: $localize`Precipitation (mm)`,
      dataGathererCategoryPrecipitationProbability: $localize`Precipitation Probability (%)`,
      dataGathererCategoryVisibility: $localize`Visibility (m)`,
      dataGathererCategoryUvIndex: $localize`UV Index`,
      dataGathererCategoryWindSpeed: $localize`Wind Speed (km/h)`,
    }
  }
}
