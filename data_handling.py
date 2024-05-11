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


def retreive_and_handle_data(data_retreiver, data_dir, log_text, finished_callback, start_date, last_date, lat, lon, size, number_of_size_steps):
    weather_data = {}
    searched_locations = 0
    lat_size, lon_size = size
    lat_resolution = lat_size / number_of_size_steps
    lon_resolution = lon_size / number_of_size_steps

    negative_offset = -math.ceil(number_of_size_steps // 2)
    positive_offset = math.ceil(number_of_size_steps // 2)

    for lat_index in range(number_of_size_steps):
        for lon_index in range(number_of_size_steps):
            lat_offset = negative_offset + lat_index
            lon_offset = negative_offset + lon_index

            latitude = lat + (lat_offset * lat_resolution)
            longitude = lon + (lon_offset * lon_resolution)

            latitude = round(latitude, 2)
            longitude = round(longitude, 2)

            searched_locations += 1

            log_text(f"Lade Wetterdaten für ({latitude}, {longitude}) (Pos. {searched_locations} von {number_of_size_steps ** 2})")

            data = data_retreiver.get_weather(start_date.isoformat(), last_date.isoformat(), latitude, longitude)
            
            for entry in data:
                timestamp = entry['timestamp']
                cloud_coverage = entry['cloud_cover']

                if not timestamp in weather_data:
                    weather_data[timestamp] = {}
                
                weather_data[timestamp][(latitude, longitude)] = cloud_coverage
        
            if(data_retreiver.request_delay >= 1):
                log_text(f"Warte {data_retreiver.request_delay} Sekunden...")

            time.sleep(data_retreiver.request_delay)
    
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


    log_text("Lese Karte ein...")

    bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
    states = geopandas.read_file(os.path.join(bundle_dir, 'shapefiles/ne_10m_admin_1_states_provinces_lines.shp'), engine="pyogrio")
    countries = geopandas.read_file(os.path.join(bundle_dir, 'shapefiles/ne_10m_admin_0_countries.shp'), engine="pyogrio")
    
    number_of_keys = len(clouds_cover_over_time.keys())

    x_labels = [lon + ((negative_offset + x) * lon_resolution) for x in range(number_of_size_steps)]
    y_labels = [lat + ((negative_offset + y) * lat_resolution) for y in range(number_of_size_steps)]
    x_labels = [round(x, 2) for x in x_labels]
    y_labels = [round(y, 2) for y in y_labels]
    y_labels.reverse()

    color_clear = np.array([1, 1, 1, 0.8])
    color_clouds = np.array([0, 0, 1, 0.8])
    color_vector = color_clouds - color_clear
    colors = [color_clear + (color_vector * i) for i in np.linspace(0, 1, 256)]
    cmap = mpl.colors.LinearSegmentedColormap.from_list('custom', colors)

    # create folder if not exists
    os.makedirs(data_dir + '/originals', exist_ok=True)

    for figure_index in range(number_of_keys):
        log_text(f"Erstelle Wetterbild {figure_index + 1} von {number_of_keys}...")
        
        fig, ax = plt.subplots(figsize=(6,6))
        ax.set_aspect(lon_resolution/lat_resolution)
        countries.plot(ax = ax, color='#b8e864', edgecolor='black', zorder=1, aspect=lon_resolution/lat_resolution)
        states.plot(ax = ax, color=None, edgecolor='black', linewidth=0.5, zorder=2, aspect=lon_resolution/lat_resolution)

        entry = list(clouds_cover_over_time.keys())[figure_index]
        data = clouds_cover_over_time[entry]
        df = pd.DataFrame(data, columns=x_labels, index=y_labels)

        x = df.columns
        y = df.index
        z = df.values  
        c = ax.pcolormesh(
            x,
            y,
            z,
            cmap=cmap,
            shading='auto',
            vmin=data_retreiver.min_value,
            vmax=data_retreiver.max_value,
            zorder=10
        )
        start_date_iso = datetime.fromisoformat(entry)

        ax.set_title(start_date_iso.__format__('%d.%m.%Y, %H:%M Uhr'))
        ax.set_ylim(min(y) - lat_resolution, max(y) + lat_resolution)
        ax.set_xlim(min(x) - lon_resolution, max(x) + lon_resolution)
        fig.colorbar(c, ax=ax, orientation='vertical', label='Bewölkung in %')

        plt.savefig(f'{data_dir}/originals/clouds_{figure_index}.png', dpi=150, transparent=False, format='png', bbox_inches='tight', pad_inches=0.1)
        plt.close(fig)

    finished_callback()