import json


class Locations:
    def __init__(self):
        self.locations: list = None
        self.read_locations_file()


    def add_location(self, location):
        self.locations.append(location)
        self.write_locations_file()


    def get_locations(self):
        return self.locations
    

    def read_locations_file(self):
        with open('locations.json', 'r') as f:
            self.locations = [{
                'id': location['id'],
                'name': location['name'],
                'coordinates': {
                    'latitude': location['coordinates']['lat'],
                    'longitude': location['coordinates']['lng']
                },
                'region': {
                    'size': location['region']['size'],
                    'unit': location['region']['unit']
                },
                'steps': location['steps']
            } for location in json.load(f)]

    
    def write_locations_file(self):
        with open('locations.json', 'w') as f:
            json.dump(self.locations, f, indent=4)


    def find_location_by_name(self, name):
        for location in self.locations:
            if location['name'] == name:
                return location
        
        return None
    

    def get_location_by_id(self, id):
        for location in self.locations:
            if location['id'] == id:
                return location
        
        return None