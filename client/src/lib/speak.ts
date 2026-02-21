import { Howl } from 'howler';
import {
  elevenLabsVoiceId,
  enableThirdPartyVoiceProviders,
  offlineVoiceUri,
  setVoiceEngineStatus,
  setSpeakingTilePosition,
} from './state';
import type { TilePositionKey } from './types';
import api from './api';

// speakText accepts a position key string (e.g., "0-1-0") for tile speaking indicator
export async function speakText(text: string, tilePositionKey?: TilePositionKey) {
  setVoiceEngineStatus('synthesizing');
  if (tilePositionKey) setSpeakingTilePosition(tilePositionKey);

  if (!enableThirdPartyVoiceProviders() || !elevenLabsVoiceId())
    return speakSynth(text);

  const data = await api.tts.speak.elevenlabs(joinWordsInSentence(text));

  const sound = new Howl({
    src: [URL.createObjectURL(data)],
    format: ['mp3'],
  });

  setVoiceEngineStatus('speaking');

  sound.play();

  sound.on('end', () => {
    setVoiceEngineStatus('ready');
    setSpeakingTilePosition(null);
  });

  sound.on('loaderror', () => {
    speakSynth(text);
  });
}

function speakSynth(text: string) {
  const synthVoiceUri = offlineVoiceUri();

  // make speech synthesis request
  const synth = new SpeechSynthesisUtterance(joinWordsInSentence(text));
  const synthVoices = speechSynthesis.getVoices();

  if (!synthVoices || !synthVoices.length) {
    setSpeakingTilePosition(null);
    return setVoiceEngineStatus('failed');
  }

  const voice = speechSynthesis
    .getVoices()
    .find((voice) => voice.voiceURI === synthVoiceUri);
  if (voice) {
    synth.voice = voice;
  }

  setVoiceEngineStatus('speaking');
  speechSynthesis.speak(synth);

  synth.onend = () => {
    setVoiceEngineStatus('ready');
    setSpeakingTilePosition(null);
  };
}

function joinWordsInSentence(sentence: string) {
  const words = sentence.split(' ');
  const result: string[] = [];
  let i = 0;

  while (i < words.length) {
    if (words[i].length === 1) {
      let joinedWord = words[i];
      while (i + 1 < words.length && words[i + 1].length === 1) {
        joinedWord += words[++i];
      }
      result.push(joinedWord);
    } else {
      result.push(words[i]);
    }
    i++;
  }

  return result.join(' ');
}
