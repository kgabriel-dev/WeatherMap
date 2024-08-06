import json
from helpers import get_file_path_in_bundle


class LanguageManager:

    def __init__(self, language):
        self.language = language
        self.accepted_languages = ['en-US', 'de-DE']

        self.load_language_file()

    # Set the language to be used
    def set_language(self, language):
        if language not in self.accepted_languages:
            raise Exception('Language not supported')

        self.language = language
        self.load_language_file()

    # Get the current language
    def get_language(self):
        return self.language
    
    # load the language file for the current language
    def load_language_file(self):
        print('Loading language file for ' + self.language)

        if self.language not in self.accepted_languages:
            raise Exception('Language not supported')
        
        
        file_dir = get_file_path_in_bundle('languages/' + self.language + '.json')

        self.language_file = open(file_dir, 'r', encoding='utf-8')
        self.language_data = json.load(self.language_file)

    # Get a string from the language file defined by the dotkey
    def get_string(self, dotkey, prefix='', suffix='', replace_dict={}):
        keys = dotkey.split('.')
        data = self.language_data

        for key in keys:
            if key not in data:
                return 'String not found'
            data = data[key]

        for key, value in replace_dict.items():
            data = data.replace(f"%{str(key)}%", str(value))
        
        return prefix + data + suffix
    
    # Get a list of all keys that have a given value
    def get_keys_by_value(self, lookup_value, key_list=[], start_dotkey=''):
        if not key_list:
            key_list = []
        
        # get the data for the current key
        language_data = self.language_data
        keys = start_dotkey.split('.')

        for key in keys:
            if not key:
                continue

            if key not in language_data:
                return key_list
            
            language_data = language_data[key]

        # iterate over the data
        for key, value in language_data.items():

            # recursively search for the value in the dictionary
            if type(value) is dict:
                for key in self.get_keys_by_value(lookup_value, key_list, (start_dotkey + '.' + key) if start_dotkey else key):
                    if key not in key_list:
                        key_list.append(key)

                continue
            
            # check if the value is the one we are looking for
            if value == lookup_value:
                new_key = (start_dotkey + '.' + key) if start_dotkey else key

                if new_key not in key_list:
                    key_list.append(start_dotkey + '.' + key if start_dotkey else key)

        return key_list


    @staticmethod
    def get_language_name_by_code(code):
        if code == 'en-US':
            return 'English'
        elif code == 'de-DE':
            return 'Deutsch'
        else:
            return 'Unknown'
        
    @staticmethod
    def get_language_code_by_name(name):
        if name == 'English':
            return 'en-US'
        elif name == 'Deutsch':
            return 'de-DE'
        else:
            return 'Unknown'
    
    @staticmethod
    def get_supported_language_names():
        return ['English', 'Deutsch']
        