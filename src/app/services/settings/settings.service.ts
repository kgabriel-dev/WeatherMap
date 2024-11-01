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
      unit: 'hours'
    },
    updateCheck: true,
    defaultLocationIndex: 0
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

  public setSettingsValue(key: keyof Settings, value: Settings[keyof Settings]): void {
    if (this.settings && key in this.settings) {
      // @ts-ignore
      this.settings[key] = value;
    }

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

}

export type Settings = {
  version: string,
  languageCode: string,
  weatherCondition: string,
  forecastLength: {
    value: number,
    unit: 'hours' | 'days',
  },
  updateCheck: boolean,
  defaultLocationIndex: number,
}
