import requests
from packaging.version import Version


def is_update_available(current_version) -> bool:
    try:
        github_response = requests.get('https://api.github.com/repos/kgabriel-dev/WeatherMap/releases/latest')

        if github_response.status_code == 200:
            github_json = github_response.json()

            if 'tag_name' in github_json:
                latest_version = Version(github_json['tag_name'])

                return latest_version and latest_version > current_version
    
    except requests.exceptions.RequestException as e:
        print(f"Error while checking for updates: {e}")
        return False