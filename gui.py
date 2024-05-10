import PySimpleGUI as sg
import os
from datetime import datetime, timedelta
from data_handling import retreive_and_handle_data
from data_retreivers import BrightSky, ClearOutside
from threading import Thread


global_log_text = ""
thread = None
number_of_images = 0


def set_log_text(text):
    global global_log_text
    global_log_text = text


def finish_thread():
    global global_log_text, thread, number_of_images
    global_log_text = "Berechnungen abgeschlossen."
    thread = None
    number_of_images = len([name for name in os.listdir('data') if name.startswith('clouds_')])


def run_gui():
    global thread, global_log_text, number_of_images

    number_of_images = len([name for name in os.listdir('data') if name.startswith('clouds_')])
    print(f"Number of images: {number_of_images}", max(number_of_images - 1, 0))

    layout = [
        [
            sg.Text("Stunden:"),
            sg.Input(key='forecast_length', size=(7,1), default_text='12'),
            sg.VSeparator(),
            sg.Text("Breitengrad:"),
            sg.Input(key='latitude', size=(7,1), default_text='54.10'),
            sg.VSeparator(),
            sg.Text("Längengrad:"),
            sg.Input(key='longitude', size=(7,1), default_text='12.11'),
            sg.VSeparator(),
            sg.Text("Quelle:"),
            sg.Combo(['BrightSky (DWD)', 'ClearOutside'], key='source', default_value='BrightSky (DWD)', size=(15,1), readonly=True),
            sg.VSeparator(),
            sg.Text("Größe:"),
            sg.Input(key='size', size=(6,1), default_text='0.5'),
            sg.VSeparator(),
            sg.Text("Auflösung:"),
            sg.Input(key='resolution', size=(4,1), default_text='0.1'),
            sg.VSeparator(),
            sg.Button('Berechnen & Anzeigen', key='calculate_button'),
        ],
        [sg.HSeparator()],
        [sg.Column([[sg.Image(key='forecast_image', size=(801, 743))]], justification='center')],
        [sg.HSeparator()],
        [sg.vbottom([
            sg.Checkbox('Animation', key='animation_checkbox', default=True, text_color='black'),
            sg.Slider(range=(0, max(number_of_images - 1, 1)), orientation='horizontal', key='index_slider')
        ])],
        [sg.HSeparator()],
        [sg.Text(key='log_text')]
    ]

    window = sg.Window('WeatherMap', layout, finalize=True)
    window['index_slider'].bind('<ButtonRelease-1>', 'index_slider')

    image_index = 0

    while True:
        event, values = window.read(timeout=500)

        if values is None:
            break

        window['log_text'].update(global_log_text)

        if values['animation_checkbox'] is True and thread is None:
            window['index_slider'].update(range=(0, max(number_of_images - 1, 1)))
        elif values['animation_checkbox'] is False and thread is None:
            image_index = int(values['index_slider'])
            window['forecast_image'].update(filename=f'data/clouds_{image_index}.png')

        if event == sg.WIN_CLOSED:
            break

        if event == sg.TIMEOUT_KEY:
            if values['animation_checkbox'] is True and thread is None and number_of_images > 0:
                window['forecast_image'].update(filename=f'data/clouds_{image_index}.png')
                window['index_slider'].update(value=image_index)

                image_index = (image_index + 1) % number_of_images

        if event == 'calculate_button' and thread is None:
            if thread is None:
                forecast_length = int(values['forecast_length'])
                longitude = float(values['longitude'])
                latitude = float(values['latitude'])
                resolution = float(values['resolution'])
                size = float(values['size'])

                start_date = datetime.now()
                last_date = start_date + timedelta(hours=forecast_length)

                if values['source'] == 'BrightSky (DWD)':
                    thread = Thread(target=retreive_and_handle_data, args=(BrightSky(), set_log_text, finish_thread, start_date, last_date, latitude, longitude, size, resolution))

                    window['forecast_image'].update(filename=None, size=(801, 743))
                    window['index_slider'].update(range=(0,1), value=0)

                    thread.start()
                elif values['source'] == 'ClearOutside':
                    thread = Thread(target=retreive_and_handle_data, args=(ClearOutside(), set_log_text, finish_thread, start_date, last_date, latitude, longitude, size, resolution))
                    thread.start()

    # wait for the thread to finish
    if thread is not None:
        thread.join()

    window.close()

    # remove old images
    for file in os.listdir('data'):
        if file.startswith('clouds_'):
            os.remove(os.path.join('data', file))


if __name__ == '__main__':
    run_gui()