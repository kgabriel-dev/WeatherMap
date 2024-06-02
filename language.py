import json
import os
import sys


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
        
        
        bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__  )))
        file_dir = os.path.join(bundle_dir, 'languages/' + self.language + '.json')

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
        