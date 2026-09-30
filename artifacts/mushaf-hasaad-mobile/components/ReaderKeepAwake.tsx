import { useKeepAwake } from 'expo-keep-awake';

/** Mounted only when the reader's local preference is enabled. */
export function ReaderKeepAwake() {
  useKeepAwake();
  return null;
}