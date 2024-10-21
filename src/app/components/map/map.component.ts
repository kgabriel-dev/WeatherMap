import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';
import { LocationService } from '../../services/location/location.service';
import { SettingsService } from '../../services/settings/settings.service';
import { BehaviorSubject, combineLatestWith, map } from 'rxjs';
import { SessionService } from '../../services/session/session.service';

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
    iconAnchor: [ 13, 25 ],
    popupAnchor: [ 0, -25 ]
  })

  readonly markerIconSelected = L.icon({
    iconUrl: 'assets/maps-pin-red-icon.png',
    iconSize: [ 25, 25 ],
    iconAnchor: [ 13, 25 ],
    popupAnchor: [ 0, -25 ]
  })

  markers: L.Marker[] = [];
  overlayedImage: L.ImageOverlay | undefined;

  constructor(
    private locationsService: LocationService,
    private settingsService: SettingsService,
    private sessionService: SessionService
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
            .on('click', () => this.onMarkerClick(i))
        )
      }

      this.fitRegionToScreen();
    })

    this.sessionService.getSessionDataObservable().subscribe((sessionData) => {
      this.markers.forEach((marker, index) => {
        const locationIndex = sessionData.mainData.selectedRegionIndex === -1 ? this.settingsService.getSettings().defaultLocationIndex : sessionData.mainData.selectedRegionIndex;
        const icon = index === locationIndex ? this.markerIconSelected : this.markerIcon;

        marker.setIcon(icon);
      });

      this.fitRegionToScreen();
    });
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

  private onMarkerClick(index: number) {
    const locations = this.locationsService.getLocations();
    const selectedLocation = locations[index];

    this.sessionService.updateSessionData({
      mainData: {
        ...this.sessionService.getLatestSessionData().mainData,
        selectedRegionIndex: selectedLocation ? index : -1,
        usedLocation: selectedLocation.coordinates,
        regionResolution: selectedLocation.region.resolution,
        regionSize: selectedLocation.region.size
      }
    })
  };

  overlayWeatherImage(filePath: string): void {
    if(!this.map) return;

    const sessionData = this.sessionService.getLatestSessionData();

    const location = sessionData.mainData.selectedRegionIndex === -1 ? sessionData.mainData.usedLocation : this.locationsService.getLocations()[sessionData.mainData.selectedRegionIndex].coordinates;
    const regionSizeLat = this.convertRegionSizeToKm(sessionData.mainData.regionSize) / 110.574;
    const regionSizeLon = this.convertRegionSizeToKm(sessionData.mainData.regionSize) / (111.32 * Math.cos(location.latitude * Math.PI / 180));

    const imageBounds = L.latLngBounds(
      [ location.latitude - regionSizeLat / 2, location.longitude - regionSizeLon / 2 ],
      [ location.latitude + regionSizeLat / 2, location.longitude + regionSizeLon / 2 ]
    )

    if(this.overlayedImage)
      this.map.removeLayer(this.overlayedImage);

    this.overlayedImage = L.imageOverlay(filePath, imageBounds, { opacity: 0.7 }).addTo(this.map);

    this.fitRegionToScreen();
  }

  convertRegionSizeToKm(regionSize: { length: number; unit: string }): number {
    if(regionSize.unit === 'km')
      return regionSize.length;

    return regionSize.length * 1.60934;
  }

  fitRegionToScreen(): void {
    if(!this.map) return;

    const sessionData = this.sessionService.getLatestSessionData();

    const location = sessionData.mainData.selectedRegionIndex === -1 ? sessionData.mainData.usedLocation : this.locationsService.getLocations()[sessionData.mainData.selectedRegionIndex].coordinates;
    const regionSizeKm = this.convertRegionSizeToKm(sessionData.mainData.regionSize);

    const regionSizeLat = (regionSizeKm + 1) / 110.574;
    const regionSizeLon = (regionSizeKm + 1) / (111.32 * Math.cos(location.latitude * Math.PI / 180));

    this.map.fitBounds(
      [
        [ location.latitude - regionSizeLat / 2, location.longitude - regionSizeLon / 2 ],
        [ location.latitude + regionSizeLat / 2, location.longitude + regionSizeLon / 2 ]
      ],
      { animate: true, duration: 1 }
    );
  }

}
