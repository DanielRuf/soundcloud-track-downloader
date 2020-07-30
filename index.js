const https = require('https');
const readline = require('readline');
const fs = require('fs');
const NodeID3 = require('node-id3');
const pkg = require('./package.json');

const API_ENDPOINT = 'https://api-v2.soundcloud.com';
const client_id = !!process.argv[3]
  ? process.argv[3]
  : fs.existsSync('./.soundcloudrc')
    ? fs.readFileSync('./.soundcloudrc')
    : 'Y4UlT1McqCv2qou0fNfKEmpYaoDSq7x6';

const username = process.argv[2];
let file_number = 0;
let all_public_tracks = [];

console.log(pkg.name + ' ' + pkg.version);

loadUserData();
async function loadUserData() {
  const response = await getRealUserUrl();
  const tracks = await fetchAllTracks(response);
  processTracks(all_public_tracks);
}

async function getRealUserUrl() {
  return new Promise((resolve, reject) => {
    https.get(API_ENDPOINT + '/resolve?url=https://soundcloud.com/' + username + '&client_id=' + client_id, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      })

      resp.on('end', () => {
        const response = JSON.parse(data)
        if (typeof response === 'object') {
          resolve(response);
        } else {
          reject();
        }
      })

    }).on('error', (err) => {
      console.log('Error: ' + err.message);
      reject(err);
    })
  })
}

async function fetchAllTracks(response) {
  const user_data = response;
  const tracks_count = user_data.track_count;
  const userid = user_data.id;
  const iterations = Math.ceil(tracks_count / 200.0);
  let iterations_i = 0;
  const limit = 200;
  while (iterations_i != iterations) {
    const offset = iterations_i * limit;
    if (typeof response === 'object') {
      await fetchTracks(API_ENDPOINT + '/users/' + userid + '/tracks?limit=' + limit + '&offset=' + offset + '&client_id=' + client_id);
    }
    iterations_i++;
  }
  return all_public_tracks;
}

async function fetchTracks(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      })

      resp.on('end', async () => {
        const data_parsed = JSON.parse(data);
        const tracks = data_parsed.collection;
        let i = 0;

        const tracks_count = tracks.length;
        while (i < tracks_count) {
          all_public_tracks.push(tracks[i]);
          i++;
        }
        resolve(tracks_count);
      })

    }).on('error', (err) => {
      console.log('Error: ' + err.message);
      reject(err);
    })
  })
}

async function processTracks(tracks) {
  let i = 0;
  const tracks_count = tracks.length;
  while (i < tracks_count) {
    file_number++;
    const track = tracks[i];
    const tracks_count_current = i + 1;
    const username_soundcloud = track.user.username;
    let title_track = track.title;
    const title_track_original = title_track;
    title_track = title_track.replace(/\\\\/g, '-');
    title_track = title_track.replace(/\//g, '-');
    title_track = title_track.replace(/:/g, '-');
    title_track = title_track.replace(/\*/g, '-');
    title_track = title_track.replace(/\?/g, '-');
    title_track = title_track.replace(/'/g, '-');
    title_track = title_track.replace(/"/g, '-');
    // const id = track.id;

    const mp3_filename = file_number + '_' + username_soundcloud + ' - ' + title_track + '.mp3';
    // const mp3_id3filename = file_number + '_' + username_soundcloud + ' - ' + title_track + '_id3.mp3';

    if (track.media && track.media.transcodings && track.media.transcodings.length) {

      let j = 0;
      const transcodings_count = track.media.transcodings.length;
      while (j < transcodings_count) {
        const current_transcoding = track.media.transcodings[j];
        if (
          current_transcoding.format &&
          current_transcoding.format.protocol === 'progressive' &&
          current_transcoding.format.mime_type === 'audio/mpeg'
        ) {
          await getTrackStream(current_transcoding.url, mp3_filename, tracks_count_current, tracks_count, username_soundcloud, title_track_original);
          i++;
          break;
        }
        j++;
      }
    }
  }
  console.log('');
  console.log('Done.');
}

async function getTrackStream(url, mp3_filename, tracks_count_current, tracks_count, username_soundcloud, title_track_original) {
  return new Promise((resolve, reject) => {
    https.get(url + '?client_id=' + client_id, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      })

      resp.on('end', async () => {
        const response = JSON.parse(data);
        if (typeof response === 'object') {
          await downloadTrackStream(response.url, mp3_filename, tracks_count, tracks_count_current, username_soundcloud, title_track_original);
          resolve();
        }
      })

    }).on('error', (err) => {
      console.log('Error: ' + err.message);
      reject(err);
    })
  })
}

async function downloadTrackStream(url, mp3_filename, tracks_count, tracks_count_current, username_soundcloud, title_track_original) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {

      // let data = '';
      let cur = 0;

      const len = parseInt(resp.headers['content-length'], 10);
      const file = fs.createWriteStream('./' + mp3_filename);

      resp.on('data', (chunk) => {
        cur += chunk.length;
        file.write(chunk);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('Downloading track ' + tracks_count_current + ' of ' + tracks_count + ' ' + parseInt((100.0 * cur / len)) + '% ');
      })

      resp.on('end', () => {
        let tags = {};

        tags.title = title_track_original;
        tags.artist = username_soundcloud;

        const all_public_tracks_current = all_public_tracks[tracks_count_current];

        if (all_public_tracks_current.release_date) {
          const release_date = new Date(all_public_tracks_current.release_date);
          tags.year = release_date.getFullYear();
        }

        if (all_public_tracks_current.description) {
          tags.comment = {
            language: 'eng',
            text: all_public_tracks_current.description,
            shortText: all_public_tracks_current.description,
          }
        }

        if (all_public_tracks_current.publisher_metadata) {
          if (all_public_tracks_current.publisher_metadata.album_title) {
            tags.album = all_public_tracks_current.publisher_metadata.album_title;
          }
        }

        let ID3FrameBuffer = NodeID3.create(tags);
        let success = NodeID3.write(tags, './' + mp3_filename);
        resolve();
      })

    }).on('error', (err) => {
      console.log('Error: ' + err.message);
      reject(err);
    })
  })
}