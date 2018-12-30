# soundcloud-track-downloader

`soundcloud-track-downloader` downloads all public tracks of a SoundCloud account.

## Installation

`yarn global add danielruf/soundcloud-track-downloader`

## Usage

`soundcloud-track-downloader celldweller`

## client_id configuration

If the current client_id does not work you can easily get a new one. If you have a new one, you can set it with the following solutions:

`soundcloud-track-downloader username [client_id]`

`echo client_id > .soundcloudrc && soundcloud-track-downloader username`