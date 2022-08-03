/**
 * Mutual exclusive access primitive based on Promise
 */
export default class Mutex {
  #allow_concurrent_read;
  #locked = false;
  #request: Function[] = [];
  /**
   * Number of readers
   */
  #readers = 0;
  #reader_mutex_unlock?: Function;
  constructor(allowConcurrentRead: boolean = false) {
    this.#allow_concurrent_read = allowConcurrentRead;
  }
  /**
   * Try to lock the mutex
   * @returns promise that resolves to a callback function where caller must call to release it
   */
  tryLock(): Promise<Function> {
    if (!this.#locked) {
      //if this is not locked then lock it and resolve it immediately
      this.#locked = true;
      return Promise.resolve(this.#release.bind(this));
    } else {
      return new Promise((resolve) => {
        this.#request.push(resolve);
      });
    }
  }
  /**
   * Try to lock the mutex but caller must not temper the data
   */
  async tryLockRead(): Promise<Function> {
    if (this.#allow_concurrent_read) {
      if (this.#reader_mutex_unlock === undefined && !this.#locked) {
        //if the mutex is not present create one
        this.#reader_mutex_unlock = await this.tryLock();
        this.#readers = 1;
      } else if (this.#locked) {
        //when it is attempted on modification it might causes deadlock
        //this usually happens when a mutator call accessor for verification
        //returning a empty function will avoid this problem
        return () => {};
      } else {
        //else increament the stuffs by one
        this.#readers++;
      }
      return this.#releaseReader.bind(this);
    } else {
      return await this.tryLock();
    }
  }
  /**
   * Release the current lock and pass to next
   */
  #release(): void {
    if (this.#request.length > 0) {
      //resolve the promise in queue
      this.#request[0](this.#release.bind(this));
      this.#request.shift();
    } else {
      this.#locked = false;
    }
  }
  #releaseReader(): void {
    if (--this.#readers <= 0) {
      this.#reader_mutex_unlock?.();
      this.#reader_mutex_unlock = undefined;
    }
  }
}
