import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectItemGroup } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import timezones, { TimeZone } from 'timezones-list';
import { SettingsService } from '../../services/settings/settings.service';
import { LocationService } from '../../services/location/location.service';
import { ListboxModule } from 'primeng/listbox';

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
    ListboxModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  // variables for the selected timezone
  readonly timezones = this.buildTimezoneList();
  selectedTimezoneCode: string = this.timezones[0].items[0].tzCode;

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

  constructor(
    public settingsService: SettingsService,
    public locationsService: LocationService
  ) {
    // load and set the initial settings
    settingsService.getSettingsChangedObservable().subscribe((settings) => {
      this.selectedTimezoneCode = settings.timezoneCode || this.timezones[0].items[0].tzCode;
      this.selectedDataSource = settings.weatherCondition;
      this.selectedLanguageKey = settings.languageCode || this.languages[0].key;
    });
  }

  private buildTimezoneList(): TimezoneList {
    const timezoneGroups: { label: string, timezones: TimeZone[] }[] = [];
    timezones.forEach(timezone => {
      const continent = timezone.label.split('/')[0];

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
    return this.timezones
      .flatMap(group => group.items)
      .find(timezone => timezone.tzCode === code) || this.timezones[0].items[0];
  }

}

type TimezoneList = {
  label: string;
  value: string;
  items: TimeZone[];
}[]
