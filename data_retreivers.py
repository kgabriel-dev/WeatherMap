import requests
from datetime import datetime, timedelta
import pytz
from bs4 import BeautifulSoup
import pprint


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


class ClearOutside:

    def __init__(self):
        self.web_url = "https://clearoutside.com/forecast/{lat}/{lon}?view=midnight"
        self.min_value = 0
        self.max_value = 2
        self.request_delay = 1

        self.condition_values = {
            'Good': 0,
            'OK': 1,
            'Bad': 2
        }
    

    def get_weather(self, start_date_iso, last_date_iso, lat, lon):
        # reset starting time to given hour
        start_date = datetime.fromisoformat(start_date_iso)
        start_date = start_date.replace(minute=0, second=0, microsecond=0)
        last_date = datetime.fromisoformat(last_date_iso)
        last_date = last_date.replace(minute=0, second=0, microsecond=0)

        search_timespan = last_date - start_date

        now = datetime.now(pytz.timezone('Europe/Berlin'))
        now = now.replace(minute=0, second=0, microsecond=0)

        if start_date < now:
            start_date = now

        url = self.web_url.format(lat=lat, lon=lon)

        request = requests.get(url)

        if(request.status_code != 200):
            print(f"Error: {request.status_code}")
            return []

        data = request.text
        soup = BeautifulSoup(data, 'html.parser')

        forecast = []

        for d in range(search_timespan.days + 1):
            for h in range(24):
                date = start_date + timedelta(days=d, hours=h)
                
                if date < start_date:
                    continue

                if date > last_date:
                    break

                element = soup.select_one(f"div#day_{d} div.fc_hours.fc_hour_ratings > ul > li:nth-child({h+1}) > span:nth-child(2)")
                text_value = element.text.strip()
                
                numeric_value = self.condition_values.get(text_value, None)

                forecast.append({
                    'timestamp': date.isoformat(),
                    'cloud_cover': numeric_value
                })

                pprint.pprint(forecast[-1])

        return forecast