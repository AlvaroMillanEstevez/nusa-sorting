/** Persistence boundary. The game never touches storage APIs directly. */
export interface SaveService {
  load<T>(key: string): T | undefined;
  save<T>(key: string, value: T): void;
  remove(key: string): void;
}
