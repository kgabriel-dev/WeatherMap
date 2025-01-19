import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message, SelectItemGroup } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { Settings, SettingsService, SizeUnits, SizeUnitStrings, TimeUnits, TimeUnitStrings } from '../../services/settings/settings.service';
import { LocationService } from '../../services/location/location.service';
import { ListboxModule } from 'primeng/listbox';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
import { getTimeZones, TimeZone } from '@vvo/tzdb';
import { Region, RegionAddingData } from '../../../types/location';
import { WeatherCondition } from '../../../types/weather-data';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    TabViewModule,
    DropdownModule,
    InputNumberModule,
    CheckboxModule,
    DividerModule,
    ButtonModule,
    ListboxModule,
    InputTextModule,
    ProgressSpinnerModule,
    MessagesModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  readonly localizedTexts = {
    titleGeneralSettings: $localize`General`,
    titleLocationSettings: $localize`Locations`,
    titleUpdateSettings: $localize`Updates`,
    buttonAddLocation: $localize`Add Location`,
    buttonSaveLocation: $localize`Save`,
    buttonDeleteLocation: $localize`Delete`,
    buttonDiscardLocation: $localize`Discard`,
    buttonCheckForUpdates: $localize`Check for Updates`,
  }

  forecastLengthOptions = TimeUnitStrings;
  regionSizeOptions = SizeUnitStrings;

  // variables for the selected timezone
  readonly timezoneList = this.buildTimezoneList();

  // TODO: Read the values directly from the data gatherers
  // variables for the selected data source
  dataSources: SelectItemGroup[] = [];
  readonly dataSourceIcons: {[key: string]: string} = {
    'OpenMeteo': 'assets/openmeteo-favicon.png',
    'BrightSky': 'assets/brightsky-favicon.svg'
  }
  selectedDataSource: string = '';

  // variables for the selected language
  languages: {label: string; key: string; flag: string}[] = [
    {
      label: 'English (USA)',
      key: 'en-US',
      flag: 'us'
    },
    {
      label: 'Deutsch (Deutschland)',
      key: 'de-DE',
      flag: 'de'
    }
  ]
  selectedLanguageKey: string = this.languages[0].key;

  // other variables
  forecastLength: Settings['forecastLength'] = {
    value: 12,
    unitId: TimeUnits.HOURS
  }
  updateCheck: boolean = true;
  labeledImages: boolean = true;
  workingLocation?: Region;
  locationLoadingMessages: Message[] = [];
  locationsAlreadyLoaded: boolean = false;
  locationsList: Region[] = [];

  constructor(
    public settingsService: SettingsService,
    public locationsService: LocationService
  ) {
    this.getWeatherDataSources();

    // load and set the initial settings
    settingsService.getSettingsChangedObservable().subscribe((settings) => {
      this.selectedDataSource = settings.weatherCondition;
      this.selectedLanguageKey = settings.languageCode;
      this.forecastLength = settings.forecastLength
      this.updateCheck = settings.updateCheck;
      this.labeledImages = settings.labeledImages;
    });

    // display a message while loading the locations file
    this.locationLoadingMessages = [{
      severity: 'info',
      summary: $localize`Loading locations...`,
      detail: $localize`Please wait a moment.`
    }];

    // load the locations file
    locationsService.isServiceReady().subscribe((fileRead: boolean) => {
      if (!fileRead) return;

      this.locationsList = this.locationsService.getLocations();
      this.setWorkingLocation(this.settingsService.getSettings().defaultLocationIndex);
      this.locationLoadingMessages = [];
      this.locationsAlreadyLoaded = true;
    });

    // wait 3 seconds and then warn that loading locations is taking longer
    setTimeout(() => {
      if(this.locationsAlreadyLoaded) return;

      this.locationLoadingMessages = [{
        severity:'warn',
        summary: $localize`Loading locations...`,
        detail: $localize`This is taking longer than expected. Please wait a moment.`
      }]
    }, 3000);
  }

  saveSettings() {
    this.settingsService.setSettings({
      weatherCondition: this.selectedDataSource,
      languageCode: this.selectedLanguageKey,
      forecastLength: this.forecastLength,
      updateCheck: this.updateCheck,
      labeledImages: this.labeledImages
    });

    this.settingsService.saveSettings();
  }

  saveAndClose(): void {
    this.saveSettings();
    this.closeWindow();
  }

  closeWindow(): void {
    window.app.closeSettings();
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

  getLanguageFromKey(key: string): {label: string; key: string; flag: string} {
    return this.languages.find(language => language.key === key) || this.languages[0];
  }

  getTimeZoneByCode(code: string): TimeZone {
    return this.timezoneList
      .flatMap(group => group.items)
      .find(timezone => timezone.abbreviation === code) || this.timezoneList[0].items[0];
  }

  // TODO: Rewrite this function to use the location's index instead of the location's id
  setWorkingLocation(locationId: number) {
    if(this.locationsList.length === 0) {
      return;
    }

    // make a copy of the location to avoid changing the original
    this.workingLocation = JSON.parse(
      JSON.stringify(
        this.locationsList.find(location => location.id === locationId) || this.locationsList[0]
      )
    );
  }

  saveWorkingLocation() {
    if (!this.workingLocation) return;

    this.locationsService.updateLocation(this.workingLocation);
    this.locationsList = this.locationsService.getLocations();
  }

  deleteWorkingLocation() {
    if (!this.workingLocation) return;

    this.locationsService.removeLocation(this.workingLocation.id);
    this.locationsList = this.locationsService.getLocations();

    this.workingLocation = this.locationsList[0] || undefined;
  }

  addInitialLocation() {
    const listOfLocations: RegionAddingData[] = [
      { name: 'Rostock', coordinates: { latitude: 54.10352, longitude: 12.10480 }, region: { size: { length: 100, unitId: SizeUnits.KILOMETERS }, resolution: 6 }, timezoneCode: 'Europe/Berlin' },
      { name: 'New York City', coordinates: { latitude: 40.73164, longitude: -74.00166 }, region: { size: { length: 90, unitId: SizeUnits.MILES }, resolution: 7}, timezoneCode: 'America/New_York' },
      { name: 'Madrid', coordinates: { latitude: 40.43684, longitude: -3.65193 }, region: { size: { length: 80, unitId: SizeUnits.KILOMETERS }, resolution: 4 }, timezoneCode: 'Europe/Madrid' },
      { name: 'Sydney', coordinates: { latitude: -33.86708, longitude: 151.24548 }, region: { size: { length: 150, unitId: SizeUnits.KILOMETERS }, resolution: 10 }, timezoneCode: 'Australia/Sydney' },
      { name: 'Tokyo', coordinates: { latitude: 35.68267, longitude: 139.77254 }, region: { size: { length: 100, unitId: SizeUnits.KILOMETERS }, resolution: 6 }, timezoneCode: 'Asia/Tokyo' },
      { name: 'Shanghai', coordinates: { latitude: 31.25484, longitude: 121.48382 }, region: { size: { length: 75, unitId: SizeUnits.KILOMETERS }, resolution: 3}, timezoneCode: 'Asia/Shanghai' },
      { name: 'New Delhi', coordinates: { latitude: 28.68422, longitude: 77.15038 }, region: { size: { length: 100, unitId: SizeUnits.KILOMETERS }, resolution: 6 }, timezoneCode: 'Asia/Kolkata' },
      { name: 'Cape Town', coordinates: { latitude: -33.91886, longitude: 18.42330 }, region: { size: { length: 60, unitId: SizeUnits.KILOMETERS }, resolution: 4 }, timezoneCode: 'Africa/Johannesburg' },
      { name: 'São Paulo', coordinates: { latitude: -23.55052, longitude: -46.63331 }, region: { size: { length: 80, unitId: SizeUnits.KILOMETERS }, resolution: 5 }, timezoneCode: 'America/Sao_Paulo' },
      { name: 'Mexico City', coordinates: { latitude: 19.43260, longitude: -99.13321 }, region: { size: { length: 90, unitId: SizeUnits.KILOMETERS }, resolution: 5 }, timezoneCode: 'America/Mexico_City' }
    ]

    const index = Math.floor(Math.random() * listOfLocations.length);
    this.locationsService.addLocation(listOfLocations[index]);
    this.locationsList = this.locationsService.getLocations();
    this.setWorkingLocation(this.locationsList[this.locationsList.length - 1].id);
  }

  getWeatherDataSources(): void {
    const sources: SelectItemGroup[] = [];

    window.weather.listWeatherConditions()
      .then((s) => {
        sources.push({
          label: 'OpenMeteo',
          value: 'OpenMeteo',
          items: s['OpenMeteo'].map((item: WeatherCondition) => {
            return {
              label: item.condition,
              value: item.id
            }
          })
        });

        sources.push({
          label: 'BrightSky (DWD)',
          value: 'BrightSky',
          items: s['BrightSky'].map((item: WeatherCondition) => {
            return {
              label: item.condition,
              value: item.id
            }
          })
        });
      })
    .catch((e) => {
      console.error('Error while loading weather conditions:', e);
    })
    .finally(() => {
      this.dataSources = sources;
      this.selectedDataSource = sources[0].items[0].value;
    });
  }

  triggerUpdateCheck(): void {
    window.app.triggerUpdateCheck();
  }
}

export type TimezoneList = {
  label: string;
  value: string;
  items: TimeZone[];
}[]
