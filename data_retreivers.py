import requests
from datetime import datetime


class BrightSky:

    def __init__(self):
        self.api_url = "https://api.brightsky.dev/weather?date={date}&last_date={last_date}&lat={lat}&lon={lon}"
        self.min_value = 0
        self.max_value = 100
        self.request_delay = 0.5

    
    def get_weather(self, start_date_iso, last_date_iso, lat, lon):
        # reset starting time to given hour
        start_date = datetime.fromisoformat(start_date_iso)
        start_date = start_date.replace(minute=0, second=0, microsecond=0)

        url = self.api_url.format(date=start_date.isoformat(), last_date=last_date_iso, lat=lat, lon=lon)
        
        request = requests.get(url)

        if(request.status_code != 200):
            print(f"Error: {request.status_code}")
            return []

        json = request.json()

        forecast = []

        for entry in json['weather']:
            forecast.append({
                'timestamp': entry['timestamp'],
                'cloud_cover': entry['cloud_cover']
            })

        return forecast