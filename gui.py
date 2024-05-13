import PySimpleGUI as sg
import os
from datetime import datetime, timedelta
import pytz
from data_handling import retreive_and_handle_data
from data_retreivers import BrightSky, OpenMeteo
from threading import Thread
import math
import PIL.Image
import sys
import shutil
from settings import Settings, SettingsGUI
from language import LanguageManager


data_directory = 'WeatherMap_Data'
settings_path = 'settings.json'
settings = Settings()
settings_gui = None
lm = None

global_log_text = ""
thread = Thread()
thread_blocks = False
number_of_images = 0
screen_factor = 1.0
last_resize_time = datetime.now()
settings_changed = False

auto_start_data_retreival = False


def set_log_text(text):
    global global_log_text
    global_log_text = lm.get_string("log.output_beginning", suffix=': ') + str(text)


def finish_thread():
    global global_log_text, thread, number_of_images, screen_factor, thread_blocks
    global_log_text = lm.get_string("log.calculation_finished")
    

    set_log_text(lm.get_string("log.deleting_images"))
    for image_name in os.listdir(data_directory):
        if image_name.startswith('clouds_'):
            os.remove(os.path.join(data_directory, image_name))

    scale_cloud_images()
    
    set_log_text(lm.get_string("log.finished_all_steps"))
    number_of_images = len([name for name in os.listdir(data_directory + '/originals') if name.startswith('clouds_')])

    thread_blocks = False


def create_layout():
    global screen_factor, settings

    values = settings.get_settings()

    options = [
        sg.Push(),
        sg.Text(lm.get_string("main_window.forecast", suffix=':')),
        sg.Input(key='forecast_length', size=(7,1), default_text=str(values['forecast_length'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.latitude", suffix=':')),
        sg.Input(key='latitude', size=(7,1), default_text=str(values['latitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.longitude", suffix=':')),
        sg.Input(key='longitude', size=(7,1), default_text=str(values['longitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.data_source", suffix=':')),
        sg.Combo(['OpenMeteo', 'BrightSky (DWD)'], key='source', default_value=str(values['source']), size=(15,1), readonly=True),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.size", suffix=':')),
        sg.Input(key='size', size=(6,1), default_text=str(values['size'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.resolution", suffix=':')),
        sg.Input(key='resolution', size=(4,1), default_text=str(values['resolution'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Button(lm.get_string("main_window.calc_and_show"), key='calculate_button'),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Button(lm.get_string("main_window.settings"), key='settings_button'),
        sg.Push()
    ]

    animation = [
        sg.vbottom([
            sg.Checkbox(lm.get_string("main_window.animation"), key='animation_checkbox', default=True, text_color='black'),
            sg.Slider(range=(0, max(number_of_images - 1, 1)), orientation='horizontal', key='index_slider')
        ])
    ]

    layout = [
        options,
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


def change_settings(new_settings_values):
    global settings, settings_changed

    settings.change_settings(new_settings_values)
    settings.save_settings_to_file(settings_path)

    settings_changed = True


def scale_cloud_images():
    global last_resize_time, number_of_images, thread_blocks

    number_of_images = len([name for name in os.listdir(data_directory + '/originals') if name.startswith('clouds_')])

    scaled_images = 0

    for file_name in os.listdir(data_directory + '/originals'):
        if file_name.startswith('clouds_'):
            set_log_text(lm.get_string("log.scale_image_at_index", replace_dict={'index': str(scaled_images + 1), 'total': str(number_of_images)}))

            image = PIL.Image.open(os.path.join(data_directory + '/originals', file_name))
            image = image.resize((int(image.width * screen_factor), int(image.height * screen_factor)), PIL.Image.LANCZOS)
            image.save(os.path.join(data_directory, file_name))

            scaled_images += 1
    
    last_resize_time = datetime.now()

    if thread_blocks is True:
        thread_blocks = False

    set_log_text(lm.get_string("log.finished_all_steps"))

def run_gui():
    global thread, global_log_text, number_of_images, screen_factor, auto_start_data_retreival, last_resize_time, settings_gui, settings, settings_changed, thread_blocks

    number_of_images = len([name for name in os.listdir(data_directory + '/originals') if name.startswith('clouds_')])

    window = sg.Window(lm.get_string("main_window.title"), create_layout(), finalize=True, resizable=True)
    window.maximize()

    window.bind('<Configure>', 'Configure')
    window['index_slider'].bind('<ButtonRelease-1>', 'index_slider')

    settings_gui = SettingsGUI(window, settings, change_settings, lm)

    image_index = 0
    window_height = window.size[1]
    screen_factor = round((window_height - 30) / 1080, 3)

    last_resize_time = datetime.now()

    while True:
        event, values = window.read(timeout=500)

        if event == sg.WIN_CLOSED:
            break

        if settings_changed is True:
            settings_changed = False
            settings_values = settings.get_settings()

            print(settings_values)

            window['forecast_length'].update(value=settings_values['forecast_length'])
            window['latitude'].update(value=settings_values['latitude'])
            window['longitude'].update(value=settings_values['longitude'])
            window['source'].update(value=settings_values['source'])
            window['size'].update(value=settings_values['size'])
            window['resolution'].update(value=settings_values['resolution'])

        if event == 'Configure' and thread_blocks is False and (datetime.now() - last_resize_time).total_seconds() > 1:
            window_height = window.size[1]
            
            new_screen_factor = round((window_height - 30) / 1080, 3)
            
            if screen_factor != new_screen_factor:
                try:
                    window['forecast_image'].update(size=(int(912 * new_screen_factor), int(752 * new_screen_factor)))

                    screen_factor = new_screen_factor

                    thread = Thread(target=scale_cloud_images)
                    thread_blocks = True
                    thread.start()
                
                except FileNotFoundError:
                    print("Cannot rescale images, because there are no images.")
                    pass

        window['log_text'].update(global_log_text)

        if values['animation_checkbox'] is True and thread_blocks is False and number_of_images > 0:
            window['index_slider'].update(range=(0, max(number_of_images - 1, 1)))
        elif values['animation_checkbox'] is False and thread_blocks is False:
            image_index = int(values['index_slider'])
            window['forecast_image'].update(filename=f'{data_directory}/clouds_{image_index}.png')

        if event == sg.TIMEOUT_KEY:
            number_of_images = len([name for name in os.listdir(data_directory + '/originals') if name.startswith('clouds_')])

            if values['animation_checkbox'] is True and thread_blocks is False and number_of_images > 0:
                window['forecast_image'].update(filename=f'{data_directory}/clouds_{image_index}.png')
                window['index_slider'].update(value=image_index)

                image_index = (image_index + 1) % number_of_images

        if (event == 'calculate_button' or auto_start_data_retreival is True) and thread_blocks is False:
            auto_start_data_retreival = False
            forecast_length = int(values['forecast_length'])
            longitude = float(values['longitude'])
            latitude = float(values['latitude'])
            resolution = int(values['resolution'])
            
            # convert size from km to degrees
            size_km = float(values['size'])
            size_lat = size_km / 110.57
            size_lon = size_km / (111.32 * math.cos(math.radians(latitude)))

            start_date = datetime.now(pytz.timezone(settings.get_settings()['timezone']))
            last_date = start_date + timedelta(hours=forecast_length)

            data_source = None
            match(values['source']):
                case 'BrightSky (DWD)':
                    data_source = BrightSky()
                case 'OpenMeteo':
                    data_source = OpenMeteo()

            thread = Thread(target=retreive_and_handle_data, args=(data_source, data_directory, set_log_text, finish_thread, start_date, last_date, latitude, longitude, (size_lat, size_lon), resolution, lm, settings.get_settings()['timezone']))
            thread_blocks = True

            window['forecast_image'].update(filename=None)
            window['index_slider'].update(range=(0,1), value=0)

            # delete all images
            for image_name in os.listdir(data_directory):
                if image_name.startswith('clouds_'):
                    os.remove(os.path.join(data_directory, image_name))
            for image_name in os.listdir(data_directory + '/originals'):
                if image_name.startswith('clouds_'):
                    os.remove(os.path.join(data_directory + '/originals', image_name))

            # start the thread
            thread.start()

        if event == 'settings_button' and SettingsGUI is not None:
            settings_gui.open_settings_window()
            

    # wait for the thread to finish
    if thread.is_alive() is True:
        thread.join()

    window.close()

    # remove old images
    shutil.rmtree(data_directory)


if __name__ == '__main__':
    # remove old images (if there are any, e.g. when the program crashed)
    if os.path.exists(data_directory):
        shutil.rmtree(data_directory)

    # prepare for starting the program
    os.makedirs(data_directory + '/originals', exist_ok=True)

    # read the settings from the settings file, otherwise it uses the default settings
    settings.load_settings_from_file(settings_path)

    lm = LanguageManager(settings.get_settings()['language'] or 'en-US')
    
    auto_start_data_retreival = settings.get_settings()['load_data_on_start']

    args = sys.argv[1:]

    if '--test' in args:
        settings['forecast_length'] = 2
        settings['resolution'] = 2
        settings['size'] = 150.0
        auto_start_data_retreival = True

    run_gui()