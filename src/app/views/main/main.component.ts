import { Component, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { ProgressBarModule } from 'primeng/progressbar';
import { LocationService } from '../../services/location/location.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [ProgressBarModule, ButtonModule, ImageModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  readonly filePath = 'D:\\Programmieren\\Electron\\WeatherMap\\image_0.png';

  currentWeatherImageSrc = '';
  currentWeatherImageIndex = 0;
  numberOfWeatherImages = 7;

  constructor(
    public locationsService: LocationService
  ) { }

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
}
