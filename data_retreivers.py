import requests
from datetime import datetime, timedelta
import math
import pprint
import pytz


class BrightSky:

    def __init__(self):
        self.api_url = "https://api.brightsky.dev/weather?date={date}&last_date={last_date}&lat={lat}&lon={lon}&tz={timezone}"
        self.min_value = 0
        self.max_value = 100
        self.request_delay = 0.5

    
    def get_weather(self, start_date_iso, last_date_iso, lat, lon, timezone):
        # reset starting time to given hour
        start_date = datetime.fromisoformat(start_date_iso)
        start_date = start_date.replace(minute=0, second=0, microsecond=0)

        url = self.api_url.format(date=start_date.isoformat(), last_date=last_date_iso, lat=lat, lon=lon, timezone=timezone)
        
        request = requests.get(url)

        if(request.status_code != 200):
            print(f"Error: {request.status_code}")

            last_date = datetime.fromisoformat(last_date_iso)
            hours = math.ceil((last_date - start_date).total_seconds() / 3600) + 1

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
                    'cloud_cover': entry['cloud_cover']
                })

            except KeyError:
                forecast.append({
                    'error': True,
                    'timestamp': entry['timestamp']
                })

        return forecast


class OpenMeteo:

    def __init__(self):
        self.api_url = "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=cloud_cover&forecast_hours={hours}&timezone={timezone}"
        self.min_value = 0
        self.max_value = 100
        self.request_delay = 0.5

    def get_weather(self, start_date_iso, last_date_iso, lat, lon, timezone):
        start_date = datetime.fromisoformat(start_date_iso)
        last_date = datetime.fromisoformat(last_date_iso)

        hours = math.ceil((last_date - start_date).total_seconds() / 3600) + 1

        url = self.api_url.format(lat=lat, lon=lon, hours=hours, timezone=timezone)

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
                    'cloud_cover': json['hourly']['cloud_cover'][i]
                })
            
            except KeyError:
                forecast.append({
                    'error': True,
                    'timestamp': time.isoformat()
                })

        return forecast