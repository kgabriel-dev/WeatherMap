import { Injectable } from '@angular/core';
import { Location } from './location.type';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private locations: Location[] = [];

  constructor() {
    // Read locations.json file
    window.files.readAppFile('locations.json', 'utf8')
      .then((data) => {
        this.locations = JSON.parse(data);
      })
      .catch((error) => {
        console.error('Error reading locations.json!', error);
        this.locations = [];
      });
  }

  public getLocations(): Location[] {
    console.log('Locations:', this.locations);
    return this.locations;
  }
}
