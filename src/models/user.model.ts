import axios, { AxiosError } from 'axios';
import Redis from './redis.model';
import UserProfileResponseBody from '../interfaces/user-profile-response-body.interface';
import CurrentlyPlayingResponseBody from '../interfaces/currently-playing-response-body.interface';
import RecentlyPlayedResponseBody from '../interfaces/recently-played-response-body.interface';
import TopItemsResponseBody from '../interfaces/top-items-response-body.interface';
import TrackResponseBody from '../interfaces/track-response-body.interface';
import ArtistResponseBody from '../interfaces/artist-response-body.interface';
import Track from '../interfaces/track.interface';
import Artist from '../interfaces/artist.interface';

const PROFILE_ENDPOINT = 'https://api.spotify.com/v1/me';
const NOW_PLAYING_ENDPOINT = `${PROFILE_ENDPOINT}/player/currently-playing`;
const RECENTLY_PLAYED_ENDPOINT = `${PROFILE_ENDPOINT}/player/recently-played`;
const TOP_TRACKS_ENDPOINT = `${PROFILE_ENDPOINT}/top/tracks`;
const TOP_ARTISTS_ENDPOINT = `${PROFILE_ENDPOINT}/top/artists`;
const DEFAULT_LIMIT = 20;

export default class User {
  static getUserProfile(
    accessToken: string,
    userId?: string
  ): Promise<UserProfileResponseBody> {
    return new Promise(async (resolve, reject) => {
      // attempt to fetch profile from cache
      let cachedProfile = null;
      if (userId) {
        try {
          cachedProfile = await Redis.getUserProfileFromCache(userId);
        } catch (error) {
          console.log(error);
        }
      }

      // fetch profile from spotify api if necessary
      let profile;
      let fetchedUserId = null;
      if (cachedProfile !== null) {
        profile = cachedProfile;
      } else {
        let response;
        try {
          response = await axios.get<UserProfileResponseBody>(
            PROFILE_ENDPOINT,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
        } catch (error) {
          reject((error as AxiosError).message);
          return;
        }
        const { id, display_name } = response.data;
        profile = { id, display_name };
        fetchedUserId = id;
      }

      // resolve with profile
      resolve(profile);

      // save profile to cache if necessary
      if (fetchedUserId === null) return;
      try {
        await Redis.saveUserProfileToCache(fetchedUserId, profile);
      } catch (error) {
        console.log(error);
      }
    });
  }

  static getNowPlaying(
    accessToken: string,
    hideExplicit: boolean
  ): Promise<Track | null> {
    return new Promise(async (resolve, reject) => {
      // fetch currently playing track
      let response;
      try {
        response = await axios.get<CurrentlyPlayingResponseBody>(
          NOW_PLAYING_ENDPOINT,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      } catch (error) {
        reject((error as AxiosError).message);
        return;
      }

      // check if a track can be shown
      const data = response.data;
      if (
        !data ||
        !data.item ||
        !data.is_playing ||
        (hideExplicit && data.item.explicit)
      ) {
        resolve(null);
        return;
      }

      // resolve with track
      const trackData = data.item;
      resolve({
        title: trackData.name,
        artist: trackData.artists.map((_artist) => _artist.name).join(', '),
        albumTitle: trackData.album.name,
        albumImageUrl: trackData.album.images[2].url,
        explicit: trackData.explicit,
        url: trackData.external_urls.spotify
      });
    });
  }

  static getRecentlyPlayed(
    accessToken: string,
    hideExplicit: boolean,
    limit: number
  ): Promise<Track[]> {
    return new Promise(async (resolve, reject) => {
      // fetch recently played tracks
      let response;
      try {
        response = await axios.get<RecentlyPlayedResponseBody>(
          `${RECENTLY_PLAYED_ENDPOINT}?limit=${
            hideExplicit ? DEFAULT_LIMIT : limit
          }`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      } catch (error) {
        reject((error as AxiosError).message);
        return;
      }

      // hide explicit tracks if necessary
      let trackDataArray = response.data.items.map(
        (item) => item.track
      ) as TrackResponseBody[];
      if (hideExplicit) {
        trackDataArray = trackDataArray.filter(
          (trackData) => !trackData.explicit
        );
      }

      // resolve with tracks
      resolve(
        trackDataArray.slice(0, limit).map((trackData) => ({
          title: trackData.name,
          artist: trackData.artists.map((_artist) => _artist.name).join(', '),
          albumTitle: trackData.album.name,
          albumImageUrl: trackData.album.images[2].url,
          explicit: trackData.explicit,
          url: trackData.external_urls.spotify
        }))
      );
    });
  }

  static getTopTracks(
    userId: string,
    accessToken: string,
    hideExplicit: boolean,
    limit: number
  ): Promise<Track[]> {
    return Redis.getTopTracksFromOrSaveToCache(
      userId,
      hideExplicit,
      limit,
      () => {
        return new Promise(async (resolve, reject) => {
          // fetch top tracks
          let response;
          try {
            response = await axios.get<TopItemsResponseBody>(
              `${TOP_TRACKS_ENDPOINT}?limit=${
                hideExplicit ? DEFAULT_LIMIT : limit
              }`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              }
            );
          } catch (error) {
            reject((error as AxiosError).message);
            return;
          }

          // hide explicit tracks if necessary
          let trackDataArray = response.data.items as TrackResponseBody[];
          if (hideExplicit) {
            trackDataArray = trackDataArray.filter(
              (trackData) => !trackData.explicit
            );
          }

          // resolve with tracks
          resolve(
            trackDataArray.slice(0, limit).map((trackData) => ({
              title: trackData.name,
              artist: trackData.artists
                .map((_artist) => _artist.name)
                .join(', '),
              albumTitle: trackData.album.name,
              albumImageUrl: trackData.album.images[2].url,
              explicit: trackData.explicit,
              url: trackData.external_urls.spotify
            }))
          );
        });
      }
    );
  }

  static getTopArtists(
    userId: string,
    accessToken: string,
    limit: number
  ): Promise<Artist[]> {
    return Redis.getTopArtistsFromOrSaveToCache(userId, limit, () => {
      return new Promise(async (resolve, reject) => {
        // fetch top artists
        let response;
        try {
          response = await axios.get<TopItemsResponseBody>(
            `${TOP_ARTISTS_ENDPOINT}?limit=${limit}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
        } catch (error) {
          reject((error as AxiosError).message);
          return;
        }

        // resolve with artists
        const artistDataArray = response.data.items as ArtistResponseBody[];
        resolve(
          artistDataArray.map((artistData) => ({
            name: artistData.name,
            imageUrl: artistData.images[2].url,
            url: artistData.external_urls.spotify
          }))
        );
      });
    });
  }
}
