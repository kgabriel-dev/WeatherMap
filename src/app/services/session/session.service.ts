import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SessionData } from './session.type';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly sessionDataSubject = new BehaviorSubject<SessionData>({
    mainData: {
      currentWeatherImageIndex: 0,
      numberOfWeatherImages: 0,
      selectedRegion: undefined,
      usedLocation: {
        latitude: 54.10352,
        longitude: 12.1048
      },
      regionResolution: 5,
      regionSize: {
        length: 100,
        unit: 'km'
      },
      forecastLength: 0,
      weatherDataSource: 'OpenMeteo'
    }
  });

  constructor() { }

  getSessionDataObservable() {
    return this.sessionDataSubject.asObservable();
  }

  updateSessionData(data: SessionData) {
    this.sessionDataSubject.next(data);
  }

  getLatestSessionData() {
    return this.sessionDataSubject.getValue();
  }

}
