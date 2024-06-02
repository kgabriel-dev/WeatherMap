import time
import math
import geopandas
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import os
from datetime import datetime
import sys
from scipy.interpolate import LinearNDInterpolator


states_map = None
countries_map = None

def retreive_and_handle_data(data_retreiver, data_dir, log_text, finished_callback, start_date, last_date, lat, lon, size, number_of_size_steps, lm, timezone):
    global states_map, countries_map

    weather_data = {}
    searched_locations = 0
    lat_size, lon_size = size
    lat_resolution = lat_size / number_of_size_steps
    lon_resolution = lon_size / number_of_size_steps

    negative_offset = -math.ceil(number_of_size_steps // 2)

    # iterate over all locations in the grid and get the weather data
    for lat_index in range(number_of_size_steps):
        for lon_index in range(number_of_size_steps):
            # calculate the latitude and longitude of the current location
            lat_offset = negative_offset + lat_index
            lon_offset = negative_offset + lon_index
            latitude = lat + (lat_offset * lat_resolution)
            longitude = lon + (lon_offset * lon_resolution)
            latitude = round(latitude, 2)
            longitude = round(longitude, 2)

            searched_locations += 1

            # log the current progress
            log_text(lm.get_string('log.load_weather_at_index_at_pos', replace_dict={
                'lat': latitude,
                'lon': longitude,
                'index': searched_locations,
                'total': number_of_size_steps ** 2
            }))

            # retrieve the weather data for the current location
            data = data_retreiver.get_weather(start_date.isoformat(), last_date.isoformat(), latitude, longitude, timezone)

            # iterate over the time entries in the data and store the cloud coverage
            for entry in data:
                timestamp = entry['timestamp']

                if not timestamp in weather_data:
                    weather_data[timestamp] = {}

                # check if there was an error or if the cloud coverage is missing
                if entry['error'] is True or 'cloud_cover' not in entry:
                    weather_data[timestamp][(latitude, longitude)] = None
                    continue

                # no problems detected
                cloud_coverage = entry['cloud_cover']
                weather_data[timestamp][(latitude, longitude)] = cloud_coverage
        
            # wait for the delay time, and log the waiting time if it is greater than 1 second
            if(data_retreiver.request_delay >= 1):
                log_text(lm.get_string('waiting_delay_time', replace_dict={'time': data_retreiver.request_delay}))

            time.sleep(data_retreiver.request_delay)
    
    # convert the data to a format that returns all locations for a given timestamp
    clouds_cover_over_time = {}

    for timestamp in weather_data:
        clouds_cover_over_time[timestamp] = []

        for lat_index in range(number_of_size_steps):
            lat_offset = negative_offset + lat_index
            latitude = lat + (lat_offset * lat_resolution)
            latitude = round(latitude, 2)

            clouds_cover_over_time[timestamp].insert(0, [clouds for location, clouds in weather_data[timestamp].items() if location[0] == latitude])

    # remove old images
    for file in os.listdir(data_dir):
        if file.startswith('clouds_'):
            os.remove(os.path.join(data_dir, file))
    for file in os.listdir(data_dir + '/originals'):
        if file.startswith('clouds_'):
            os.remove(os.path.join(data_dir + '/originals', file))

    # read the shapefiles if they are not already loaded
    log_text(lm.get_string("log.reading_in_map_data"))
    bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))

    if states_map is None:
        states_map = geopandas.read_file(os.path.join(bundle_dir, 'shapefiles/ne_10m_admin_1_states_provinces_lines.shp'))
    if countries_map is None:
        countries_map = geopandas.read_file(os.path.join(bundle_dir, 'shapefiles/ne_10m_admin_0_countries.shp'))
    

    log_text(lm.get_string("log.preparing_images"))
    number_of_keys = len(clouds_cover_over_time.keys())

    # create the labels for the x and y axis
    x_labels = [lon + ((negative_offset + x) * lon_resolution) for x in range(number_of_size_steps)]
    y_labels = [lat + ((negative_offset + y) * lat_resolution) for y in range(number_of_size_steps)]
    x_labels = [round(x, 2) for x in x_labels]
    y_labels = [round(y, 2) for y in y_labels]
    y_labels.reverse()

    # create the color map for the cloud coverage
    color_clear = np.array([1, 1, 1, 0.8])
    color_clouds = np.array([0, 0, 1, 0.8])
    color_vector = color_clouds - color_clear
    colors = [color_clear + (color_vector * i) for i in np.linspace(0, 1, 256)]
    cmap = mpl.colors.LinearSegmentedColormap.from_list('custom', colors)

    # create folder if not exists
    os.makedirs(data_dir + '/originals', exist_ok=True)

    # prepare the images
    fig, ax = plt.subplots(figsize=(6,6))
    ax.set_aspect(lon_resolution/lat_resolution)
    countries_map.plot(ax = ax, color='#b8e864', edgecolor='black', zorder=1, aspect=lon_resolution/lat_resolution)
    states_map.plot(ax = ax, color=None, edgecolor='black', linewidth=0.5, zorder=2, aspect=lon_resolution/lat_resolution)

    ax.set_xlabel(lm.get_string("weather_image.label_longitude"))
    ax.set_ylabel(lm.get_string("weather_image.label_latitude"))

    ax.plot(lon, lat, 'ro', markersize=5, zorder=20)
    ax.text(lon + lon_resolution/15, lat + lat_resolution/15, lm.get_string("weather_image.label_position"), zorder=20)

    # iterate over all images and create them
    for figure_index in range(number_of_keys):
        log_text(lm.get_string('log.creating_image_at_index', replace_dict={
            'index': figure_index + 1,
            'total': number_of_keys
        }))
        
        entry = list(clouds_cover_over_time.keys())[figure_index]
        data = clouds_cover_over_time[entry]
        df = pd.DataFrame(data, columns=x_labels, index=y_labels)

        cartcoord = [(x, y) for x in x_labels for y in y_labels]
        print(cartcoord)
        print(df.values.flatten())

        X = np.linspace(min(x_labels), max(x_labels))
        Y = np.linspace(min(y_labels), max(y_labels))
        X, Y = np.meshgrid(X, Y)

        interp_data = LinearNDInterpolator(cartcoord, df.values.flatten())
        interp_df = pd.DataFrame(interp_data(X, Y), columns=X[0], index=Y[:,0])

        x = interp_df.columns
        y = interp_df.index
        z = interp_df.values  
        cmesh = ax.pcolormesh(
            x,
            y,
            z,
            cmap=cmap,
            shading='auto',
            vmin=data_retreiver.min_value,
            vmax=data_retreiver.max_value,
            zorder=10
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
                cmesh,
                ax=ax,
                orientation='vertical',
                label=lm.get_string("weather_image.label_weather"),
                fraction=0.047*(interp_df.shape[0]/interp_df.shape[1])
            )

        plt.savefig(f'{data_dir}/originals/clouds_{figure_index}.png', dpi=150, transparent=False, format='png', bbox_inches='tight', pad_inches=0.1)

        cmesh.remove()

    plt.close(fig)
    
    # call the callback function
    finished_callback()