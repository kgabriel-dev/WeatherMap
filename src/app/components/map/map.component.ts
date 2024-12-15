import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';
import { LocationService } from '../../services/location/location.service';
import { SettingsService, SizeUnitStrings } from '../../services/settings/settings.service';
import { BehaviorSubject, combineLatestWith, map } from 'rxjs';
import { SessionService } from '../../services/session/session.service';
import { getTimeZones } from '@vvo/tzdb';
import { SessionData } from '../../services/session/session.type';
import { SizeUnits } from '../../services/settings/settings.service';

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

  private tempMarker: L.Marker | undefined;

  private lastSessionData: SessionData | undefined;
  private initialSessionDataReceived = false;

  // --- CREATION OF OVERLAYS ---
  readonly DataOverlay = L.Control.extend({
    onAdd: (_map: L.Map): HTMLDivElement => {
      const div = L.DomUtil.create('div', 'overlay-control');

      div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      div.style.borderRadius = '5px';
      div.style.margin = '0px';
      div.style.color = 'black';
      div.style.fontSize = '15px';

      return div;
    },

    onRemove: (_map: L.Map): void => {
      // Nothing to do here
    },

    setText: (text: string[]): void => {
      const div = this.dataOverlay.getContainer();
      if(!div) return;

      const paragraphs = text.map((t) => `<p style='margin: 0px'>${t}</p>`).join('');

      div.innerHTML = "<h2 style='text-decoration: underline; margin: 0px'>" + $localize`Weather Data` + `</h2>${paragraphs}`;
      div.style.padding = '5px';
    }
  });
  readonly dataOverlay = new this.DataOverlay({ position: 'topright' });

  // --- "NORMAL" CODE ---
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

      this.createMarkers();

      this.fitRegionToScreen();

      this.dataOverlay.addTo(this.map);
    })

    this.sessionService.getSessionDataObservable().subscribe((sessionData) => {
      // update the icons of the regular markers
      this.markers.forEach((marker, index) => {
        const locationIndex = sessionData.mainData.selectedRegionIndex;
        const icon = index === locationIndex ? this.markerIconSelected : this.markerIcon;

        marker.setIcon(icon);
      });
      // update the icon of the temporary marker
      if(sessionData.mainData.selectedRegionIndex === -1 && this.tempMarker)
        this.tempMarker.setIcon(this.markerIconSelected);
      else
        this.tempMarker?.setIcon(this.markerIcon);

      if(!this.initialSessionDataReceived || this.lastSessionData && this.lastSessionData.mainData.selectedRegionIndex !== sessionData.mainData.selectedRegionIndex)
        this.fitRegionToScreen();

      this.lastSessionData = sessionData;
      this.initialSessionDataReceived = true;
    });
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    // create the map
    this.map = L.map('map', {
      center: [ 54.10352, 12.1048 ],
      zoom: 10
    });

    // add tiles to the map
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    // register right click event
    this.map.on('contextmenu', (event) => {
      this.sessionService.updateSessionData({
        mainData: {
          ...this.sessionService.getLatestSessionData().mainData,
          usedLocation: {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng
          },
          selectedRegionIndex: -1
        }
      });

      if(!this.map) return;

      if(this.tempMarker)
        this.map.removeLayer(this.tempMarker);

      this.tempMarker = L.marker([ event.latlng.lat, event.latlng.lng ], { icon: this.markerIconSelected })
        .addTo(this.map)
        .bindPopup($localize`Custom temporary location - you can create permanent locations in the settings`)
        .openPopup()
        .on('click', () => {
          const sessionData = this.sessionService.getLatestSessionData();

          this.sessionService.updateSessionData({
            mainData: {
              ...sessionData.mainData,
              selectedRegionIndex: -1,
              usedLocation: {
                latitude: event.latlng.lat,
                longitude: event.latlng.lng
              }
            }
          });

          this.onMarkerClick(-1);
          this.fitRegionToScreen();
        });

      this.markers.forEach((marker) => marker.setIcon(this.markerIcon));
    });

    // notify that the map is ready
    this.isMapReady$.next(true);
  }

  private onMarkerClick(index: number) {
    const locations = this.locationsService.getLocations();
    const selectedLocation = index !== -1 ? locations[index] : null;

    this.sessionService.updateSessionData({
      mainData: {
        ...this.sessionService.getLatestSessionData().mainData,
        selectedRegionIndex: selectedLocation ? index : -1,
        usedLocation: selectedLocation?.coordinates ?? this.sessionService.getLatestSessionData().mainData.usedLocation,
        regionResolution: selectedLocation?.region.resolution ?? this.sessionService.getLatestSessionData().mainData.regionResolution,
        regionSize: selectedLocation?.region.size ?? this.sessionService.getLatestSessionData().mainData.regionSize
      }
    })
  };

  overlayWeatherImage(filePath: string, fitRegion: boolean): void {
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

    this.overlayedImage = L.imageOverlay(filePath, imageBounds).addTo(this.map);

    if(fitRegion) this.fitRegionToScreen();
  }

  convertRegionSizeToKm(regionSize: { length: number; unitId: SizeUnits }): number {
    if(regionSize.unitId == SizeUnits.KILOMETERS)
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

    this.map.flyToBounds([
      [ location.latitude - regionSizeLat / 2, location.longitude - regionSizeLon / 2 ],
      [ location.latitude + regionSizeLat / 2, location.longitude + regionSizeLon / 2 ]
    ]);
  }

  updateDataInfo(lastDataGatheringDate: Date): void {
    const sessionData = this.sessionService.getLatestSessionData();
    const location = sessionData.mainData.selectedRegionIndex === -1 ? sessionData.mainData.usedLocation : this.locationsService.getLocations()[sessionData.mainData.selectedRegionIndex].name;

    const imageDate = new Date(lastDataGatheringDate);  // image date is in user's timezone
    imageDate.setHours(lastDataGatheringDate.getHours() + sessionData.mainData.currentWeatherImageIndex);  // add the index to get the exact date

    // convert image date to location's timezone or overridden timezone based on user's settings
    const timezoneCode = sessionData.mainData.useOverriddenTimezone ?
        sessionData.mainData.overriddenTimezoneCode :   // use overridden timezone if set to true, otherwise use location's timezone (fallback to overridden timezone if location is not set)
        (sessionData.mainData.selectedRegionIndex === -1 ? sessionData.mainData.overriddenTimezoneCode : this.locationsService.getLocations()[sessionData.mainData.selectedRegionIndex].timezoneCode);

    let timezoneOffset = getTimeZones().find(tz => tz.name === timezoneCode)?.currentTimeOffsetInMinutes;
    if(timezoneOffset === undefined) timezoneOffset = 0;
    else timezoneOffset += new Date().getTimezoneOffset();  // add the user's timezone offset

    imageDate.setMinutes(imageDate.getMinutes() + timezoneOffset);

    this.dataOverlay.setText([
      $localize`Location: ${location}`,
      $localize`Region size: ${sessionData.mainData.regionSize.length}x${sessionData.mainData.regionSize.length} ${SizeUnitStrings[sessionData.mainData.regionSize.unitId].display}`,
      $localize`Resolution: ${sessionData.mainData.regionResolution}x${sessionData.mainData.regionResolution}`,
      $localize`Weather data: ${sessionData.mainData.weatherCondition?.condition ?? '** Unknown **'}`,
      $localize`Time: ${new Date(imageDate).toLocaleString(Intl.getCanonicalLocales(this.settingsService.getSettings().languageCode), { dateStyle: 'medium', timeStyle: 'short' })}`
    ]);
  }

  public createMarkers(): void {
    if(!this.map) return;

    this.markers.forEach((marker) => this.map?.removeLayer(marker));
    this.markers = [];

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
  }

}
