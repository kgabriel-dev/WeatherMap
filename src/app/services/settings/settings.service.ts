import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly defaultSettings: Settings = {
    version: '0.1.0',
    languageCode: 'en-US',
    weatherCondition: 'openmeteo.cloudiness',
    forecastLength: {
      value: 12,
      unitId: TimeUnits.HOURS
    },
    updateCheck: true,
    defaultLocationIndex: 0,
    labeledImages: true,
    darkMode: false
  }
  private settings: Settings = this.defaultSettings;

  private readonly settingsChangedSubject = new BehaviorSubject<Settings>(this.defaultSettings);
  private notifySettingsRead$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // check if settings.json exists
    window.files.checkAppFileExists('settings.json')
      .then((exists) => {
        if (!exists) {
          // write settings.json file
          window.files.writeAppFile('settings.json', JSON.stringify(this.defaultSettings, undefined, 2), 'utf8')
            .then((written) => {
              if(written) console.info('settings.json created!');
              else console.error('Error creating settings.json!');
            })
            .catch((error) => {
              console.error('Error creating settings.json!', error);
            });
        }

        // Read settings.json file
        window.files.readAppFile('settings.json', 'utf8')
        .then((data) => {
          console.info('settings.json read!');
          this.settings = JSON.parse(data);

          // check for missing settings and add them
          for (const key in this.defaultSettings) {
            if (!(key in this.settings)) {
              // @ts-ignore
              this.settings[key] = this.defaultSettings[key];
            }
          }

          window.app.toggleDarkMode(this.settings.darkMode);

          this.settingsChangedSubject.next(this.settings);
          this.notifySettingsRead$.next(true);
        })
        .catch((error) => {
          console.error('Error reading settings.json!', error);
          this.settings = this.defaultSettings;
          this.settingsChangedSubject.next(this.settings);
          this.notifySettingsRead$.next(true);
        });
      })
      .catch((error) => {
        console.error('Error checking settings.json!', error);
        this.settings = this.defaultSettings;
        this.settingsChangedSubject.next(this.settings);
        this.notifySettingsRead$.next(true);
      });
  }

  public getSettings(): Settings {
    return this.settings || this.defaultSettings;
  }

  public setSettings(newSettings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...newSettings };

    this.settingsChangedSubject.next(this.settings);
  }

  public saveSettings(): void {
    window.files.writeAppFile('settings.json', JSON.stringify(this.settings, undefined, 2), 'utf8')
      .then(() => console.info('settings.json saved!'))
      .catch((error) => console.error('Error saving settings.json!', error));
  }

  public getSettingsChangedObservable() {
    return this.settingsChangedSubject.asObservable();
  }

  public isServiceReady() {
    return this.notifySettingsRead$.asObservable();
  }

  rereadSettingsFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Read settings.json file
      window.files.readAppFile('settings.json', 'utf8')
      .then((data) => {
        this.settings = JSON.parse(data);

        // check for missing settings and add them
        for (const key in this.defaultSettings) {
          if (!(key in this.settings)) {
            // @ts-ignore
            this.settings[key] = this.defaultSettings[key];
          }
        }

        resolve();
      })
      .catch((error) => {
        console.error('Error reading settings.json!', error);
        this.settings = this.defaultSettings;

        reject(error);
      });
    });
  }

}

export type Settings = {
  version: string,
  languageCode: string,
  weatherCondition: string,
  forecastLength: {
    value: number,
    unitId: TimeUnits,
  },
  updateCheck: boolean,
  defaultLocationIndex: number,
  labeledImages: boolean,
  darkMode: boolean
}

export enum TimeUnits {
  HOURS,
  DAYS
}

export const TimeUnitStrings: {id: TimeUnits, display: string}[] = [
  {id: TimeUnits.HOURS, display: $localize`:@@hours:hours`},
  {id: TimeUnits.DAYS, display: $localize`:@@days:days`}
];

// TODO: Needs to be the same as in src/types/location.d.ts
// fix this to be a shared type
export enum SizeUnits {
  KILOMETERS,
  MILES
}

export const SizeUnitStrings: {id: SizeUnits, display: string}[] = [
  {id: SizeUnits.KILOMETERS, display: $localize`:@@kilometers:km`},
  {id: SizeUnits.MILES, display: $localize`:@@miles:mi`}
];
