import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message, SelectItemGroup } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { SettingsService } from '../../services/settings/settings.service';
import { LocationService } from '../../services/location/location.service';
import { ListboxModule } from 'primeng/listbox';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
import { getTimeZones, TimeZone } from '@vvo/tzdb';

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
  // variables for the selected timezone
  readonly timezoneList = this.buildTimezoneList();
  selectedTimezoneCode: string = this.timezoneList[0].items[0].abbreviation;

  // variables for the selected data source
  readonly dataSources: SelectItemGroup[] = [
    {
      label: 'OpenMeteo',
      value: 'OpenMeteo',
      items: [
        { label: 'Cloudiness (%)', value: 'openmeteo.cloudiness' },
        { label: 'Temperature (°C)', value: 'openmeteo.temperature_c' },
        { label: 'Temperature (°F)', value: 'openmeteo.temperature_f' },
        { label: 'Relative Humidity (%)', value: 'openmeteo.humidity' },
        { label: 'Cloudiness low (%)', value: 'openmeteo.cloudiness_low' },
        { label: 'Cloudiness mid (%)', value: 'openmeteo.cloudiness_mid' },
        { label: 'Cloudiness high (%)', value: 'openmeteo.cloudiness_high' },
        { label: 'Dew point (°C)', value: 'openmeteo.dew_point_c' },
        { label: 'Dew point (°F)', value: 'openmeteo.dew_point_f' },
        { label: 'Air pressure (hPa)', value: 'openmeteo.pressure' },
        { label: 'Precipitation (mm)', value: 'openmeteo.precipitation' },
        { label: 'Precipitation probability (%)', value: 'openmeteo.precipitation_prob' },
        { label: 'Visibility (m)', value: 'openmeteo.visibility' },
        { label: 'UV index', value: 'openmeteo.uv_index' }
      ]
    },
    {
      label: 'BrightSky (DWD)',
      value: 'BrightSky',
      items: [
        { label: 'Cloudiness (%)', value: 'brightsky.cloudiness' },
        { label: 'Temperature (°C)', value: 'brightsky.temperature_c' },
        { label: 'Temperature (°F)', value: 'brightsky.temperature_f' },
        { label: 'Relative Humidity (%)', value: 'brightsky.humidity' },
        { label: 'Dew point (°C)', value: 'brightsky.dew_point_c' },
        { label: 'Dew point (°F)', value: 'brightsky.dew_point_f' },
        { label: 'Air pressure (hPa)', value: 'brightsky.pressure' },
        { label: 'Precipitation probability (%)', value: 'brightsky.precipitation_prob' },
        { label: 'Visibility (m)', value: 'brightsky.visibility' },
        { label: 'Wind speed (m/s)', value: 'brightsky.wind_speed' }
      ]
    }
  ]
  readonly dataSourceIcons: {[key: string]: string} = {
    'OpenMeteo': 'assets/openmeteo-favicon.png',
    'BrightSky': 'assets/brightsky-favicon.svg'
  }
  selectedDataSource: string = this.dataSources[0].items[0].value;

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
  forecastLength: { value: number, unit: 'hours' | 'days' } = {
    value: 4,
    unit: 'days'
  }
  updateCheck: boolean = true;
  workingLocation?: Region;
  locationLoadingMessages: Message[] = [];
  locationsAlreadyLoaded: boolean = false;
  locationsList: Region[] = [];

  constructor(
    public settingsService: SettingsService,
    public locationsService: LocationService
  ) {
    console.log(this.timezoneList)
    // load and set the initial settings
    settingsService.getSettingsChangedObservable().subscribe((settings) => {
      this.selectedTimezoneCode = settings.timezoneCode || this.timezoneList[0].items[0].abbreviation;
      this.selectedDataSource = settings.weatherCondition;
      this.selectedLanguageKey = settings.languageCode || this.languages[0].key;
      this.forecastLength = settings.forecastLength || this.forecastLength;
    });

    // display a message while loading the locations file
    this.locationLoadingMessages = [{
      severity: 'info',
      summary: 'Loading locations...',
      detail: 'Please wait a moment.'
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
        severity: 'warn',
        summary: 'Loading locations...',
        detail: 'This is taking longer than expected. Please wait a moment.'
      }]
    }, 3000);
  }

  saveSettings() {
    this.settingsService.setSettingsValue('timezoneCode', this.selectedTimezoneCode);
    this.settingsService.setSettingsValue('weatherCondition', this.selectedDataSource);
    this.settingsService.setSettingsValue('languageCode', this.selectedLanguageKey);
    this.settingsService.setSettingsValue('forecastLength', {
      value: this.forecastLength.value,
      unit: this.forecastLength.unit
    });
    this.settingsService.setSettingsValue('updateCheck', this.updateCheck);

    this.settingsService.saveSettings();
    this.closeWindow();
  }

  closeWindow() {
    window.close();
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

  setWorkingLocation(locationId: number) {
    // if no locations are found, add an initial location and set it
    if(this.locationsList.length === 0) {
      this.addInitialLocation();
      return; // new location will automatically be set
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
      { name: 'Rostock', coordinates: { latitude: 54.10352, longitude: 12.10480 }, region: { size: { length: 100, unit: 'km' }, resolution: 6 }, timezoneCode: 'Europe/Berlin' },
      { name: 'New York City', coordinates: { latitude: 40.73164, longitude: -74.00166 }, region: { size: { length: 130, unit: 'mi' }, resolution: 7}, timezoneCode: 'America/New_York' },
      { name: 'Madrid', coordinates: { latitude: 40.43684, longitude: -3.65193 }, region: { size: { length: 80, unit: 'km' }, resolution: 4 }, timezoneCode: 'Europe/Madrid' },
      { name: 'Sydney', coordinates: { latitude: -33.86708, longitude: 151.24548 }, region: { size: { length: 150, unit: 'km' }, resolution: 10 }, timezoneCode: 'Australia/Sydney' },
      { name: 'Tokyo', coordinates: { latitude: 35.68267, longitude: 139.77254 }, region: { size: { length: 100, unit: 'km' }, resolution: 6 }, timezoneCode: 'Asia/Tokyo' }
    ]

    const index = Math.floor(Math.random() * listOfLocations.length);
    this.locationsService.addLocation(listOfLocations[index]);
    this.locationsList = this.locationsService.getLocations();
    this.setWorkingLocation(this.locationsList[this.locationsList.length - 1].id);
  }

}

type TimezoneList = {
  label: string;
  value: string;
  items: TimeZone[];
}[]
