import json
from helpers import get_file_path_in_bundle
import PySimpleGUI as sg
import gc # Garbage collector
import pytz


class Locations:
    def __init__(self):
        self.locations: list = None
        self.read_locations_file()


    def add_location(self, location):
        self.locations.append(location)
        self.write_locations_file()


    def get_locations(self):
        return self.locations
    

    def read_locations_file(self):
        with open('locations.json', 'r') as f:
            self.locations = [{
                'id': location['id'],
                'name': location['name'],
                'coordinates': {
                    'latitude': location['coordinates']['lat'],
                    'longitude': location['coordinates']['lng']
                },
                'region': {
                    'size': location['region']['size'],
                    'unit': location['region']['unit']
                },
                'steps': location['steps']
            } for location in json.load(f)]

    
    def write_locations_file(self):
        with open('locations.json', 'w') as f:
            json.dump(self.locations, f, indent=4)


    def find_location_by_name(self, name):
        for location in self.locations:
            if location['name'] == name:
                return location
        
        return None
    

    def get_location_by_id(self, id):
        for location in self.locations:
            if location['id'] == id:
                return location
        
        return None


class LocationGUI:

    def __init__(self, gui, change_settings_callback, language_manager):
        self.main_gui = gui
        self.change_settings_callback = change_settings_callback
        self.lm = language_manager
        self.locations_manager = Locations()

    
    def create_layout(self):
        return [
            [
                sg.Column([
                    [sg.Combo([location['name'] for location in self.locations_manager.get_locations()], key='Locations', size=(20, 5))],
                    [sg.Button(self.lm.get_string("locations_window.add"), key='Add')]
                ]),
                sg.VSeperator(),
                sg.Column([
                    [
                        sg.Input(key='Name', size=(20, 1)),
                        sg.Button(self.lm.get_string("locations_window.delete"), key='Delete')
                    ],
                    [
                        sg.Column([
                            [sg.Text(self.lm.get_string("locations_window.latitude"))],
                            [sg.Input(key='Latitude', size=(10, 1))]
                        ]),
                        sg.Column([
                            [sg.Text(self.lm.get_string("locations_window.longitude"))],
                            [sg.Input(key='Longitude', size=(10, 1))]
                        ])
                    ],
                    [
                        sg.Text(self.lm.get_string("locations_window.size")),
                        sg.Input(key='Size', size=(5, 1)),
                        sg.Combo(['mi', 'km'], key='Unit')
                    ],
                    [
                        sg.Text(self.lm.get_string("locations_window.resolution")),
                        sg.Input(key='Resolution', size=(5, 1))
                    ],
                    [
                        sg.Text(self.lm.get_string("locations_window.timezone")),
                        sg.Combo(pytz.common_timezones, key='Timezone')
                    ],
                    [
                        sg.Button(self.lm.get_string("locations_window.save"), key='Save')
                    ]
                ])
            ]
        ]

    
    def open_locations_window(self):
        layout = self.create_layout()
        window = sg.Window(self.lm.get_string("locations_window.title"), layout, modal=True, icon=get_file_path_in_bundle('./app.ico'))

        while True:
            event, values = window.read()

            if event == sg.WIN_CLOSED:
                break

            if event == 'Add':
                continue

            if event == 'Edit':
                continue

            if event == 'Delete':
                continue


        window.close()
        window = None
        gc.collect()