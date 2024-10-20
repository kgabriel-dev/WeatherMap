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
import tempfile
import time

from helpers import is_update_available, open_update_notification, get_file_path_in_bundle

data_directory = tempfile.TemporaryDirectory()
data_directory_name = data_directory.name
settings = Settings()
settings_gui = None
lm = None

main_window = None

global_log_text = ""
thread = Thread()
thread_blocks = False
number_of_images = 0
screen_factor = 1.0
last_resize_time = datetime.now()
settings_changed = False
progress_in_percent = 100

auto_start_data_retreival = False

update_available_notification = False


# This function is used to set the log text in the GUI
def set_log_text(text):
    global global_log_text
    global_log_text = lm.get_string("log.output_beginning", suffix=': ') + str(text)


def set_progress(progress):
    if main_window is not None and main_window['progress_bar'] is not None:
        main_window['progress_bar'].update(progress)
        
        global progress_in_percent
        progress_in_percent = progress


# This function is used to finish the thread and do the final steps
def finish_thread():
    global global_log_text, thread, number_of_images, screen_factor, thread_blocks
    global_log_text = lm.get_string("log.calculation_finished")
    
    remaining_progress = 100 - progress_in_percent
    set_progress(progress_in_percent + remaining_progress/3)

    set_log_text(lm.get_string("log.deleting_images"))
    for image_name in os.listdir(data_directory_name):
        if image_name.startswith('image_'):
            os.remove(os.path.join(data_directory_name, image_name))

    set_progress(progress_in_percent + remaining_progress/3)
    scale_cloud_images()
    
    set_progress(100)
    set_log_text(lm.get_string("log.finished_all_steps"))
    number_of_images = len([name for name in os.listdir(data_directory_name + '/originals') if name.startswith('image_')])

    thread_blocks = False


def create_layout():
    global screen_factor, settings

    values = settings.get_settings()

    options = [
        sg.Push(),
        sg.Text(lm.get_string("main_window.forecast", suffix=':'), key='forecast_length_text'),
        sg.Input(key='forecast_length', size=(7,1), default_text=str(values['forecast_length'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Combo([], [], key='forecast_category', size=(30,1), readonly=True),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.latitude", suffix=':'), key='latitude_text'),
        sg.Input(key='latitude', size=(7,1), default_text=str(values['latitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.longitude", suffix=':'), key='longitude_text'),
        sg.Input(key='longitude', size=(7,1), default_text=str(values['longitude'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.data_source", suffix=':'), key='source_text'),
        sg.Combo(['OpenMeteo', 'BrightSky (DWD)'], key='source', default_value=str(values['source']), size=(15,1), readonly=True, enable_events=True),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.size", suffix=':'), key='size_text'),
        sg.Input(key='size', size=(6,1), default_text=str(values['size'])),
        sg.Push(),
        sg.VSeparator(),
        sg.Push(),
        sg.Text(lm.get_string("main_window.resolution", suffix=':'), key='resolution_text'),
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
            sg.Checkbox(lm.get_string("main_window.animation"), key='animation_checkbox', default=values['animation_autoplay'], text_color='black'),
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
        [sg.Text(key='log_text'), sg.Push(), sg.ProgressBar(100, orientation='h', size=(50, 20), key='progress_bar', visible=False)]
    ]

    return layout


def change_settings(new_settings_values):
    global settings, settings_changed

    settings.change_settings(new_settings_values)
    settings.save_settings_to_file()

    settings_changed = True


def scale_cloud_images():
    global last_resize_time, number_of_images, thread_blocks

    number_of_images = len([name for name in os.listdir(data_directory_name + '/originals') if name.startswith('image_')])

    scaled_images = 0

    for file_name in os.listdir(data_directory_name + '/originals'):
        if file_name.startswith('image_'):
            set_log_text(lm.get_string("log.scale_image_at_index", replace_dict={'index': str(scaled_images + 1), 'total': str(number_of_images)}))

            image = PIL.Image.open(os.path.join(data_directory_name + '/originals', file_name))
            image = image.resize((int(image.width * screen_factor), int(image.height * screen_factor)), PIL.Image.LANCZOS)
            image.save(os.path.join(data_directory_name, file_name))

            scaled_images += 1
    
    last_resize_time = datetime.now()

    if thread_blocks is True:
        thread_blocks = False

    set_log_text(lm.get_string("log.finished_all_steps"))


def update_texts_of_elements(window, lm):
    # update the texts of most elements
    window['forecast_length_text'].update(lm.get_string("main_window.forecast", suffix=':'))
    window['latitude_text'].update(lm.get_string("main_window.latitude", suffix=':'))
    window['longitude_text'].update(lm.get_string("main_window.longitude", suffix=':'))
    window['source_text'].update(lm.get_string("main_window.data_source", suffix=':'))
    window['size_text'].update(lm.get_string("main_window.size", suffix=':'))
    window['resolution_text'].update(lm.get_string("main_window.resolution", suffix=':'))
    window['calculate_button'].update(lm.get_string("main_window.calc_and_show"))
    window['settings_button'].update(lm.get_string("main_window.settings"))
    window['animation_checkbox'].update(text=lm.get_string("main_window.animation"))


def run_gui():
    global thread, global_log_text, number_of_images, screen_factor, auto_start_data_retreival, last_resize_time, settings_gui, settings, settings_changed, thread_blocks
    global main_window

    number_of_images = len([name for name in os.listdir(data_directory_name + '/originals') if name.startswith('image_')])

    # create the window
    window = sg.Window(lm.get_string("main_window.title"), create_layout(), finalize=True, resizable=True, icon=get_file_path_in_bundle('./app.ico'))
    window.maximize()

    main_window = window

    # bind the configure event of the window to later get the new size of the window
    window.bind('<Configure>', 'Configure')
    # bind the slider event to get the new image index
    window['index_slider'].bind('<ButtonRelease-1>', 'index_slider')

    # set the selection values of the forecast category
    data_retreiver = None
    match(settings.get_settings()['source']):
        case 'BrightSky (DWD)':
            data_retreiver = BrightSky()
        case 'OpenMeteo':
            data_retreiver = OpenMeteo()

    if data_retreiver is not None:
        category_names = [lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{key}") for key in data_retreiver.categories.keys()]
        category_source_and_key = settings.get_settings()['data_category']
        category_name = lm.get_string(f"weather_image.bar_label.{category_source_and_key}")
        window['forecast_category'].update(values=category_names, value=category_name if category_name in category_names else category_names[0])

    # create the settings GUI
    settings_gui = SettingsGUI(window, settings, change_settings, lm)

    image_index = 0
    window_height = window.size[1]
    screen_factor = round((window_height - 30) / 1080, 3)

    last_resize_time = datetime.now()

    # open the update notification window if there is an update available
    if update_available_notification is True:
        open_update_notification(lm)

    last_values = None

    # main event loop of the GUI
    while True:
        event, values = window.read(timeout=500)

        if event == sg.WIN_CLOSED:
            break

        if settings_changed is True:
            settings_changed = False
            settings_values = settings.get_settings()

            window['forecast_length'].update(value=settings_values['forecast_length'])
            window['latitude'].update(value=settings_values['latitude'])
            window['longitude'].update(value=settings_values['longitude'])
            window['source'].update(value=settings_values['source'])
            window['size'].update(value=settings_values['size'])
            window['resolution'].update(value=settings_values['resolution'])
            window['animation_checkbox'].update(value=settings_values['animation_autoplay'])

            # update the entries of the forecast category
            data_retreiver = None

            match(values['source']):
                case 'BrightSky (DWD)':
                    data_retreiver = BrightSky()
                case 'OpenMeteo':
                    data_retreiver = OpenMeteo()

            if data_retreiver is not None:
                category_names = [lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{key}") for key in data_retreiver.categories.keys()]
                category_source_and_key = settings.get_settings()['data_category']
                category_name = lm.get_string(f"weather_image.bar_label.{category_source_and_key}")
                window['forecast_category'].update(values=category_names, value=category_name if category_name in category_names else category_names[0])

            # update the texts of most elements in the window
            update_texts_of_elements(window, lm)

        # check if the window was resized and rescale the images
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

        # check if the animation checkbox is checked and the thread is not blocked
        if values['animation_checkbox'] is True and thread_blocks is False and number_of_images > 0:
            # update the image index and the image
            window['index_slider'].update(range=(0, max(number_of_images - 1, 1)))
        # check if the animation checkbox is unchecked and the thread is not blocked
        elif values['animation_checkbox'] is False and thread_blocks is False and number_of_images > 0:
            # update the image index and the image
            image_index = int(values['index_slider'])
            window['index_slider'].update(range=(0, max(number_of_images - 1, 1)))
            window['forecast_image'].update(filename=f'{data_directory_name}/image_{image_index}.png')

        # a timeout event occured
        if event == sg.TIMEOUT_KEY:
            # update the text of the start/cancel button
            if thread_blocks is True:
                window['calculate_button'].update(lm.get_string("main_window.cancel"))
            else:
                window['calculate_button'].update(lm.get_string("main_window.calc_and_show"))

            # update visibility of the progress bar
            window['progress_bar'].update(visible=thread_blocks)

            # check if the animation checkbox is checked and the thread is not blocked
            # and if so, update the image index and the image
            number_of_images = len([name for name in os.listdir(data_directory_name + '/originals') if name.startswith('image_')])

            if values['animation_checkbox'] is True and thread_blocks is False and number_of_images > 0:
                window['forecast_image'].update(filename=f'{data_directory_name}/image_{image_index}.png')
                window['index_slider'].update(value=image_index)

                image_index = (image_index + 1) % number_of_images

        # check if the user selected a different data source
        if event == 'source':
            data_retreiver = None

            match(values['source']):
                case 'BrightSky (DWD)':
                    data_retreiver = BrightSky()
                case 'OpenMeteo':
                    data_retreiver = OpenMeteo()

            if data_retreiver is not None:
                category_names = [lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{key}") for key in data_retreiver.categories.keys()]
                category_source_and_key = lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{settings.get_settings()['data_category']}")
                category_name = lm.get_string(f"weather_image.bar_label.{category_source_and_key}")

                # check if the old category is still available in the new data source
                old_category_name = last_values['forecast_category']
                old_category_keys = lm.get_keys_by_value(old_category_name, start_dotkey=f"weather_image.bar_label.{data_retreiver.name}")

                if len(old_category_keys) > 0:  # if the old category is still available in the new data source
                    old_category_key = old_category_keys[0].split('.')[-1]

                    new_source_keys = data_retreiver.categories.keys()

                    if old_category_key in new_source_keys:
                        category_name = lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{old_category_key}")

                    # update the forecast category
                    window['forecast_category'].update(values=category_names, value=category_name if category_name in category_names else category_names[0])

                else:   # the new category is not available in the new data source
                    # update the forecast category
                    window['forecast_category'].update(values=category_names, value=category_names[0])

                    # let the combo blink 3 times                    
                    combo = window['forecast_category']

                    for _ in range(3):
                        combo.update(background_color='yellow')
                        window.refresh()
                        time.sleep(0.3)
                        
                        combo.update(background_color='white')
                        window.refresh()
                        time.sleep(0.3)

        # check if the user wants to calculate the data
        if (event == 'calculate_button' or auto_start_data_retreival is True):
            if thread_blocks is True:
                set_log_text(lm.get_string("log.stopping_thread"))
                thread.do_stop = True
                thread.join()

                # delete all images
                for image_name in os.listdir(data_directory_name):
                    if image_name.startswith('image_'):
                        os.remove(os.path.join(data_directory_name, image_name))
                for image_name in os.listdir(data_directory_name + '/originals'):
                    if image_name.startswith('image_'):
                        os.remove(os.path.join(data_directory_name + '/originals', image_name))

                # reset the progress bar
                set_progress(100)

                thread_blocks = False
                set_log_text(lm.get_string("log.stopped_thread"))
            else:
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

                # get the key of the current forecast category by using the last element of the dot-key in the language manager
                forecast_category = lm.get_keys_by_value(values['forecast_category'], start_dotkey=f"weather_image.bar_label.{data_source.name}")[0].split('.')[-1]
                thread = Thread(target=retreive_and_handle_data, args=(data_source, forecast_category, data_directory_name, set_log_text, finish_thread, start_date, last_date, latitude, longitude, (size_km, size_lat, size_lon), resolution, lm, settings.get_settings()['timezone'], settings.get_settings()['interpolation'], set_progress))
                thread_blocks = True

                window['forecast_image'].update(filename=None)
                window['index_slider'].update(range=(0,1), value=0)

                # delete all images
                for image_name in os.listdir(data_directory_name):
                    if image_name.startswith('image_'):
                        os.remove(os.path.join(data_directory_name, image_name))
                for image_name in os.listdir(data_directory_name + '/originals'):
                    if image_name.startswith('image_'):
                        os.remove(os.path.join(data_directory_name + '/originals', image_name))

                # start the thread
                thread.start()

        # check if the user wants to open the settings window
        if event == 'settings_button' and SettingsGUI is not None:
            settings_gui.open_settings_window()

        last_values = values
            

    # wait for the thread to finish
    if thread.is_alive() is True:
        thread.join()

    window.close()
    main_window = None

    # remove old images
    shutil.rmtree(data_directory_name)
    data_directory.cleanup()

    sys.exit(0)


if __name__ == '__main__':
    # remove old images (if there are any, e.g. when the program crashed)
    if os.path.exists(data_directory_name):
        shutil.rmtree(data_directory_name)

    # prepare for starting the program
    os.makedirs(data_directory_name + '/originals', exist_ok=True)

    # read the settings from the settings file, otherwise it uses the default settings
    settings.load_settings_from_file()

    lm = LanguageManager(settings.get_settings()['language'])
    
    auto_start_data_retreival = settings.get_settings()['load_data_on_start']

    args = sys.argv[1:]

    if '--test' in args:
        settings['forecast_length'] = 2
        settings['resolution'] = 2
        settings['size'] = 150.0
        auto_start_data_retreival = True
    
    if settings.get_settings()['update_notification'] is True:
        update_available_notification = is_update_available()
    

    run_gui()