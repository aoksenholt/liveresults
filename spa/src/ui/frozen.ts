import { storedFlag } from './stored';

/** Whether place and name stay put while the splits scroll sideways, as the user chose. */
export const useFrozenColumns = storedFlag('liveres-frozen', () => false);
