import { ChangeDetectorRef, Component } from '@angular/core';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-progress-info',
  standalone: true,
  imports: [TableModule],
  templateUrl: './progress-info.component.html',
  styleUrl: './progress-info.component.scss'
})
export class ProgressInfoComponent {
  displayValues: { progressValue: number, progressMessage: string }[] = [];

  constructor(private changeDetector: ChangeDetectorRef) {
    // load all progress messages that may have been sent before the component was loaded
    window.weather.getLatestProgressMessages().then((messages) => {
      this.displayValues = messages
        .map((message) => ({
          progressValue: Math.round(message.progress * 10) / 10,
          progressMessage: message.message
        }))
        .reverse();
    });

    // listen for new progress messages
    window.weather.onWeatherGenerationProgress((_inProgress: boolean, progressValue: number, progressMessage: string) => {
      // If the progress is 0 (a new process started), clear the display values
      if(progressValue === 0) {
        this.displayValues = [];
      }

      // check if the message is already in the array
      const existingMessage = this.displayValues.find((message) => message.progressMessage === progressMessage);
      if(existingMessage) return;

      // Round to 2 decimal places
      progressValue = Math.round(progressValue * 10) / 10;

      // Add the new value to the front of the array
      this.displayValues.unshift({ progressValue, progressMessage });

      // force the change detection to update the view
      this.changeDetector.detectChanges();
    })
  }

}
