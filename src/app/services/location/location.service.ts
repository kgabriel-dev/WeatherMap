import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private locations: Region[] = [];
  private fileRead = false; // flag to check if file has been read
  private isFileRead$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.readLocationsFile();
  }

  private readLocationsFile() {
    // check if locations.json exists
    window.files.checkAppFileExists('locations.json')
      .then((exists) => {
        if (!exists) {
          // write locations.json file
          window.files.writeAppFile('locations.json', '[]', 'utf8')
            .then(() => {
              console.info('locations.json created!');
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

          this.fileRead = true;
          this.isFileRead$.next(true);
        })
        .catch((error) => {
          console.error('Error reading locations.json!', error);
          this.locations = [];

          this.fileRead = true;
          this.isFileRead$.next(true);
        });
      })
      .catch((error) => {
        console.error('Error checking locations.json!', error);
      })
  }

  public getLocations(): Region[] {
    return this.locations;
  }

  public updateLocation(locationData: Region) {
    const location = this.locations.find(location => location.id === locationData.id);

    if(!location) return;

    Object.assign(location, locationData);
    this.saveLocations();
  }

  public addLocation(locationData: RegionAddingData) {
    this.locations.push({
      id: Math.max(...this.locations.map(location => location.id)) + 1,
      ...locationData
    });

    this.saveLocations();
  }

  public removeLocation(id: number) {
    this.locations = this.locations.filter(location => location.id !== id);
    this.saveLocations();
  }

  public saveLocations() {
    window.files.writeAppFile('locations.json', JSON.stringify(this.locations, undefined, 2), 'utf8')
      .then(() => console.info('locations.json saved!'))
      .catch((error) => console.error('Error saving locations.json!', error));
  }

  public isServiceReady(): Observable<boolean> {
    return this.isFileRead$.asObservable();
  }
}
