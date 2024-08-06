import requests
from packaging.version import Version
import PySimpleGUI as sg
from language import LanguageManager
import webbrowser
import os
import sys


# CONSTANTS
CURRENT_VERSION = Version('1.1.0')


def is_update_available() -> bool:
    try:
        github_response = requests.get('https://api.github.com/repos/kgabriel-dev/WeatherMap/releases/latest')

        if github_response.status_code == 200:
            github_json = github_response.json()

            if 'tag_name' in github_json:
                latest_version = Version(github_json['tag_name'])

                return latest_version and latest_version > CURRENT_VERSION
    
    except requests.exceptions.RequestException as e:
        print(f"Error while checking for updates: {e}")
        return False
    

def open_update_notification(lm: LanguageManager) -> None:
    bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))

    update_window = sg.Window(
        title=lm.get_string("update.title"),
        modal=True,
        icon=os.path.join(bundle_dir, './app.ico'),
        layout=[
            [sg.Text(lm.get_string("update.message"))],
            [
                sg.Button(lm.get_string("update.option_yes"), key='update_yes'),
                sg.Button(lm.get_string("update.option_no"), key='update_no')
            ]
        ]
    )

    while True:
        event, _ = update_window.read()

        if event == sg.WIN_CLOSED or event == 'update_no':
            break

        if event == 'update_yes':
            update_window.close()
            webbrowser.open("https://github.com/kgabriel-dev/WeatherMap/releases/latest", new=0, autoraise=True)
            break
    
    update_window.close()