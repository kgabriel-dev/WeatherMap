import requests
from packaging.version import Version
import PySimpleGUI as sg
import webbrowser
import os
import sys
import platform


# CONSTANTS
CURRENT_VERSION = Version('1.2.3')


def is_update_available() -> bool:
    latest_version = get_latest_version()

    if latest_version is None:
        return False
    
    return latest_version > CURRENT_VERSION
    

def get_latest_version() -> Version:
    try:
        github_response = requests.get('https://api.github.com/repos/kgabriel-dev/WeatherMap/releases/latest')

        if github_response.status_code == 200:
            github_json = github_response.json()

            if 'tag_name' in github_json:
                return Version(github_json['tag_name'])
    
    except requests.exceptions.RequestException as e:
        print(f"Error while checking for updates: {e}")
        return None


def open_update_notification(lm) -> None:
    from language import LanguageManager    
    if not type(lm) is LanguageManager:
        raise TypeError("The language manager must be an instance of LanguageManager")

    update_window = sg.Window(
        title=lm.get_string("update.title"),
        modal=True,
        icon=get_file_path_in_bundle("app.ico"),
        layout=[
            [sg.Text(lm.get_string("update.message"))],
            [sg.Text("(" + lm.get_string("update.version").format(current=CURRENT_VERSION, latest=get_latest_version()) + ")")],
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


def open_no_update_available_notification(lm) -> None:
    from language import LanguageManager    
    if not type(lm) is LanguageManager:
        raise TypeError("The language manager must be an instance of LanguageManager")

    no_update_window = sg.Window(
        title=lm.get_string("update.title"),
        modal=True,
        icon=get_file_path_in_bundle("app.ico"),
        layout=[
            [sg.Text(lm.get_string("update.no_update"))],
            [sg.Button(lm.get_string("update.option_ok"), key='ok_button')]
        ]
    )

    while True:
        event, _ = no_update_window.read()

        if event == sg.WIN_CLOSED or event == 'ok_button':
            break
    
    no_update_window.close()


def get_file_path_in_bundle(file_name: str) -> str:
    bundle_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
    return os.path.join(bundle_dir, file_name)


def get_executable_path():
    """Returns the directory where the executable or script is located."""
    if getattr(sys, 'frozen', False):  # If running as a frozen/compiled app (like PyInstaller)
        return os.path.dirname(sys.executable)
    else:  # If running as a script
        return os.path.dirname(os.path.abspath(__file__))


def is_installed_version():
    """Determine if the program is likely running from an installed location."""
    exe_dir = get_executable_path()

    # Check if the executable is in a system-wide directory
    system = platform.system()

    if system == 'Windows':
        return 'Program Files' in exe_dir
    elif system == 'Darwin':  # macOS
        return exe_dir.startswith('/Applications') or '/usr/local' in exe_dir
    else:  # Assume Linux/Unix
        return '/usr' in exe_dir or '/opt' in exe_dir


def get_settings_path():
    """Determine the correct settings path based on whether it's a standalone or installed version."""
    exe_dir = get_executable_path()

    if not is_installed_version():
        # Standalone mode: settings file is next to the executable
        return os.path.join(exe_dir, 'settings.json')
    else:
        # Installed mode: use platform-specific settings location
        system = platform.system()
        if system == 'Windows':
            return os.path.join(os.getenv('LOCALAPPDATA'), 'WeatherMap', 'settings.json')
        elif system == 'Darwin':  # macOS
            return os.path.expanduser('~/Library/Application Support/WeatherMap/settings.json')
        else:  # Assume Linux or other Unix-like system
            return os.path.expanduser('~/.config/WeatherMap/settings.json')