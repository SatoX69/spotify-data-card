import Track from './track.interface';
import Artist from './artist.interface';
import StringMap from './map.interface';

export default interface DataCardProps {
  userDisplayName: string;
  showBorder: boolean;
  showDate: boolean;
  customTitle?: string;
  showTitle: boolean;
  hideExplicit: boolean;
  showNowPlaying: boolean;
  nowPlaying: Track | null;
  showRecentlyPlayed: boolean;
  recentlyPlayed: Track[];
  showTopTracks: boolean;
  topTracks: Track[];
  showTopArtists: boolean;
  topArtists: Artist[];
  imageDataMap: StringMap;
  itemLimit: number;
  errorMessage?: string;
}
