import json
import PySimpleGUI as sg
from language import LanguageManager
import pytz
import os
from data_retreivers import OpenMeteo, BrightSky
import gc # garbage collector
from helpers import is_update_available, open_update_notification, open_no_update_available_notification, get_file_path_in_bundle


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
            "timezone": "America/New_York",
            "interpolation": False,
            "data_category": "cloud_cover",
            "color_maximum": "#0000ff",
            "color_minimum": "#ffffff",
            "update_notification": True,
            "animation_autoplay": True
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
        
        

    def load_settings_from_file(self, file_path='settings.json'):
        if not os.path.exists(file_path):
            self.save_settings_to_file(file_path)

        with open(file_path, 'r') as file:
            settings = json.load(file)

            # check if all keys are present
            for key in self.settings.keys():
                if key not in settings:
                    print(f"Key '{key}' not found in settings file.")

            self.change_settings(settings)

    
    def save_settings_to_file(self, file_path='settings.json'):
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
        window = sg.Window(self.lm.get_string("settings_window.title"), layout, modal=True, icon=get_file_path_in_bundle('./app.ico'))

        while True:
            event, values = window.read(timeout=250)
            
            # check if the user selected a different data source
            if event == 'source':
                data_retreiver = None

                match(values['source']):
                    case 'BrightSky (DWD)':
                        data_retreiver = BrightSky()
                    case 'OpenMeteo':
                        data_retreiver = OpenMeteo()

                if data_retreiver is not None:
                    category_names = self.get_all_forecast_categories(values['source'])
                    window['forecast_category'].update(values=category_names, value=category_names[0])

            if event == sg.WIN_CLOSED:
                break
            elif event == 'save_button':
                save_values = {'minimum_color': window['color_minimum_preview'].get(), 'maximum_color': window['color_maximum_preview'].get()}
                save_values.update(values)

                self.save_settings(save_values)
                break
            elif event == 'cancel_button':
                break
            elif event == 'update_check':
                if is_update_available():
                    open_update_notification(self.lm)
                else:
                    open_no_update_available_notification(self.lm)
            
            # update color preview every 250ms (timeout value)
            if event == sg.TIMEOUT_KEY:
                max_color_preview = window['color_maximum_preview']
                min_color_preview = window['color_minimum_preview']

                if max_color_preview.get():
                    max_color_preview.update(background_color=max_color_preview.get())
                if min_color_preview.get():
                    min_color_preview.update(background_color=min_color_preview.get())

        window.close()
        layout = None
        window = None
        gc.collect()


    def get_all_forecast_categories(self, source_name):
        data_retreiver = None

        match(source_name):
            case 'BrightSky (DWD)':
                data_retreiver = BrightSky()
            case 'OpenMeteo':
                data_retreiver = OpenMeteo()

        if data_retreiver is not None:
            category_names = [self.lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{key}") for key in data_retreiver.categories.keys()]
            return category_names
        
        return []
    

    def get_forecast_category(self, source_name):
        current_selection_source_and_key = self.settings.get_settings()['data_category']
        all_categories = self.get_all_forecast_categories(source_name)

        if self.lm.get_string(f"weather_image.bar_label.{current_selection_source_and_key}") in all_categories:
            return self.lm.get_string(f"weather_image.bar_label.{current_selection_source_and_key}")
        else:
            return all_categories[0]

    def create_layout(self):
        val_color_maximum = self.settings.get_settings()['color_maximum'] if 'color_maximum' in self.settings.get_settings() else '#0000ff'
        val_color_minimum = self.settings.get_settings()['color_minimum'] if 'color_minimum' in self.settings.get_settings() else '#ffffff'

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
                        [sg.Combo(['OpenMeteo', 'BrightSky (DWD)'], key='source', default_value=str(self.settings.get_settings()['source']), size=(15,1), readonly=True, enable_events=True)],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.default_data_category", suffix=':'))],
                        [sg.Combo(self.get_all_forecast_categories(self.settings.get_settings()['source']), key='forecast_category', default_value=self.get_forecast_category(self.settings.get_settings()['source']), readonly=True, size=(30, 1))],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.size", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['size'], key='size')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.resolution", suffix=':'))],
                        [sg.InputText(self.settings.get_settings()['resolution'], key='resolution')],
                        [sg.HSeparator()],
                        [sg.Checkbox(self.lm.get_string("settings_window.animation_autoplay"), default=self.settings.get_settings()['animation_autoplay'], key='animation_autoplay')]
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
                        [sg.HSeparator()],
                        [sg.Checkbox(self.lm.get_string("settings_window.load_data_at_start"), default=self.settings.get_settings()['load_data_on_start'], key='load_data_on_start')],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.timezone", suffix=':'))],
                        [sg.Combo(pytz.common_timezones, key='timezone', default_value=str(self.settings.get_settings()['timezone']), readonly=True)],
                        [sg.HSeparator()],
                        [sg.Checkbox(self.lm.get_string("settings_window.interpolation"), default=self.settings.get_settings()['interpolation'], key='interpolation')],
                        [sg.Text(self.lm.get_string("settings_window.interpolation_info"), size=(35, 4))],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.color_maximum", suffix=':'))],
                        [
                            sg.ColorChooserButton(self.lm.get_string("settings_window.choose_color"), key='color_maximum', target='color_maximum_preview'),
                            sg.Text(val_color_maximum, visible=True, enable_events=False, key='color_maximum_preview', size=(7, 1), background_color=val_color_maximum)
                        ],
                        [sg.HSeparator()],
                        [sg.Text(self.lm.get_string("settings_window.color_minimum", suffix=':'))],
                        [
                            sg.ColorChooserButton(self.lm.get_string("settings_window.choose_color"), key='color_minimum', target='color_minimum_preview'),
                            sg.Text(val_color_minimum, visible=True, enable_events=False, key='color_minimum_preview', size=(7, 1), background_color=val_color_minimum),
                        ],
                        [sg.HSeparator()],
                        [sg.Checkbox(self.lm.get_string("settings_window.update_notification"), default=self.settings.get_settings()['update_notification'], key='update_notification')],
                        [sg.Button(self.lm.get_string("settings_window.update_check"), key='update_check')]
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
        data_retreiver = None

        match(values['source']):
            case 'BrightSky (DWD)':
                data_retreiver = BrightSky()
            case 'OpenMeteo':
                data_retreiver = OpenMeteo()
        
        if data_retreiver is None:
            data_retreiver = OpenMeteo()

        forecast_category_name = values['forecast_category']

        if forecast_category_name not in self.get_all_forecast_categories(values['source']):
            forecast_category_name = self.get_all_forecast_categories(values['source'])[0]

        forecast_category_keys = self.lm.get_keys_by_value(forecast_category_name, start_dotkey=f"weather_image.bar_label.{data_retreiver.name}")[0].split('.')

        settings = {
            'forecast_length': int(values['forecast_length']),
            'latitude': float(values['latitude']),
            'longitude': float(values['longitude']),
            'source': values['source'],
            'data_category': f"{forecast_category_keys[-2]}.{forecast_category_keys[-1]}",  # e.g. 'OpenMeteo.cloud_cover'
            'size': float(values['size']),
            'resolution': int(values['resolution']),
            'language': LanguageManager.get_language_code_by_name(values['language']),
            'load_data_on_start': values['load_data_on_start'],
            'timezone': values['timezone'],
            'interpolation': values['interpolation'],
            'color_maximum': values['maximum_color'],
            'color_minimum': values['minimum_color'],
            'update_notification': values['update_notification'],
            'animation_autoplay': values['animation_autoplay']
        }

        self.settings.change_settings(settings)
        self.settings.save_settings_to_file('settings.json')
        
        self.change_settings_callback(settings)
        self.lm.set_language(settings['language'])