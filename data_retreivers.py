import requests
from datetime import datetime, timedelta
import math


class BrightSky:

    def __init__(self):
        self.api_url = "https://api.brightsky.dev/weather?date={date}&last_date={last_date}&lat={lat}&lon={lon}&tz={timezone}"
        self.min_value = 0
        self.max_value = 100
        self.request_delay = 0.5
        self.name = "BrightSky"
        self.categories = {
            'cloud_cover': {
                'min': 0,
                'max': 100
            },
            'dew_point': {
                'min': None,
                'max': None
            },
            'precipitation_probability': {
                'min': 0,
                'max': 100
            },
            'pressure_msl': {
                'min': None,
                'max': None
            },
            'relative_humidity': {
                'min': 0,
                'max': 100
            },
            'temperature': {
                'min': None,
                'max': None
            },
            'visibility': {
                'min': None,
                'max': None
            },
            'wind_speed': {
                'min': None,
                'max': None
            }
        }

    
    def get_weather(self, start_date_iso, last_date_iso, lat, lon, timezone, category):
        # reset starting time to given hour
        start_date = datetime.fromisoformat(start_date_iso)
        start_date = start_date.replace(minute=0, second=0, microsecond=0)

        url = self.api_url.format(date=start_date.isoformat(), last_date=last_date_iso, lat=lat, lon=lon, timezone=timezone)
        request = requests.get(url)

        if(request.status_code != 200):
            print(f"Error {request.status_code}")
            print(url)

            last_date = datetime.fromisoformat(last_date_iso)
            hours = math.ceil((last_date - start_date).total_seconds() / 3600)

            forecast = []

            for i in range(hours):
                forecast.append({
                    'error': True,
                    'timestamp': (start_date + timedelta(hours=i)).isoformat()
                })
            
            return forecast

        json = request.json()

        forecast = []

        for entry in json['weather']:
            try:
                forecast.append({
                    'error': False,
                    'timestamp': entry['timestamp'],
                    'value': entry[category]
                })

            except KeyError:
                forecast.append({
                    'error': True,
                    'timestamp': entry['timestamp']
                })

        return forecast


class OpenMeteo:

    def __init__(self):
        self.api_url = "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly={category}&forecast_hours={hours}&timezone={timezone}"
        self.min_value = 0
        self.max_value = 100
        self.request_delay = 0.5
        self.name = "OpenMeteo"
        self.categories = {
            'cloud_cover': {
                'min': 0,
                'max': 100
            },
            'temperature_2m': {
                'min': None,
                'max': None
            },
            'relative_humidity_2m': {
                'min': 0,
                'max': 100
            },
            'cloud_cover_low': {
                'min': 0,
                'max': 100
            },
            'cloud_cover_mid': {
                'min': 0,
                'max': 100
            },
            'cloud_cover_high': {
                'min': 0,
                'max': 100
            },
            'dew_point_2m': {
                'min': None,
                'max': None
            },
            'pressure_msl': {
                'min': None,
                'max': None
            },
            'precipitation': {
                'min': 0,
                'max': None
            },
            'precipitation_probability': {
                'min': 0,
                'max': 100
            },
            'visibility': {
                'min': None,
                'max': None
            }
        }

    def get_weather(self, start_date_iso, last_date_iso, lat, lon, timezone, category):
        start_date = datetime.fromisoformat(start_date_iso)
        last_date = datetime.fromisoformat(last_date_iso)

        hours = math.ceil((last_date - start_date).total_seconds() / 3600) + 1

        url = self.api_url.format(lat=lat, lon=lon, hours=hours, timezone=timezone, category=category)
        request = requests.get(url)

        if(request.status_code != 200):
            print(f"Error: {request.status_code}")
            
            forecast = []

            for i in range(hours):
                forecast.append({
                    'error': True,
                    'timestamp': (start_date + timedelta(hours=i)).isoformat()
                })

            return forecast

        json = request.json()

        forecast = []

        hours = json['hourly']['time']

        for i in range(len(hours)):
            time = datetime.fromisoformat(hours[i])

            try:
                forecast.append({
                    'error': False,
                    'timestamp': time.isoformat(),
                    'value': json['hourly'][category][i]
                })
            
            except KeyError:
                forecast.append({
                    'error': True,
                    'timestamp': time.isoformat()
                })

        return forecast