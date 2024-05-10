import time
import math
import geopandas
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import os
from datetime import datetime


def retreive_and_handle_data(data_retreiver, log_text, finished_callback, start_date, last_date, lat, lon, size, number_of_size_steps):
    weather_data = {}
    searched_locations = 0
    lat_size, lon_size = size
    lat_resolution = lat_size / number_of_size_steps
    lon_resolution = lon_size / number_of_size_steps

    lat_lon_ratio = lat_resolution / lon_resolution
    print(lat_lon_ratio)

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
    for file in os.listdir('data'):
        if file.startswith('clouds_'):
            os.remove(os.path.join('data', file))


    log_text("Lese Karte ein...")
    worldmap = geopandas.read_file('./shapefiles/gadm41_DEU_2.shp')
    worldmap.crs = "EPSG:4326"

    number_of_keys = len(clouds_cover_over_time.keys())

    x_labels = [lon + ((negative_offset + x) * lon_resolution) for x in range(number_of_size_steps)]
    y_labels = [lat + ((negative_offset + y) * lat_resolution) for y in range(number_of_size_steps)]
    x_labels = [round(x, 2) for x in x_labels]
    y_labels = [round(y, 2) for y in y_labels]
    y_labels.reverse()

    print(x_labels, y_labels)

    color_clear = np.array([1, 1, 1, 0.8])
    color_clouds = np.array([0, 0, 1, 0.8])
    color_vector = color_clouds - color_clear
    colors = [color_clear + (color_vector * i) for i in np.linspace(0, 1, 256)]
    cmap = mpl.colors.LinearSegmentedColormap.from_list('custom', colors)

    for figure_index in range(number_of_keys):
        log_text(f"Erstelle Wetterbild {figure_index + 1} von {number_of_keys}...")

        entry = list(clouds_cover_over_time.keys())[figure_index]
        data = clouds_cover_over_time[entry]
        
        fig, ax = plt.subplots(figsize=(6,6))
        worldmap.plot(ax = ax, color='#b8e864', edgecolor='black')

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
            vmax=data_retreiver.max_value
        )
        start_date_iso = datetime.fromisoformat(entry)

        ax.set_title(start_date_iso.__format__('%d.%m.%Y, %H:%M Uhr'))
        ax.set_ylim(min(y) - lat_resolution, max(y) + lat_resolution)
        ax.set_xlim(min(x) - lon_resolution, max(x) + lon_resolution)
        fig.colorbar(c, ax=ax, orientation='vertical', label='Bewölkung in %')

        plt.savefig(f'data/clouds_{figure_index}.png', dpi=150, transparent=False, format='png', bbox_inches='tight', pad_inches=0.1)
        plt.close(fig)

    finished_callback()