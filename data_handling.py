import time
import math
import geopandas
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import os
from datetime import datetime
from settings import Settings
import threading
from helpers import get_file_path_in_bundle


states_map = None
countries_map = None


def check_if_thread_should_stop():
    thread = threading.current_thread()

    return getattr(thread, "do_stop", False)


def retreive_and_handle_data(data_retreiver, data_category, data_dir, log_text, finished_callback, start_date, last_date, lat, lon, size, number_of_size_steps, lm, timezone, interpolate, set_progress):
    global states_map, countries_map

    settings = Settings()
    settings.load_settings_from_file()
    settings = settings.get_settings()

    # calculate the total number of steps
    num_of_hours = (last_date - start_date).total_seconds() / 3600 + 1
    num_of_total_steps = number_of_size_steps ** 2 + num_of_hours + 2 + 3 # (2 = (reading in map data, preparing images), 3 = (in gui.py: calculations finished, deleting old images, scaling images))
    num_of_steps_done = 0

    weather_data = {}
    searched_locations = 0
    lat_size, lon_size = size
    lat_resolution = lat_size / number_of_size_steps
    lon_resolution = lon_size / number_of_size_steps

    # calculate the offset for the latitude and longitude so that the center of the grid is the location
    negative_offset = -number_of_size_steps // 2 + (0.5 if number_of_size_steps % 2 == 0 else 1)

    # check if the thread should stop before continuing calculations/actions
    if check_if_thread_should_stop():
        return

    # iterate over all locations in the grid and get the weather data
    for lat_index in range(number_of_size_steps):
        for lon_index in range(number_of_size_steps):
            # check if the thread should stop before continuing calculations/actions
            if check_if_thread_should_stop():
                return
            
            # calculate the latitude and longitude of the current location
            lat_offset = negative_offset + lat_index
            lon_offset = negative_offset + lon_index
            latitude = lat + (lat_offset * lat_resolution)
            longitude = lon + (lon_offset * lon_resolution)

            latitude = round(latitude, 6)
            longitude = round(longitude, 6)

            searched_locations += 1

            # log the current progress
            log_text(lm.get_string('log.load_weather_at_index_at_pos', replace_dict={
                'lat': latitude,
                'lon': longitude,
                'index': searched_locations,
                'total': number_of_size_steps ** 2
            }))

            # retrieve the weather data for the current location
            data = data_retreiver.get_weather(start_date.isoformat(), last_date.isoformat(), latitude, longitude, timezone, data_category)

            # iterate over the time entries in the data and store the cloud coverage
            for entry in data:
                timestamp = entry['timestamp']
            
                if not timestamp in weather_data:
                    weather_data[timestamp] = {}
            
                # check if there was an error or if the cloud coverage is missing
                if entry['error'] is True or 'value' not in entry:
                    time_info = None
            
                # no problems detected
                else:
                    time_info = entry['value']

                # store the data
                weather_data[timestamp][(latitude, longitude)] = time_info
        
            # set the progress
            num_of_steps_done += 1
            set_progress((num_of_steps_done / num_of_total_steps) * 100)

            # wait for the delay time, and log the waiting time if it is greater than 1 second
            if(data_retreiver.request_delay >= 1):
                log_text(lm.get_string('waiting_delay_time', replace_dict={'time': data_retreiver.request_delay}))
            time.sleep(data_retreiver.request_delay)
    
    # convert the data to a format that returns all locations for a given timestamp
    weather_info_over_time = {}

    for timestamp, locations in weather_data.items():
        # Precompute latitudes to improve efficiency
        latitudes = [round(lat + (negative_offset + lat_index) * lat_resolution, 6) 
                    for lat_index in range(number_of_size_steps)]
        
        # Iterate over all locations and store the data in the correct order
        weather_info_over_time[timestamp] = [
            [info for location, info in locations.items() if location[0] == latitude]
            for latitude in reversed(latitudes)  # Reverse to maintain the original order
        ]

    # check if the thread should stop before continuing calculations/actions
    if check_if_thread_should_stop():
        return

    # remove old images
    for file in os.listdir(data_dir):
        if file.startswith('image_'):
            os.remove(os.path.join(data_dir, file))
    for file in os.listdir(data_dir + '/originals'):
        if file.startswith('image_'):
            os.remove(os.path.join(data_dir + '/originals', file))

    # check if the thread should stop before continuing calculations/actions
    if check_if_thread_should_stop():
        return

    # read the shapefiles if they are not already loaded
    log_text(lm.get_string("log.reading_in_map_data"))

    if states_map is None:
        states_map = geopandas.read_file(get_file_path_in_bundle('shapefiles/ne_10m_admin_1_states_provinces_lines.shp'))
    if countries_map is None:
        countries_map = geopandas.read_file(get_file_path_in_bundle('shapefiles/ne_10m_admin_0_countries.shp'))
    
    # update the progress
    num_of_steps_done += 1
    set_progress((num_of_steps_done / num_of_total_steps) * 100)

    # check if the thread should stop before continuing calculations/actions
    if check_if_thread_should_stop():
        return
    
    log_text(lm.get_string("log.preparing_images"))
    number_of_keys = len(weather_info_over_time.keys())

    # create the labels for the x and y axis
    x_labels = [lon + ((negative_offset + x) * lon_resolution) for x in range(number_of_size_steps)]
    y_labels = [lat + ((negative_offset + y) * lat_resolution) for y in range(number_of_size_steps)]
    x_labels = [round(x, 2) for x in x_labels]
    y_labels = [round(y, 2) for y in y_labels]
    y_labels.reverse()

    # create the color map for the cloud coverage
    value_min_color = settings['color_minimum'].lstrip('#')
    value_max_color = settings['color_maximum'].lstrip('#')
    # --> convert the color values from hex to rgb
    value_min_color = tuple(int(value_min_color[i:i+2], 16)/255 for i in (0, 2, 4))
    value_max_color = tuple(int(value_max_color[i:i+2], 16)/255 for i in (0, 2, 4))

    color_good = np.array([value_min_color[0], value_min_color[1], value_min_color[2], 0.8])
    color_bad = np.array([value_max_color[0], value_max_color[1], value_max_color[2], 0.8])
    color_vector = color_bad - color_good
    colors = [color_good + (color_vector * i) for i in np.linspace(0, 1, 256)]
    cmap = mpl.colors.LinearSegmentedColormap.from_list('custom', colors)

    # create folder if not exists
    os.makedirs(data_dir + '/originals', exist_ok=True)

    # check if the thread should stop before continuing calculations/actions
    if check_if_thread_should_stop():
        return

    # prepare the images
    fig, ax = plt.subplots(figsize=(6,6))
    ax.set_aspect(lon_resolution/lat_resolution)
    countries_map.plot(ax = ax, color='#b8e864', edgecolor='black', zorder=1, aspect=lon_resolution/lat_resolution)
    states_map.plot(ax = ax, color=None, edgecolor='black', linewidth=0.5, zorder=2, aspect=lon_resolution/lat_resolution)

    ax.set_xlabel(lm.get_string("weather_image.label_longitude"))
    ax.set_ylabel(lm.get_string("weather_image.label_latitude"))

    ax.plot(lon, lat, 'ro', markersize=5, zorder=20)
    ax.text(lon + lon_resolution/15, lat + lat_resolution/15, lm.get_string("weather_image.label_position"), zorder=20)

    # update the progress
    num_of_steps_done += 1
    set_progress((num_of_steps_done / num_of_total_steps) * 100)

    # iterate over all images and create them
    for figure_index in range(number_of_keys):
        # check if the thread should stop before continuing calculations/actions
        if check_if_thread_should_stop():
            return

        log_text(lm.get_string('log.creating_image_at_index', replace_dict={
            'index': figure_index + 1,
            'total': number_of_keys
        }))
        
        entry = list(weather_info_over_time.keys())[figure_index]
        data = weather_info_over_time[entry]
        df = pd.DataFrame(data, columns=x_labels, index=y_labels)

        x = df.columns
        y = df.index
        z = df.values

        min_value = data_retreiver.categories[data_category]['min'] if data_retreiver.categories[data_category]['min'] is not None else min([min(row) for row in z])
        max_value = data_retreiver.categories[data_category]['max'] if data_retreiver.categories[data_category]['max'] is not None else max([max(row) for row in z])

        im = ax.imshow(
            z,
            cmap=cmap,
            vmin=min_value,
            vmax=max_value,
            zorder=10,
            aspect=lon_resolution/lat_resolution,
            interpolation='bicubic' if interpolate else 'antialiased',
            extent=[min(x) - lon_resolution/2, max(x) + lon_resolution/2, min(y) - lat_resolution/2, max(y) + lat_resolution/2]
        )

        image_date = datetime.fromisoformat(entry)

        ax.set_title(lm.get_string('weather_image.label_time', replace_dict={
            'day': image_date.day,
            'month': image_date.month,
            'year': image_date.year,
            'hour': str(image_date.hour).rjust(2, '0'),
            'minute': str(image_date.minute).ljust(2, '0')
        }))

        if figure_index == 0:
            ax.set_ylim(min(y) - lat_resolution, max(y) + lat_resolution)
            ax.set_xlim(min(x) - lon_resolution, max(x) + lon_resolution)
            fig.colorbar(
                im,
                ax=ax,
                orientation='vertical',
                label=lm.get_string(f"weather_image.bar_label.{data_retreiver.name}.{data_category}"),
                fraction=0.047*(df.shape[0]/df.shape[1])
            )

        plt.savefig(f'{data_dir}/originals/image_{figure_index}.png', dpi=150, transparent=False, format='png', bbox_inches='tight', pad_inches=0.1)

        im.remove()

        # update the progress
        num_of_steps_done += 1
        set_progress((num_of_steps_done / num_of_total_steps) * 100)

    plt.close(fig)

    # call the callback function
    finished_callback()