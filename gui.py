import PySimpleGUI as sg
import os
from datetime import datetime, timedelta
from data_handling import retreive_and_handle_data
from data_retreivers import BrightSky, ClearOutside


def set_log_text(text):
    window['log_text'].update(value=text)


number_of_images = len([name for name in os.listdir('data') if name.startswith('clouds_')])

layout = [
    [
        sg.Text("Stunden:"),
        sg.Input(key='forecast_length', size=(7,1), default_text='12'),
        sg.VSeparator(),
        sg.Text("Längengrad:"),
        sg.Input(key='longitude', size=(7,1), default_text='12.11'),
        sg.VSeparator(),
        sg.Text("Breitengrad:"),
        sg.Input(key='latitude', size=(7,1), default_text='54.10'),
        sg.VSeparator(),
        sg.Text("Quelle:"),
        sg.Combo(['BrightSky (DWD)', 'ClearOutside'], key='source', default_value='BrightSky (DWD)', size=(15,1), readonly=True),
        sg.VSeparator(),
        sg.Text("Größe:"),
        sg.Input(key='size', size=(6,1), default_text='0.4'),
        sg.VSeparator(),
        sg.Text("Auflösung:"),
        sg.Input(key='resolution', size=(4,1), default_text='0.1'),
        sg.VSeparator(),
        sg.Button('Berechnen & Anzeigen', key='calculate_button'),
    ],
    [sg.HSeparator()],
    [sg.Image(key='forecast_image')],
    [sg.HSeparator()],
    [
        sg.Checkbox('Animation', key='animation_checkbox', default=True, text_color='black'),
        sg.Slider((1, number_of_images), orientation='horizontal', key='index_slider')
    ],
    [sg.HSeparator()],
    [sg.Text(key='log_text')]
]

window = sg.Window('Clouds over time', layout, finalize=True)

image_index = 0

while True:
    event, values = window.read(timeout=500)

    if event == sg.WIN_CLOSED:
        break

    if event == sg.TIMEOUT_KEY:
        if number_of_images > 0:
            if values['animation_checkbox']:
                window['forecast_image'].update(filename=f'data/clouds_{image_index}.png')
                window['index_slider'].update(value=image_index + 1)

                image_index = (image_index + 1) % number_of_images
            else:
                image_index = int(values['index_slider'] - 1)
                window['forecast_image'].update(filename=f'data/clouds_{image_index}.png')

    if event == 'index_slider' and number_of_images > 0:
        image_index = int(values['index_slider'] - 1)
        window['forecast_image'].update(filename=f'data/clouds_{image_index}.png')

    if event == 'calculate_button':
        forecast_length = int(values['forecast_length'])
        longitude = float(values['longitude'])
        latitude = float(values['latitude'])
        resolution = float(values['resolution'])
        size = float(values['size'])

        start_date = datetime.now()
        last_date = start_date + timedelta(hours=forecast_length)

        window['forecast_image'].update(filename=None)
        window['index_slider'].update(range=(1, number_of_images), value=1, disabled=True)
        window['animation_checkbox'].update(value=False, text='Animation', disabled=True)

        if values['source'] == 'BrightSky (DWD)':
            retreive_and_handle_data(BrightSky(), set_log_text, start_date, last_date, latitude, longitude, size, resolution)
            window['index_slider'].update(range=(1, number_of_images), value=1, disabled=False)
            window['animation_checkbox'].update(value=True, text='Animation', disabled=False)
        elif values['source'] == 'ClearOutside':
            retreive_and_handle_data(ClearOutside(), set_log_text, start_date, last_date, latitude, longitude, size, resolution)
            window['index_slider'].update(range=(1, number_of_images), value=1, disabled=False)
            window['animation_checkbox'].update(value=True, text='Animation', disabled=False)

window.close()