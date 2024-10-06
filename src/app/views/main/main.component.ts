import { Component, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { ProgressBarModule } from 'primeng/progressbar';
import { LocationService } from '../../services/location/location.service';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SettingsService } from '../../services/settings/settings.service';
import { Location } from '../../services/location/location.type';
import { combineLatestWith, map } from 'rxjs';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [FormsModule, ProgressBarModule, ButtonModule, ImageModule, DropdownModule, InputNumberModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  readonly filePath = 'D:\\Programmieren\\Electron\\WeatherMap\\image_0.png';

  currentWeatherImageSrc = '';
  currentWeatherImageIndex = 0;
  numberOfWeatherImages = 7;
  selectedLocation?: Location;
  latitude = 51.5074;
  longitude = 0.1278;
  resolution = 5;
  regionSize: Location['region']['size'] = {
    length: 100,
    unit: 'km'
  }

  readonly customLocation: Location = {
    id: -1,
    coordinates: {
      latitude: this.latitude,
      longitude: this.longitude
    },
    name: 'Custom Location',
    region: {
      resolution: this.resolution,
      size: this.regionSize
    },
    timezoneCode: 'UTC'
  }

  @ViewChild('locationDropdown') locationDropdown?: Dropdown;

  constructor(
    public locationsService: LocationService,
    public settingsService: SettingsService
  ) {
    window.app.onSettingsModalClosed(() => {
      const settings = this.settingsService.getSettings();
      this.selectedLocation = this.locationsService.getLocations()[settings.defaultLocationIndex];

      if(!this.selectedLocation)
        this.selectedLocation = this.customLocation;

      this.applyLocation(this.selectedLocation);

      if(this.locationDropdown)
        this.locationDropdown.focus(); // this triggers the update of the label to the selected location
    });

    // set the default location to the one saved in the settings
    // --> first create an observable that combines the location file read and the settings file read
    const combinedReadiness$ = this.locationsService.isServiceReady().pipe(
      combineLatestWith(this.settingsService.isServiceReady()),
      map(([isLocationReady, isSettingsReady]) => isLocationReady && isSettingsReady)
    );
    // --> subscribe to the observable
    combinedReadiness$.subscribe((isRead: boolean) => {
      if(!isRead) return; // wait until both files are read

      const settings = this.settingsService.getSettings();
      this.selectedLocation = this.locationsService.getLocations()[settings.defaultLocationIndex];

      if(!this.selectedLocation)
        this.selectedLocation = this.customLocation;

      this.applyLocation();
    })
  }

  ngOnInit(): void {
    window.files.readFile(this.filePath, 'base64')
      .then((data) => {
        const extension = this.filePath.split('.').pop();
        this.currentWeatherImageSrc = 'data:image/' + extension + ';base64,' + data;
      })
  }

  changeWeatherImageIndex(amount: number): void {
    this.currentWeatherImageIndex += amount;

    if(this.currentWeatherImageIndex >= this.numberOfWeatherImages)
      this.currentWeatherImageIndex = this.numberOfWeatherImages - this.currentWeatherImageIndex

    else if(this.currentWeatherImageIndex < 0)
      this.currentWeatherImageIndex = this.numberOfWeatherImages + this.currentWeatherImageIndex
  }

  pauseWeatherImageAnimation(): void {}

  applyLocation(location?: Location): void {
    location = location || this.selectedLocation || this.customLocation;

    if(!location)
      return;

    this.latitude = location.coordinates.latitude;
    this.longitude = location.coordinates.longitude;
    this.resolution = location.region.resolution;
    this.regionSize = location.region.size;

    if(location == this.customLocation)
      this.selectedLocation = location;
  }

  onLocationDataChange(): void {
    this.selectedLocation = this.customLocation;
  }

  getLocationsList(): Location[] {
    return [
      ...this.locationsService.getLocations(),
      this.customLocation
    ];
  }
}
