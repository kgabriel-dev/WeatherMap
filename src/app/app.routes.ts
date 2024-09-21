import { Routes } from '@angular/router';
import { MainComponent } from './views/main/main.component';
import { SettingsComponent } from './views/settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    component: MainComponent
  },
  {
    path: 'settings',
    component: SettingsComponent
  }
];
