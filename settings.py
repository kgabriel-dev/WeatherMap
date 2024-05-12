import json
import PySimpleGUI as sg


class Settings:

    def __init__(self):
        self.settings = {
            'forecast_length': 12,
            'latitude': 54.10,
            'longitude': 12.11,
            'source': 'OpenMeteo',
            'size': 80.0,
            'resolution': 8,
            'language': 'Deutsch',
            'load_data_on_start': False
        }
    
    def get_settings(self):
        return self.settings
    
    def change_setting_entry(self, key, value):
        if key in self.settings:
            self.settings[key] = value
        else:
            print(f"Key '{key}' not found in settings.")
    
    def change_settings(self, settings):
        for key, value in settings.items():
            self.change_setting_entry(key, value)

    def load_settings_from_file(self, file_path):
        with open(file_path, 'r') as file:
            settings = json.load(file)

            # check if all keys are present
            for key in self.settings.keys():
                if key not in settings:
                    print(f"Key '{key}' not found in settings file.")
                    return

            self.change_settings(settings)
    
    def save_settings_to_file(self, file_path):
        with open(file_path, 'w') as file:
            json.dump(self.settings, file, indent=4)


class SettingsGUI:

    def __init__(self, gui, settings, change_settings_callback):
        self.main_gui = gui
        self.settings = settings
        self.change_settings_callback = change_settings_callback

    def open_settings_window(self):
        layout = self.create_layout()
        window = sg.Window('Einstellungen', layout, modal=True, finalize=True)

        self.settings_gui = window

        while True:
            event, values = window.read()

            if event == sg.WIN_CLOSED:
                break
            elif event == 'save_button':
                self.save_settings(values)
                break
            elif event == 'cancel_button':
                break

        window.close()
    
    def create_layout(self):
        layout = [
            [
                sg.Column(
                    [
                        [sg.Text('Vorhersagedauer (in Stunden):')],
                        [sg.InputText(self.settings.get_settings()['forecast_length'], key='forecast_length')],
                        [sg.HSeparator()],
                        [sg.Text('Breitengrad:')],
                        [sg.InputText(self.settings.get_settings()['latitude'], key='latitude')],
                        [sg.HSeparator()],
                        [sg.Text('Längengrad:')],
                        [sg.InputText(self.settings.get_settings()['longitude'], key='longitude')],
                        [sg.HSeparator()],
                        [sg.Text('Quelle:')],
                        [sg.Combo(['OpenMeteo', 'BrightSky (DWD)'], key='source', default_value=str(self.settings.get_settings()['source']), size=(15,1), readonly=True)],
                        [sg.HSeparator()],
                        [sg.Text('Größe (in km):')],
                        [sg.InputText(self.settings.get_settings()['size'], key='size')],
                        [sg.HSeparator()],
                        [sg.Text('Auflösung:')],
                        [sg.InputText(self.settings.get_settings()['resolution'], key='resolution')]
                    ],
                    vertical_alignment='top',
                    element_justification='left'
                ),

                sg.VSeparator(),

                sg.Column(
                    [
                        [sg.Text('Sprache:'), sg.Combo(['Deutsch', 'Englisch'], default_value=self.settings.get_settings()['language'], key='language', readonly=True)],
                        [sg.Text('(Erfordert Neustart des Programms)')],
                        [sg.HSeparator()],
                        [sg.Checkbox('Daten bei Start laden', default=self.settings.get_settings()['load_data_on_start'], key='load_data_on_start')],
                    ],
                    vertical_alignment='top',
                    element_justification='left'
                )
            ],
            [sg.HSeparator()],
            [
                sg.Push(),
                sg.Button('Abbrechen', key='cancel_button'),
                sg.Button('Speichern', key='save_button'),
                sg.Push()
            ]
        ]

        return layout
    
    def save_settings(self, values):
        settings = {
            'forecast_length': int(values['forecast_length']),
            'latitude': float(values['latitude']),
            'longitude': float(values['longitude']),
            'source': values['source'],
            'size': float(values['size']),
            'resolution': int(values['resolution']),
            'language': values['language'],
            'load_data_on_start': values['load_data_on_start']
        }

        self.settings.change_settings(settings)
        self.settings.save_settings_to_file('settings.json')
        
        self.change_settings_callback(settings)

        self.settings_gui.close()