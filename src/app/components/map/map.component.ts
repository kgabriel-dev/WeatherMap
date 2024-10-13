import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';
import { LocationService } from '../../services/location/location.service';
import { SettingsService } from '../../services/settings/settings.service';
import { BehaviorSubject, combineLatestWith, map } from 'rxjs';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit {
  private map: L.Map | undefined;
  private isMapReady$ = new BehaviorSubject<boolean>(false);

  readonly markerIcon = L.icon({
    iconUrl: 'assets/maps-pin-black-icon.png',
    iconSize: [ 25, 25 ],
    iconAnchor: [ 13, 25 ]
  })

  readonly markerIconSelected = L.icon({
    iconUrl: 'assets/maps-pin-red-icon.png',
    iconSize: [ 25, 25 ],
    iconAnchor: [ 13, 25 ]
  })

  markers: L.Marker[] = [];

  constructor(
    private locationsService: LocationService,
    private settingsService: SettingsService
  ) {
    const combinedReadiness$ = this.locationsService.isServiceReady().pipe(
      combineLatestWith(this.settingsService.isServiceReady(), this.isMapReady$),
      map(([isLocationReady, isSettingsReady, isMapReady]) => isLocationReady && isSettingsReady && isMapReady)
    );

    // --> subscribe to the observable
    combinedReadiness$.subscribe((ready: boolean) => {
      if(!ready || !this.map)
        return;

      const locations = this.locationsService.getLocations();
      for(let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const icon = i === this.settingsService.getSettings().defaultLocationIndex ? this.markerIconSelected : this.markerIcon;

        this.markers.push(
          L.marker([ location.coordinates.latitude, location.coordinates.longitude ], { icon })
            .addTo(this.map)
            .bindPopup(location.name)
        )
      }
    })
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    this.map = L.map('map', {
      center: [ 54.10352, 12.1048 ],
      zoom: 10
    });

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.isMapReady$.next(true);
  }

}
