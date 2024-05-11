import PySimpleGUI as sg
import os
from datetime import datetime, timedelta
import pytz
from data_handling import retreive_and_handle_data
from data_retreivers import BrightSky
from threading import Thread
import math
import PIL.Image
import sys
import shutil


data_directory = 'WeatherMap_Data'

global_log_text = ""
thread = Thread()
number_of_images = 0
screen_factor = 1.0

default_values = {
    'forecast_length': 12,
    'latitude': 54.10,
    'longitude': 12.11,
    'source': 'BrightSky (DWD)',
    'size': 80.0,
    'resolution': 8
}

auto_start_data_retreival = False


def set_log_text(text):
    global global_log_text
    global_log_text = text


def finish_thread():
    global global_log_text, thread, number_of_images, screen_factor
    global_log_text = "Berechnungen abgeschlossen."
    

    set_log_text("Entferne alte Bilder...")
    for image_name in os.listdir(data_directory):
        if image_name.startswith('clouds_'):
            os.remove(os.path.join(data_directory, image_name))

    scale_cloud_images()
    
    set_log_text("Alles erledigt.")
    number_of_images = len([name for name in os.listdir(data_directory) if name.startswith('clouds_')])


def create_layout():
    global screen_factor

    settings = [
        sg.Push(),
        sg.Text("Vorschau (h):"),
        sg.Input(key='forecast_length', size=(7,1), default_text=str(default_values['forecast_length'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text("Breitengrad:"),
        sg.Input(key='latitude', size=(7,1), default_text=str(default_values['latitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text("Längengrad:"),
        sg.Input(key='longitude', size=(7,1), default_text=str(default_values['longitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text("Quelle:"),
        sg.Combo(['BrightSky (DWD)'], key='source', default_value=str(default_values['source']), size=(15,1), readonly=True),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text("Größe (km):"),
        sg.Input(key='size', size=(6,1), default_text=str(default_values['size'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text("Auflösung:"),
        sg.Input(key='resolution', size=(4,1), default_text=str(default_values['resolution'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Button('Berechnen & Anzeigen', key='calculate_button'),
        sg.Push()
    ]

    animation = [
        sg.vbottom([
            sg.Checkbox('Animation', key='animation_checkbox', default=True, text_color='black'),
            sg.Slider(range=(0, max(number_of_images - 1, 1)), orientation='horizontal', key='index_slider')
        ])
    ]

    layout = [
        settings,
        [sg.HSeparator()],
        [sg.VPush()],
        [
            sg.Push(),
            sg.Image(key='forecast_image', size=(801 * screen_factor, 743 * screen_factor)),
            sg.Push()
        ],
        [sg.VPush()],
        [sg.HSeparator()],
        animation,
        [sg.HSeparator()],
        [sg.Text(key='log_text')]
    ]

    return layout


def scale_cloud_images():
    scaled_images = 0

    for image_name in os.listdir(data_directory + '/originals'):
        if image_name.startswith('clouds_'):
            set_log_text(f"Skaliere Bild {scaled_images + 1} von {number_of_images}...")

            image = PIL.Image.open(os.path.join(data_directory + '/originals', image_name))
            image = image.resize((int(image.width * screen_factor), int(image.height * screen_factor)), PIL.Image.LANCZOS)
            image.save(os.path.join(data_directory, image_name))

            scaled_images += 1
    
    set_log_text("Alles erledigt.")

def run_gui():
    global thread, global_log_text, number_of_images, screen_factor, auto_start_data_retreival

    number_of_images = len([name for name in os.listdir(data_directory) if name.startswith('clouds_')])

    window = sg.Window('WeatherMap', create_layout(), finalize=True, resizable=True)
    window.maximize()

    window.bind('<Configure>', 'Configure')
    window['index_slider'].bind('<ButtonRelease-1>', 'index_slider')

    image_index = 0
    window_height = window.size[1]

    last_resize_time = datetime.now()

    while True:
        event, values = window.read(timeout=500)

        if values is None:
            break

        if event == 'Configure' and thread.is_alive() is False:
            now_time = datetime.now()

            if (now_time - last_resize_time).total_seconds() > 1:
                window_height = window.size[1]
                
                new_screen_factor = round((window_height - 30) / 1080, 3)
                
                if screen_factor != new_screen_factor:
                    screen_factor = new_screen_factor

                    thread = Thread(target=scale_cloud_images)
                    thread.start()

                    last_resize_time = now_time

        window['log_text'].update(global_log_text)

        if values['animation_checkbox'] is True and thread.is_alive() is False and number_of_images > 0:
            window['index_slider'].update(range=(0, max(number_of_images - 1, 1)))
        elif values['animation_checkbox'] is False and thread.is_alive() is False:
            image_index = int(values['index_slider'])
            window['forecast_image'].update(filename=f'{data_directory}/clouds_{image_index}.png')

        if event == sg.WIN_CLOSED:
            break

        if event == sg.TIMEOUT_KEY:
            if values['animation_checkbox'] is True and thread.is_alive() is False and number_of_images > 0:
                window['forecast_image'].update(filename=f'{data_directory}/clouds_{image_index}.png')
                window['index_slider'].update(value=image_index)

                image_index = (image_index + 1) % number_of_images

        if (event == 'calculate_button' or auto_start_data_retreival is True) and thread.is_alive() is False:
            auto_start_data_retreival = False
            forecast_length = int(values['forecast_length'])
            longitude = float(values['longitude'])
            latitude = float(values['latitude'])
            
            # convert size from km to degrees
            size_km = float(values['size'])
            size_lat = size_km / 110.57
            size_lon = size_km / (111.32 * math.cos(math.radians(latitude)))

            resolution = int(values['resolution'])

            start_date = datetime.now(pytz.timezone('Europe/Berlin'))
            last_date = start_date + timedelta(hours=forecast_length)

            if values['source'] == 'BrightSky (DWD)':
                thread = Thread(target=retreive_and_handle_data, args=(BrightSky(), data_directory, set_log_text, finish_thread, start_date, last_date, latitude, longitude, (size_lat, size_lon), resolution))

                window['forecast_image'].update(filename=None)
                window['index_slider'].update(range=(0,1), value=0)

                thread.start()

    # wait for the thread to finish
    if thread is not None:
        thread.join()

    window.close()

    # remove old images
    shutil.rmtree(data_directory)


if __name__ == '__main__':
    # prepare for starting the program
    os.makedirs(data_directory + '/originals', exist_ok=True)

    args = sys.argv[1:]

    if '--test' in args:
        default_values['forecast_length'] = 2
        default_values['resolution'] = 3
        default_values['size'] = 90.0
        auto_start_data_retreival = True

    run_gui()