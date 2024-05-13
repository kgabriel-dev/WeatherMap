import json
import PySimpleGUI as sg
from language import LanguageManager
import pytz
import os


class Settings:

    def __init__(self):
        self.settings = {
            "forecast_length": 12,
            "latitude": 40.73,
            "longitude": -73.94,
            "source": "OpenMeteo",
            "size": 100.0,
            "resolution": 5,
            "language": "en-US",
            "load_data_on_start": False,
            "timezone": "America/New_York"
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
        if not os.path.exists(file_path):
            self.save_settings_to_file(file_path)

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

    def __init__(self, gui, settings, change_settings_callback, language_manager):
        self.main_gui = gui
        self.settings = settings
        self.change_settings_callback = change_settings_callback
        self.lm = language_manager

    def open_settings_window(self):
        layout = self.create_layout()
        window = sg.Window(self.lm.get_string("settings_window.title"), layout, modal=True, finalize=True)

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
                        [sg.Text(self.lm.get_string("settings_window.forecast", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['forecast_length'], key='forecast_length')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.latitude", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['latitude'], key='latitude')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.longitude", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['longitude'], key='longitude')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.data_source", suffix=':'))],
                        [sg.Combo(['OpenMeteo', 'BrightSky (DWD)'], key='source', default_value=str(self.settings.get_settings()['source']), size=(15,1), readonly=True)],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.size", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['size'], key='size')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.resolution", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['resolution'], key='resolution')]
                    ],
                    vertical_alignment='top',
                    element_justification='left'
                ),

                sg.VSeparator(),

                sg.Column(
                    [
                        [
                            sg.Text(self.lm.get_string("settings_window.language", suffix=':')),
                            sg.Combo(
                                LanguageManager.get_supported_language_names(),
                                default_value=LanguageManager.get_language_name_by_code(self.settings.get_settings()['language']),
                                key='language',
                                readonly=True
                            )
                        ],
                        [sg.Text(self.lm.get_string("settings_window.requires_restart"))],
                        [sg.HSeparator()],
                        [sg.Checkbox(self.lm.get_string("settings_window.load_data_at_start"), default=self.settings.get_settings()['load_data_on_start'], key='load_data_on_start')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.timezone", suffix=':'))],
                        [sg.Combo(pytz.common_timezones, key='timezone', default_value=str(self.settings.get_settings()['timezone']), readonly=True)]
                    ],
                    vertical_alignment='top',
                    element_justification='left'
                )
            ],
            [sg.HSeparator()],
            [
                sg.Push(),
                sg.Button(self.lm.get_string("settings_window.cancel"), key='cancel_button'),
                sg.Button(self.lm.get_string("settings_window.save"), key='save_button'),
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
            'language': LanguageManager.get_language_code_by_name(values['language']),
            'load_data_on_start': values['load_data_on_start'],
            'timezone': values['timezone']
        }

        self.settings.change_settings(settings)
        self.settings.save_settings_to_file('settings.json')
        
        self.change_settings_callback(settings)

        self.settings_gui.close()