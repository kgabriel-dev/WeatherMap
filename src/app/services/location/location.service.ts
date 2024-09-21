import { Injectable } from '@angular/core';
import { Location, LocationAddingData } from './location.type';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private locations: Location[] = [];

  constructor() {
    // check if locations.json exists
    window.files.checkAppFileExists('locations.json')
      .then((exists) => {
        if (!exists) {
          // write locations.json file
          window.files.writeAppFile('locations.json', '[]', 'utf8')
            .then(() => {
              console.log('locations.json created!');
            })
            .catch((error) => {
              console.error('Error creating locations.json!', error);
              throw error;
            });
        }

        // Read locations.json file
        window.files.readAppFile('locations.json', 'utf8')
        .then((data) => {
          this.locations = JSON.parse(data);
        })
        .catch((error) => {
          console.error('Error reading locations.json!', error);
          this.locations = [];
        });
      })
      .catch((error) => {
        console.error('Error checking locations.json!', error);
      })
  }

  public getLocations(): Location[] {
    return this.locations;
  }

  public addLocation(locationData: LocationAddingData) {
    this.locations.push({
      id: this.locations.length + 1,
      ...locationData
    });

    this.saveLocations();
  }

  public removeLocation(id: number) {
    this.locations = this.locations.filter(location => location.id !== id);
    this.saveLocations();
  }

  public saveLocations() {
    window.files.writeAppFile('locations.json', JSON.stringify(this.locations), 'utf8')
      .then(() => console.log('locations.json saved!'))
      .catch((error) => console.error('Error saving locations.json!', error));
  }
}
